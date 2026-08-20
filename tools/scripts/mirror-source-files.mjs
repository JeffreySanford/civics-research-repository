import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  copyFileSync,
  writeFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROBE_HEADERS } from './lib/url-probe.mjs';

/**
 * Downloads eligible source files into the SAF packages, so DSpace holds real bitstreams.
 *
 * The repository preserves selected publisher files as bitstreams while retaining authoritative
 * source URLs and manifests for every research object. Mirroring is bounded by a total preservation
 * budget rather than an arbitrary per-file ceiling: a large legitimate research artifact should be
 * eligible whenever it fits inside the remaining run budget.
 *
 * Only sources that report a positive Content-Length are candidates. The downloader also verifies
 * the streamed byte count against that declared length and aborts/removes partial output if a source
 * sends more bytes than declared, so a misreporting endpoint cannot silently exceed the budget.
 *
 * Downloads are cached outside the SAF tree, because `generate-saf.mjs` deletes and rewrites that
 * tree on every run and re-downloading gigabytes each time would make regeneration unusable.
 *
 * Usage:
 *   node tools/scripts/mirror-source-files.mjs
 *   node tools/scripts/mirror-source-files.mjs --budget-mb 5120
 *   node tools/scripts/mirror-source-files.mjs --dry-run
 */
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const catalogPath = join(
  repoRoot,
  'apps',
  'repository-api',
  'src',
  'main',
  'resources',
  'discovery-fixture-catalog.json',
);
const safRoot = join(repoRoot, 'tools', 'dspace', 'saf');
const cacheRoot = join(repoRoot, 'tools', 'dspace', 'mirror-cache');
const manifestPath = join(repoRoot, 'tools', 'dspace', 'mirror-manifest.json');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const numberArg = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index === -1 ? fallback : Number(args[index + 1]);
};

// The budget is the only size ceiling. There is deliberately no independent per-file cap.
const budgetBytes = numberArg('--budget-mb', 5120) * 1024 * 1024;

if (!Number.isFinite(budgetBytes) || budgetBytes <= 0) {
  throw new Error('--budget-mb must be a positive number.');
}

const items = JSON.parse(readFileSync(catalogPath, 'utf8')).items ?? [];

/**
 * Candidates are distinct URLs. A national file referenced by every area is downloaded once and
 * attached to the first item that claims it; attaching one file 52 times would multiply the
 * assetstore by 52 for no additional information.
 */
const candidates = new Map();
for (const item of items) {
  for (const file of item.files ?? []) {
    if (candidates.has(file.url)) {
      continue;
    }
    candidates.set(file.url, {
      url: file.url,
      format: file.format,
      itemId: item.id,
      program: item.program,
    });
  }
}

console.log(
  `Considering ${candidates.size} distinct files. No per-file cap; total mirror budget ` +
    `${(budgetBytes / 1024 ** 2).toFixed(0)} MiB.\n`,
);

async function sizeOf(url) {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: PROBE_HEADERS,
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      return null;
    }
    const length = Number(response.headers.get('content-length'));
    return Number.isFinite(length) && length > 0 ? length : null;
  } catch {
    return null;
  }
}

const sized = [];
let index = 0;
const list = [...candidates.values()];

async function sizeWorker() {
  while (index < list.length) {
    const candidate = list[index++];
    const bytes = await sizeOf(candidate.url);
    if (bytes !== null) {
      sized.push({ ...candidate, bytes });
    }
    process.stdout.write(bytes === null ? '?' : '.');
  }
}

await Promise.all(Array.from({ length: 6 }, sizeWorker));
process.stdout.write('\n\n');

// Largest first. Large research artifacts are not excluded merely because of their individual size;
// they are selected whenever they fit inside the total preservation budget.
const eligible = sized.sort((left, right) => right.bytes - left.bytes);

const selected = [];
let selectedBytes = 0;
for (const candidate of eligible) {
  if (selectedBytes + candidate.bytes > budgetBytes) {
    continue;
  }
  selected.push(candidate);
  selectedBytes += candidate.bytes;
}

console.log(`${sized.length} files reported a measurable size.`);
console.log(
  `Selected ${selected.length} totalling ${(selectedBytes / 1024 ** 3).toFixed(2)} GiB.\n`,
);

if (dryRun) {
  for (const entry of selected.slice(0, 15)) {
    console.log(
      `  ${(entry.bytes / 1024 ** 2).toFixed(1).padStart(8)} MiB  ${entry.program.padEnd(24)} ${basename(new URL(entry.url).pathname)}`,
    );
  }
  if (selected.length > 15) {
    console.log(`  ...and ${selected.length - 15} more.`);
  }
  console.log('\nDry run: nothing downloaded.');
  process.exit(0);
}

mkdirSync(cacheRoot, { recursive: true });

/**
 * SAF packages are grouped by target collection, so an item's directory is one level deeper than
 * its identifier suggests and which group it is in depends on its type.
 */
function findItemDirectory(itemId) {
  for (const collection of readdirSync(safRoot, { withFileTypes: true })) {
    if (!collection.isDirectory()) {
      continue;
    }
    const candidate = join(safRoot, collection.name, itemId);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/** A cached file of the currently declared size is taken as good; anything else is downloaded again. */
function cachedPath(entry) {
  const name = basename(new URL(entry.url).pathname) || 'download.bin';
  return join(cacheRoot, `${entry.itemId}__${name}`);
}

async function download(entry) {
  const target = cachedPath(entry);
  if (existsSync(target) && statSync(target).size === entry.bytes) {
    return { target, cached: true, actualBytes: entry.bytes };
  }

  const response = await fetch(entry.url, {
    headers: PROBE_HEADERS,
    signal: AbortSignal.timeout(300_000),
  });
  if (!response.ok || !response.body) {
    throw new Error(`${response.status} for ${entry.url}`);
  }

  let streamedBytes = 0;
  const declaredLengthGuard = new Transform({
    transform(chunk, encoding, callback) {
      streamedBytes += chunk.length;
      if (streamedBytes > entry.bytes) {
        callback(
          new Error(
            `source exceeded declared Content-Length (${entry.bytes} bytes): ${entry.url}`,
          ),
        );
        return;
      }
      callback(null, chunk);
    },
  });

  try {
    await pipeline(
      Readable.fromWeb(response.body),
      declaredLengthGuard,
      createWriteStream(target),
    );
  } catch (error) {
    rmSync(target, { force: true });
    throw error;
  }

  const actualBytes = statSync(target).size;
  if (actualBytes !== entry.bytes) {
    rmSync(target, { force: true });
    throw new Error(
      `source byte count changed: HEAD reported ${entry.bytes}, download produced ${actualBytes}: ${entry.url}`,
    );
  }

  return { target, cached: false, actualBytes };
}

const mirrored = [];
const failed = [];
let downloadedBytes = 0;

for (const entry of selected) {
  try {
    // Selection guarantees the declared bytes fit. The download verifies that the source actually
    // sends exactly that many bytes before anything is staged into SAF.
    if (downloadedBytes + entry.bytes > budgetBytes) {
      continue;
    }

    const { target, cached, actualBytes } = await download(entry);
    const name = basename(target).replace(`${entry.itemId}__`, '');
    const itemDirectory = findItemDirectory(entry.itemId);

    if (!itemDirectory) {
      failed.push({
        ...entry,
        reason: 'no SAF package; run dspace:saf:generate',
      });
      continue;
    }

    copyFileSync(target, join(itemDirectory, name));

    // SAF `contents`: one line per bitstream, with the bundle named explicitly. Rewritten rather
    // than appended, so a blank or stale first line cannot survive at the top, where DSpace reads
    // it as a malformed entry and imports no bitstreams at all.
    const contentsPath = join(itemDirectory, 'contents');
    const lines = existsSync(contentsPath)
      ? readFileSync(contentsPath, 'utf8')
          .split('\n')
          .map((entry) => entry.trim())
          .filter(Boolean)
      : [];
    const line = `${name}\tbundle:ORIGINAL`;
    if (!lines.includes(line)) {
      lines.push(line);
    }
    writeFileSync(contentsPath, `${lines.join('\n')}\n`, 'utf8');

    mirrored.push({ ...entry, bytes: actualBytes, fileName: name });
    downloadedBytes += actualBytes;
    process.stdout.write(cached ? 'c' : '+');
  } catch (error) {
    failed.push({ ...entry, reason: error.message });
    process.stdout.write('x');
  }
}
process.stdout.write('\n');

const manifest = {
  $comment:
    'Generated by tools/scripts/mirror-source-files.mjs. Records which source files were copied into the SAF packages.',
  mirroredAt: new Date().toISOString(),
  budgetBytes,
  perFileCapBytes: null,
  mirroredFileCount: mirrored.length,
  mirroredBytes: downloadedBytes,
  failedCount: failed.length,
  byProgram: Object.values(
    mirrored.reduce((groups, entry) => {
      const group = (groups[entry.program] ??= {
        program: entry.program,
        fileCount: 0,
        bytes: 0,
      });
      group.fileCount += 1;
      group.bytes += entry.bytes;
      return groups;
    }, {}),
  ).sort((left, right) => right.bytes - left.bytes),
};

writeManifest(manifest);

console.log(
  `\nMirrored ${mirrored.length} files, ${(downloadedBytes / 1024 ** 3).toFixed(2)} GiB, into the SAF packages.`,
);
if (failed.length > 0) {
  console.log(`${failed.length} failed:`);
  for (const entry of failed.slice(0, 8)) {
    console.log(`  ${entry.itemId}: ${entry.reason}`);
  }
}
console.log('\nNext: pnpm run dspace:seed to import them as bitstreams.');

function writeManifest(contents) {
  mkdirSync(dirname(manifestPath), { recursive: true });
  createWriteStream(manifestPath).end(`${JSON.stringify(contents, null, 2)}\n`);
}
