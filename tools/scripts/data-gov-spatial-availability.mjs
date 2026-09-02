import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_OUTPUT_DIR = 'browser-evidence-artifacts/spatial-availability';

export function buildProbeSql() {
  return `
with source as (
  select source_metadata_json::jsonb as metadata
  from federated_research_objects
  where source_system = 'DATA_GOV'
), raw as (
  select
    nullif(metadata ->> 'harvestRecord', '') as harvest_record,
    nullif(metadata ->> 'harvestRecordRaw', '') as harvest_record_raw
  from source
)
select json_build_object(
  'sourceSystem', 'DATA_GOV',
  'totalRecords', count(*),
  'harvestRecordPresent', count(*) filter (where harvest_record is not null),
  'harvestRecordRawPresent', count(*) filter (where harvest_record_raw is not null),
  'explicitSpatialTokenRecords', count(*) filter (
    where coalesce(harvest_record_raw, '') ~* '"spatial"[[:space:]]*:'
  ),
  'spatialTextRecords', count(*) filter (
    where coalesce(harvest_record_raw, '') ~* '"spatial"[[:space:]]*:[[:space:]]*"'
  ),
  'spatialObjectRecords', count(*) filter (
    where coalesce(harvest_record_raw, '') ~* '"spatial"[[:space:]]*:[[:space:]]*\\{'
  ),
  'spatialArrayRecords', count(*) filter (
    where coalesce(harvest_record_raw, '') ~* '"spatial"[[:space:]]*:[[:space:]]*\\['
  )
)::text
from raw;
`.trim();
}

export function normalizeProbe(raw, capturedAt = new Date().toISOString()) {
  const totalRecords = nonNegativeInteger(raw.totalRecords, 'totalRecords');
  const harvestRecordPresent = nonNegativeInteger(
    raw.harvestRecordPresent,
    'harvestRecordPresent',
  );
  const harvestRecordRawPresent = nonNegativeInteger(
    raw.harvestRecordRawPresent,
    'harvestRecordRawPresent',
  );
  const explicitSpatialTokenRecords = nonNegativeInteger(
    raw.explicitSpatialTokenRecords,
    'explicitSpatialTokenRecords',
  );
  const spatialTextRecords = nonNegativeInteger(
    raw.spatialTextRecords,
    'spatialTextRecords',
  );
  const spatialObjectRecords = nonNegativeInteger(
    raw.spatialObjectRecords,
    'spatialObjectRecords',
  );
  const spatialArrayRecords = nonNegativeInteger(
    raw.spatialArrayRecords,
    'spatialArrayRecords',
  );

  if (explicitSpatialTokenRecords > harvestRecordRawPresent) {
    throw new Error(
      'Spatial-token count cannot exceed records with retained raw harvest metadata.',
    );
  }

  return {
    sourceSystem: 'DATA_GOV',
    capturedAt,
    totalRecords,
    harvestRecordPresent,
    harvestRecordRawPresent,
    rawHarvestUnavailable: Math.max(0, totalRecords - harvestRecordRawPresent),
    explicitSpatialTokenRecords,
    explicitSpatialTokenPercent:
      totalRecords === 0
        ? 0
        : Number(((explicitSpatialTokenRecords / totalRecords) * 100).toFixed(4)),
    spatialRepresentations: {
      text: spatialTextRecords,
      object: spatialObjectRecords,
      array: spatialArrayRecords,
      other: Math.max(
        0,
        explicitSpatialTokenRecords -
          spatialTextRecords -
          spatialObjectRecords -
          spatialArrayRecords,
      ),
    },
    interpretation:
      'A spatial-token match proves only that retained Data.gov raw harvest metadata contains an explicit spatial field. It is an availability probe, not proof that the value is valid geometry or safe to render. Validation and typed sidecar enrichment remain separate steps.',
  };
}

export function parsePsqlJson(stdout) {
  const lines = String(stdout)
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  const line = lines.at(-1);
  if (!line) {
    throw new Error('PostgreSQL spatial probe returned no JSON output.');
  }
  try {
    return JSON.parse(line);
  } catch (error) {
    throw new Error(`PostgreSQL spatial probe returned invalid JSON: ${line}`, {
      cause: error,
    });
  }
}

export function formatMarkdown(report, expectedCount = null) {
  const expectedLine =
    expectedCount === null
      ? ''
      : `\n- Expected retained Data.gov records: **${expectedCount.toLocaleString()}** (${report.totalRecords === expectedCount ? 'MATCH' : 'MISMATCH'})`;
  return `# Data.gov spatial availability evidence

- Captured: ${report.capturedAt}
- Retained Data.gov records: **${report.totalRecords.toLocaleString()}**${expectedLine}
- Raw harvest metadata retained: **${report.harvestRecordRawPresent.toLocaleString()}**
- Explicit \`spatial\` token present: **${report.explicitSpatialTokenRecords.toLocaleString()}** (${report.explicitSpatialTokenPercent}%)
- Raw harvest metadata unavailable: **${report.rawHarvestUnavailable.toLocaleString()}**

## Observed spatial value shapes

| Shape | Records |
| --- | ---: |
| Text | ${report.spatialRepresentations.text.toLocaleString()} |
| Object | ${report.spatialRepresentations.object.toLocaleString()} |
| Array | ${report.spatialRepresentations.array.toLocaleString()} |
| Other / unclassified | ${report.spatialRepresentations.other.toLocaleString()} |

## Interpretation

${report.interpretation}

This probe is read-only. It does not mutate the certified corpus, search projection, or Data.gov source metadata. A follow-up enrichment pass must parse and validate publisher-supplied spatial values into a versioned sidecar before they become map features.
`;
}

export function parseArgs(argv) {
  const args = { expectedCount: null, outputDir: DEFAULT_OUTPUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--expect') {
      const value = Number(argv[index + 1]);
      if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error('--expect requires a non-negative integer.');
      }
      args.expectedCount = value;
      index += 1;
      continue;
    }
    if (argument === '--output-dir') {
      const value = argv[index + 1]?.trim();
      if (!value) {
        throw new Error('--output-dir requires a path.');
      }
      args.outputDir = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  return args;
}

export function runPsql(sql, env = process.env) {
  const database = env.CIVICS_DB_NAME || 'civics_ops';
  const user = env.CIVICS_DB_USER || 'civics';
  const result = spawnSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'postgres',
      'psql',
      '-X',
      '-A',
      '-t',
      '-q',
      '-U',
      user,
      '-d',
      database,
      '-c',
      sql,
    ],
    { encoding: 'utf8', env },
  );

  if (result.error) {
    throw new Error(`Unable to run Docker/PostgreSQL spatial probe: ${result.error.message}`, {
      cause: result.error,
    });
  }
  if (result.status !== 0) {
    throw new Error(
      `Data.gov spatial probe failed (exit ${result.status}).\n${result.stderr || result.stdout}`,
    );
  }
  return result.stdout;
}

export async function run(argv = process.argv.slice(2)) {
  const { expectedCount, outputDir } = parseArgs(argv);
  const report = normalizeProbe(parsePsqlJson(runPsql(buildProbeSql())));
  const resolvedOutputDir = path.resolve(outputDir);
  await mkdir(resolvedOutputDir, { recursive: true });
  const jsonPath = path.join(resolvedOutputDir, 'data-gov-spatial-availability.json');
  const markdownPath = path.join(
    resolvedOutputDir,
    'data-gov-spatial-availability.md',
  );
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(markdownPath, formatMarkdown(report, expectedCount), 'utf8');

  console.log(formatMarkdown(report, expectedCount));
  console.log(`JSON evidence: ${jsonPath}`);
  console.log(`Markdown evidence: ${markdownPath}`);

  if (expectedCount !== null && report.totalRecords !== expectedCount) {
    process.exitCode = 1;
  }
  return report;
}

function nonNegativeInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
  return parsed;
}

const invokedDirectly =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  await run();
}
