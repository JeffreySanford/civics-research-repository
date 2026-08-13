import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { probeUrl } from './lib/url-probe.mjs';

/**
 * Discovers publisher availability and vintage hints for tools/dspace/catalog.json.
 *
 * The catalog table remains the committed source of truth for breadth. This script verifies
 * URLs, probes for newer vintages where naming patterns are stable, and reports diffs. It does
 * not attempt to discover every Census product on day one; register a discoverer per program to
 * extend coverage.
 *
 * Usage:
 *   node tools/scripts/harvest-catalog.mjs                 report to stdout
 *   node tools/scripts/harvest-catalog.mjs --json out.json   also write machine-readable report
 *   node tools/scripts/harvest-catalog.mjs --write           bump program vintages when probes succeed
 *   node tools/scripts/harvest-catalog.mjs --verify-all      probe every catalog item URL (slow)
 *   node tools/scripts/harvest-catalog.mjs --strict          exit 1 when verification fails (default reports only)
 *
 * After --write:
 *   pnpm run dspace:saf:generate && pnpm run dspace:seed && pnpm run reindex
 */
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const catalogPath = join(repoRoot, 'tools', 'dspace', 'catalog.json');

const args = process.argv.slice(2);
const writeCatalog = args.includes('--write');
const verifyAll = args.includes('--verify-all');
const strict = args.includes('--strict') || verifyAll;
const jsonIndex = args.indexOf('--json');
const jsonPath = jsonIndex >= 0 ? args[jsonIndex + 1] : null;

const CONCURRENCY = 6;

/** Sample area used to probe area-scoped vintage patterns without checking all fifty-two states. */
const SAMPLE_AREA = { name: 'North Dakota', fips: '38', abbreviation: 'ND' };

function slug(value) {
  return value.toLowerCase().replaceAll(' ', '-');
}

function fill(template, tokens) {
  return String(template).replace(/\{(\w+)\}/g, (match, token) =>
    token in tokens ? String(tokens[token]) : match,
  );
}

function buildItem(program, area, catalog) {
  const tokens = {
    vintage: program.vintage,
    vintageShort: String(program.vintage).slice(-2),
    area: area ? area.name : (program.geography ?? 'United States'),
    areaSlug: area ? slug(area.name) : 'united-states',
    fips: area ? area.fips : '',
    abbreviation: area ? area.abbreviation : '',
    abbreviationLower: area ? area.abbreviation.toLowerCase() : '',
  };

  const sourceUrl = fill(program.sourceUrlTemplate, tokens);
  const documentationUrl = fill(program.documentationUrl, tokens);

  return {
    id: fill(program.idTemplate, { ...tokens, sourceUrl, documentationUrl }),
    programId: program.id,
    vintage: program.vintage,
    geography: tokens.area,
    sourceUrl,
    documentationUrl,
    publisher: catalog.publisherDefaults[program.publisher],
  };
}

function expandCatalog(catalog) {
  const areas = catalog.areas;
  const programs = catalog.programs.filter((program) => program.enabled);
  const items = [];

  for (const program of programs) {
    if (program.scope === 'national') {
      items.push(buildItem(program, null, catalog));
      continue;
    }

    for (const area of areas) {
      if (program.unavailableAreas?.[area.name]) {
        continue;
      }
      items.push(buildItem(program, area, catalog));
    }
  }

  return items.sort((left, right) => left.id.localeCompare(right.id));
}

function sampleVerificationTargets(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.programId;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function runProbes(targets) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < targets.length) {
      const target = targets[index++];
      const source = await probeUrl(target.sourceUrl);
      const documentation = await probeUrl(target.documentationUrl);
      results.push({
        ...target,
        source,
        documentation,
        ok: source.ok && documentation.ok,
      });
      process.stdout.write(source.ok && documentation.ok ? '.' : 'x');
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker),
  );
  process.stdout.write('\n');
  return results;
}

function programWithVintage(program, vintage) {
  return { ...program, vintage };
}

async function probeProgramVintage(program, catalog, vintage) {
  const candidate = programWithVintage(program, vintage);
  const area = program.scope === 'area' ? SAMPLE_AREA : null;
  const item = buildItem(candidate, area, catalog);
  const source = await probeUrl(item.sourceUrl);
  return { vintage, ok: source.ok, status: source.status, url: item.sourceUrl };
}

/** @type {Record<string, (program: object, catalog: object) => Promise<number | null>>} */
const VINTAGE_DISCOVERERS = {
  async TIGER_LINE(program, catalog) {
    for (const vintage of [program.vintage + 1, program.vintage + 2]) {
      const result = await probeProgramVintage(program, catalog, vintage);
      if (result.ok) {
        return vintage;
      }
    }
    return null;
  },

  async LODES(program, catalog) {
    for (
      let vintage = program.vintage + 1;
      vintage <= program.vintage + 3;
      vintage += 1
    ) {
      const result = await probeProgramVintage(program, catalog, vintage);
      if (result.ok) {
        return vintage;
      }
    }
    return null;
  },

  async ACS(program, catalog) {
    return discoverSequentialNational(program, catalog, 1);
  },

  async CPS(program, catalog) {
    return discoverSequentialNational(program, catalog, 1);
  },

  async SIPP(program, catalog) {
    return discoverSequentialNational(program, catalog, 1);
  },

  async ECONOMIC_CENSUS(program, catalog) {
    return discoverSequentialNational(program, catalog, 2);
  },

  async COUNTY_BUSINESS_PATTERNS(program, catalog) {
    return discoverSequentialNational(program, catalog, 1);
  },

  async BUILDING_PERMITS(program, catalog) {
    return discoverSequentialNational(program, catalog, 1);
  },

  async POPULATION_ESTIMATES(program, catalog) {
    return discoverSequentialNational(program, catalog, 1);
  },

  async SAIPE(program, catalog) {
    return discoverSequentialNational(program, catalog, 1);
  },

  async BUSINESS_DYNAMICS(program, catalog) {
    return discoverSequentialNational(program, catalog, 1);
  },

  async USGS() {
    return null;
  },

  async USGS_3DEP() {
    return null;
  },

  async USGS_3HP() {
    return null;
  },
};

async function discoverSequentialNational(program, catalog, step) {
  const candidate = program.vintage + step;
  const result = await probeProgramVintage(program, catalog, candidate);
  return result.ok ? candidate : null;
}

async function discoverVintages(catalog) {
  const suggestions = [];
  const programs = catalog.programs.filter((program) => program.enabled);

  for (const program of programs) {
    const discover = VINTAGE_DISCOVERERS[program.id];
    if (!discover) {
      continue;
    }

    process.stdout.write(`Discovering ${program.id}... `);
    const suggested = await discover(program, catalog);
    process.stdout.write(suggested ? `found ${suggested}\n` : 'unchanged\n');

    if (suggested && suggested !== program.vintage) {
      suggestions.push({
        programId: program.id,
        currentVintage: program.vintage,
        suggestedVintage: suggested,
      });
    }
  }

  return suggestions;
}

function applyVintageUpdates(catalog, suggestions) {
  if (suggestions.length === 0) {
    return false;
  }

  for (const suggestion of suggestions) {
    const program = catalog.programs.find(
      (entry) => entry.id === suggestion.programId,
    );
    if (program) {
      program.vintage = suggestion.suggestedVintage;
    }
  }

  writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  return true;
}

const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
const items = expandCatalog(catalog);
const verificationTargets = verifyAll
  ? items
  : sampleVerificationTargets(items);

console.log(
  `Catalog harvest — ${items.length} expanded item(s), verifying ${verificationTargets.length} URL pair(s)${verifyAll ? '' : ' (one program sample; pass --verify-all for every item)'}.\n`,
);

const verification = await runProbes(verificationTargets);
const broken = verification.filter((entry) => !entry.ok);
const vintageSuggestions = await discoverVintages(catalog);

const report = {
  checkedAt: new Date().toISOString(),
  catalogPath: 'tools/dspace/catalog.json',
  itemCount: items.length,
  verification: {
    mode: verifyAll ? 'all' : 'sample',
    checked: verification.length,
    failed: broken.length,
    failures: broken.map((entry) => ({
      id: entry.id,
      programId: entry.programId,
      sourceUrl: entry.sourceUrl,
      sourceStatus: entry.source.status || entry.source.error,
      documentationUrl: entry.documentationUrl,
      documentationStatus:
        entry.documentation.status || entry.documentation.error,
    })),
  },
  vintageSuggestions,
  writeApplied: false,
};

console.log('\nVerification summary');
console.log('Program                    checked  failed');
const byProgram = new Map();
for (const entry of verification) {
  const counts = byProgram.get(entry.programId) ?? { ok: 0, failed: 0 };
  counts[entry.ok ? 'ok' : 'failed'] += 1;
  byProgram.set(entry.programId, counts);
}
for (const [programId, counts] of [...byProgram].sort()) {
  console.log(
    `  ${programId.padEnd(26)} ${String(counts.ok + counts.failed).padStart(3)} ${String(counts.failed).padStart(7)}`,
  );
}

if (vintageSuggestions.length > 0) {
  console.log('\nSuggested vintage updates:');
  for (const suggestion of vintageSuggestions) {
    console.log(
      `  ${suggestion.programId}: ${suggestion.currentVintage} -> ${suggestion.suggestedVintage}`,
    );
  }
} else {
  console.log('\nNo newer vintages discovered for enabled programs.');
}

if (writeCatalog) {
  if (vintageSuggestions.length === 0) {
    console.log('\n--write: nothing to apply.');
  } else {
    applyVintageUpdates(catalog, vintageSuggestions);
    report.writeApplied = true;
    console.log(
      `\n--write: updated ${vintageSuggestions.length} program vintage(s) in tools/dspace/catalog.json.`,
    );
    console.log(
      'Next: pnpm run dspace:saf:generate && pnpm run dspace:seed && pnpm run reindex',
    );
  }
} else if (vintageSuggestions.length > 0) {
  console.log(
    '\nPass --write to apply suggested vintage bumps to catalog.json.',
  );
}

if (jsonPath) {
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nReport written to ${jsonPath}`);
}

if (broken.length > 0) {
  const strictHint = strict
    ? ''
    : ' Pass --strict (or --verify-all) to fail the command when URLs do not resolve.';
  console.log(
    `\n${broken.length} verification failure(s) reported.${strictHint}`,
  );
}

process.exit(strict && broken.length > 0 ? 1 : 0);
