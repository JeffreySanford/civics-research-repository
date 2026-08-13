import { readdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { probeUrl, DEFAULT_TIMEOUT_MS } from './lib/url-probe.mjs';

/**
 * Checks that every source URL the seeded catalog claims actually resolves.
 *
 * The repository presents these as the authoritative location of the data behind each research
 * object. A URL that 404s is worse than no URL: it looks like provenance and is not. This walks the
 * generated SAF packages, requests each distinct source and documentation URL, and reports what
 * does not answer.
 *
 * Usage:
 *   node tools/scripts/verify-source-urls.mjs               one URL per program, the fast check
 *   node tools/scripts/verify-source-urls.mjs --all         every URL in every package
 *   node tools/scripts/verify-source-urls.mjs --json <path> also write a machine-readable report
 *
 * Exits non-zero when a URL fails, so it can gate a data change. It is deliberately not part of
 * `quality:all`: it depends on federal hosts being reachable, and a Census outage must not read as
 * a broken build.
 */
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const safRoot = join(repoRoot, 'tools', 'dspace', 'saf');
const args = process.argv.slice(2);
const checkAll = args.includes('--all');
const jsonIndex = args.indexOf('--json');
const jsonPath = jsonIndex >= 0 ? args[jsonIndex + 1] : null;

const TIMEOUT_MS = DEFAULT_TIMEOUT_MS;
const CONCURRENCY = 6;

function readValue(xml, pattern) {
  const match = xml.match(pattern);
  return match ? match[1].replaceAll('&amp;', '&') : null;
}

function collectTargets() {
  if (!existsSync(safRoot)) {
    throw new Error(
      `No SAF packages found at ${safRoot}. Run: node tools/scripts/generate-saf.mjs`,
    );
  }

  const targets = [];
  for (const entry of readdirSync(safRoot)) {
    const file = join(safRoot, entry, 'metadata_crr.xml');
    if (!existsSync(file)) {
      continue;
    }

    const xml = readFileSync(file, 'utf8');
    const program = readValue(xml, /element="program"[^>]*>([^<]+)</);
    const sourceUrl = readValue(
      xml,
      /element="source" qualifier="url">([^<]+)</,
    );
    const documentationUrl = readValue(
      xml,
      /element="documentation" qualifier="url">([^<]+)</,
    );

    if (program && sourceUrl) {
      targets.push({ item: entry, program, kind: 'source', url: sourceUrl });
    }
    if (program && documentationUrl) {
      targets.push({
        item: entry,
        program,
        kind: 'documentation',
        url: documentationUrl,
      });
    }
  }
  return targets;
}

/** One item per program unless --all, so the default run stays quick and polite to the hosts. */
function sample(targets) {
  if (checkAll) {
    return targets;
  }

  const seen = new Set();
  return targets.filter((target) => {
    const key = `${target.program}:${target.kind}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function probe(url) {
  const outcome = await probeUrl(url, { timeoutMs: TIMEOUT_MS });
  return {
    status: outcome.status,
    contentType: outcome.contentType,
    error: outcome.error,
  };
}

async function run(targets) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < targets.length) {
      const target = targets[index++];
      const outcome = await probe(target.url);
      const ok = outcome.status >= 200 && outcome.status < 400;
      results.push({ ...target, ...outcome, ok });
      process.stdout.write(ok ? '.' : 'x');
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker),
  );
  process.stdout.write('\n');
  return results;
}

const targets = sample(collectTargets());
console.log(
  `Checking ${targets.length} URL(s)${checkAll ? '' : ' (one per program and kind; pass --all for every item)'}.\n`,
);

const results = await run(targets);
const failures = results.filter((result) => !result.ok);

const byProgram = new Map();
for (const result of results) {
  const entry = byProgram.get(result.program) ?? { ok: 0, failed: 0 };
  entry[result.ok ? 'ok' : 'failed'] += 1;
  byProgram.set(result.program, entry);
}

console.log('Program                    checked  failed');
for (const [program, counts] of [...byProgram].sort()) {
  console.log(
    `  ${program.padEnd(26)} ${String(counts.ok + counts.failed).padStart(3)} ${String(counts.failed).padStart(7)}`,
  );
}

if (failures.length > 0) {
  console.error(`\n${failures.length} URL(s) did not resolve:\n`);
  for (const failure of failures.slice(0, 40)) {
    console.error(
      `  ${failure.item} (${failure.kind}) -> ${failure.status || failure.error}\n    ${failure.url}`,
    );
  }
  if (failures.length > 40) {
    console.error(`  ...and ${failures.length - 40} more.`);
  }
}

if (jsonPath) {
  writeFileSync(
    jsonPath,
    JSON.stringify(
      { checkedAt: new Date().toISOString(), checkAll, results },
      null,
      2,
    ),
  );
  console.log(`\nReport written to ${jsonPath}`);
}

process.exit(failures.length > 0 ? 1 : 0);
