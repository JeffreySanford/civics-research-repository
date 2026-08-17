import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  copyFileSync,
  appendFileSync,
} from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROBE_HEADERS } from './lib/url-probe.mjs';

/**
 * Downloads eligible source files into the SAF packages, so DSpace holds real bitstreams.
 *
 * Until now the repository stored metadata and links only: every `contents` file was empty, and the
 * assetstore held 7 KB against 1.7 GiB subscribed. That is a defensible design, but it makes the
 * demo weaker than the software — no checksums, no downloads, no preservation story.
 *
 * Selection is bounded on purpose. Each file must be under a per-file cap, and the run stops at a
 * total budget, largest-eligible first so the mirrored set is representative rather than a pile of
 * documentation PDFs. Everything not mirrored stays a link, exactly as before.
 *
 * Downloads are cached outside the SAF tree, because `generate-saf.mjs` deletes and rewrites that
 * tree on every run and re-downloading gigabytes each time would make regeneration unusable.
 *
 * Usage:
 *   node tools/scripts/mirror-source-files.mjs
 *   node tools/scripts/mirror-source-files.mjs --budget-mb 2048 --max-file-mb 120
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

const budgetBytes = numberArg('--budget-mb', 1024) * 1024 * 1024;
const maxFileBytes = numberArg('--max-file-mb', 120) * 1024 * 1024;

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
  `Considering ${candidates.size} distinct files. Per-file cap ` +
    `${(maxFileBytes / 1024 ** 2).toFixed(0)} MiB, total budget ` +
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

// Largest first, so the budget buys the most representative files rather than a pile of PDFs.
const eligible = sized
  .filter((candidate) => candidate.bytes <= maxFileBytes)
  .sort((left, right) => right.bytes - left.bytes);

const selected = [];
let selectedBytes = 0;
for (const candidate of eligible) {
  if (selectedBytes + candidate.bytes > budgetBytes) {
    continue;
  }
  selected.push(candidate);
  selectedBytes += candidate.bytes;
}

console.log(
  `${sized.length} files reported a size; ${eligible.length} are under the per-file cap.`,
);
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

/** A cached file of the right size is taken as good; anything else is downloaded again. */
function cachedPath(entry) {
  const name = basename(new URL(entry.url).pathname) || 'download.bin';
  return join(cacheRoot, `${entry.itemId}__${name}`);
}

async function download(entry) {
  const target = cachedPath(entry);
  if (existsSync(target) && statSync(target).size === entry.bytes) {
    return { target, cached: true };
  }

  const response = await fetch(entry.url, {
    headers: PROBE_HEADERS,
    signal: AbortSignal.timeout(300_000),
  });
  if (!response.ok || !response.body) {
    throw new Error(`${response.status} for ${entry.url}`);
  }

  await pipeline(Readable.fromWeb(response.body), createWriteStream(target));
  return { target, cached: false };
}

const mirrored = [];
const failed = [];
let downloadedBytes = 0;

for (const entry of selected) {
  try {
    const { target, cached } = await download(entry);
    const name = basename(target).replace(`${entry.itemId}__`, '');
    const itemDirectory = join(safRoot, entry.itemId);

    if (!existsSync(itemDirectory)) {
      failed.push({
        ...entry,
        reason: 'no SAF package; run dspace:saf:generate',
      });
      continue;
    }

    copyFileSync(target, join(itemDirectory, name));
    // SAF `contents`: one line per bitstream, with the bundle named explicitly.
    appendFileSync(
      join(itemDirectory, 'contents'),
      `${name}\tbundle:ORIGINAL\n`,
    );

    mirrored.push({ ...entry, fileName: name });
    downloadedBytes += entry.bytes;
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
  maxFileBytes,
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
