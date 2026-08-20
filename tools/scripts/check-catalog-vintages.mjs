import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROBE_HEADERS } from './lib/url-probe.mjs';

/**
 * Reports where the catalog's vintage is behind what the publisher offers.
 *
 * This is the useful half of "harvest the catalog from live publishers", and it is worth being
 * precise about which half. Census publishes its bulk files on an autoindexed host, so *which
 * vintages exist* is discoverable: TIGER/Line lists TIGER2020 through TIGER2025, LEHD lists a file
 * per year. What is not discoverable is the file naming inside a vintage. `api.census.gov/data.json`
 * catalogs the Census Data API rather than the file server -- all 1,798 datasets carry a
 * `distribution` block whose `accessURL` points at api.census.gov and whose `downloadURL` is absent
 * -- so `jan26pub.zip` and `tl_2025_38_tract.zip` still have to be curated. They live as templates
 * in catalog.json, which is the right place for them.
 *
 * So this reports; it does not rewrite. A new vintage often changes file names, and a script that
 * bumped the year automatically would produce a catalog full of plausible URLs that 404 -- exactly
 * the failure this repository has spent its effort removing. A human reads the report and edits the
 * template, which is a minute of work once a year per program.
 *
 * The CPS adapter drifted a whole vintage from the catalog and nothing noticed for months. This is
 * the check that would have said so.
 *
 * Usage:
 *   node tools/scripts/check-catalog-vintages.mjs
 *   node tools/scripts/check-catalog-vintages.mjs --strict   exit non-zero when anything is behind
 */
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const catalog = JSON.parse(
  readFileSync(join(repoRoot, 'tools', 'dspace', 'catalog.json'), 'utf8'),
);

const strict = process.argv.includes('--strict');
const programs = catalog.programs.filter((program) => program.enabled);

async function publishedVintages(index) {
  const response = await fetch(index.url, {
    headers: PROBE_HEADERS,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`${response.status} for ${index.url}`);
  }

  const body = await response.text();
  const matches = [...body.matchAll(new RegExp(index.pattern, 'g'))];
  // Sorted and de-duplicated: an autoindex lists a directory more than once, once per column.
  return [...new Set(matches.map((match) => Number(match[1])))].sort(
    (left, right) => left - right,
  );
}

const rows = [];
for (const program of programs) {
  if (!program.vintageIndex) {
    // Named rather than skipped silently. A program with no index is one nobody can check, which
    // is a fact about this tool's coverage and belongs in its output.
    rows.push({
      program: program.id,
      catalog: program.vintage,
      status: 'no vintage index defined',
    });
    continue;
  }

  try {
    const published = await publishedVintages(program.vintageIndex);
    const latest = published.at(-1) ?? null;

    if (latest === null) {
      rows.push({
        program: program.id,
        catalog: program.vintage,
        status: 'no vintages matched',
      });
    } else if (program.vintage === latest) {
      rows.push({
        program: program.id,
        catalog: program.vintage,
        latest,
        status: 'current',
      });
    } else if (program.vintage < latest) {
      rows.push({
        program: program.id,
        catalog: program.vintage,
        latest,
        status: 'BEHIND',
        behind: true,
      });
    } else {
      // The catalog naming a vintage the publisher does not list is worth surfacing too: it is how
      // an adapter ends up searching for an item that was never seeded.
      rows.push({
        program: program.id,
        catalog: program.vintage,
        latest,
        status: 'AHEAD OF PUBLISHER',
        behind: true,
      });
    }
  } catch (error) {
    rows.push({
      program: program.id,
      catalog: program.vintage,
      status: `probe failed: ${error.message}`,
    });
  }
}

console.log(
  `${'program'.padEnd(26)} ${'catalog'.padStart(8)} ${'published'.padStart(10)}  status`,
);
for (const row of rows) {
  console.log(
    `${row.program.padEnd(26)} ${String(row.catalog).padStart(8)} ${String(row.latest ?? '-').padStart(10)}  ${row.status}`,
  );
}

const behind = rows.filter((row) => row.behind);
const unchecked = rows.filter((row) => !row.latest && !row.behind);

console.log(
  `\n${rows.length - behind.length - unchecked.length} current, ${behind.length} out of step, ${unchecked.length} not checkable.`,
);

if (behind.length > 0) {
  console.log(
    '\nA newer vintage does not mean the file names carry over. Check the publisher listing, then\n' +
      'update the program template in tools/dspace/catalog.json and re-run pnpm run verify:sources:all.',
  );
}

if (strict && behind.length > 0) {
  process.exit(1);
}
