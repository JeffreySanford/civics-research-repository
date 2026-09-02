import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_OUTPUT_DIR = 'browser-evidence-artifacts/spatial-availability';
const C2_PROFILE = 'FEDERATED_1M';
const C2_TARGET_RECORDS = 1_000_000;
const SHA256 = /^[0-9a-f]{64}$/u;
const REQUIRED_SCALE_CHECKS = [
  'preflight-ready-to-measure',
  'exact-source-recipe',
  'scale-evidence-valid',
  'active-profile',
  'persisted-activation-runtime-identity',
  'search-target-parity',
  'storage-evidence',
  'composition-projection-linkage',
  'public-search-data_gov-provenance',
  'public-search-doe_osti-provenance',
];

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

/**
 * Reduces the canonical quality:scale artifact to the identity needed by spatial evidence.
 *
 * Count-only evidence is not enough for C2: any arbitrary 500K Data.gov rows could satisfy the
 * probe. Requiring the canonical scale checker to pass binds this report to the exact mixed-source
 * composition and active search projection already certified elsewhere in the repository.
 */
export function normalizeScaleCertification(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Scale evidence must be a JSON object.');
  }
  if (raw.kind !== 'civics-scale-evidence-check') {
    throw new Error('Scale evidence kind must be civics-scale-evidence-check.');
  }
  if (raw.profile !== C2_PROFILE) {
    throw new Error(`Scale evidence profile must be ${C2_PROFILE}.`);
  }
  if (raw.status !== 'PASS') {
    throw new Error(
      'Scale evidence must be PASS before spatial evidence is captured.',
    );
  }

  const targetFederatedRecordCount = nonNegativeInteger(
    raw.targetFederatedRecordCount,
    'scale targetFederatedRecordCount',
  );
  if (targetFederatedRecordCount !== C2_TARGET_RECORDS) {
    throw new Error(
      `Scale evidence must target exactly ${C2_TARGET_RECORDS.toLocaleString('en-US')} federated records.`,
    );
  }

  const retainedFederatedRecordCount = nonNegativeInteger(
    raw.retainedFederatedRecordCount,
    'scale retainedFederatedRecordCount',
  );
  if (retainedFederatedRecordCount < C2_TARGET_RECORDS) {
    throw new Error(
      `Scale evidence retained count must be at least ${C2_TARGET_RECORDS.toLocaleString('en-US')}.`,
    );
  }

  const compositionSha256 = sha256(
    raw.compositionSha256,
    'scale compositionSha256',
  );
  const projectionId = sha256(raw.projectionId, 'scale projectionId');
  const projectionObjectCount = nonNegativeInteger(
    raw.projectionObjectCount,
    'scale projectionObjectCount',
  );
  if (projectionObjectCount === 0) {
    throw new Error('Scale projectionObjectCount must be greater than zero.');
  }

  const capturedAt = requiredText(raw.capturedAt, 'scale capturedAt');
  const checks = new Map(
    (Array.isArray(raw.checks) ? raw.checks : []).map((entry) => [
      entry?.id,
      entry?.status,
    ]),
  );
  const missingPassChecks = REQUIRED_SCALE_CHECKS.filter(
    (id) => checks.get(id) !== 'PASS',
  );
  if (missingPassChecks.length > 0) {
    throw new Error(
      `Scale evidence is missing required PASS checks: ${missingPassChecks.join(', ')}.`,
    );
  }

  return {
    kind: 'c2-scale-certification',
    profile: C2_PROFILE,
    capturedAt,
    compositionSha256,
    projectionId,
    projectionObjectCount,
    retainedFederatedRecordCount,
  };
}

export async function loadScaleCertification(scaleEvidencePath) {
  const resolved = path.resolve(scaleEvidencePath);
  let raw;
  try {
    raw = JSON.parse(await readFile(resolved, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to read valid scale evidence JSON: ${resolved}`, {
      cause: error,
    });
  }
  return normalizeScaleCertification(raw);
}

export function normalizeProbe(
  raw,
  capturedAt = new Date().toISOString(),
  scaleCertification = null,
) {
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
    ...(scaleCertification ? { scaleCertification } : {}),
    totalRecords,
    harvestRecordPresent,
    harvestRecordRawPresent,
    rawHarvestUnavailable: Math.max(0, totalRecords - harvestRecordRawPresent),
    explicitSpatialTokenRecords,
    explicitSpatialTokenPercent:
      totalRecords === 0
        ? 0
        : Number(
            ((explicitSpatialTokenRecords / totalRecords) * 100).toFixed(4),
          ),
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
  const certification = report.scaleCertification;
  const certificationBlock = certification
    ? `\n## Certified C2 binding\n\n- Profile: \`${certification.profile}\`\n- Scale evidence captured: ${certification.capturedAt}\n- Composition SHA-256: \`${certification.compositionSha256}\`\n- Projection ID: \`${certification.projectionId}\`\n- Projection objects: **${certification.projectionObjectCount.toLocaleString()}**\n- Retained federated records: **${certification.retainedFederatedRecordCount.toLocaleString()}**\n`
    : '';
  return `# Data.gov spatial availability evidence

- Captured: ${report.capturedAt}
- Retained Data.gov records: **${report.totalRecords.toLocaleString()}**${expectedLine}
- Raw harvest metadata retained: **${report.harvestRecordRawPresent.toLocaleString()}**
- Explicit \`spatial\` token present: **${report.explicitSpatialTokenRecords.toLocaleString()}** (${report.explicitSpatialTokenPercent}%)
- Raw harvest metadata unavailable: **${report.rawHarvestUnavailable.toLocaleString()}**
${certificationBlock}
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
  const args = {
    expectedCount: null,
    outputDir: DEFAULT_OUTPUT_DIR,
    scaleEvidencePath: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--') {
      continue;
    }
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
    if (argument === '--scale-evidence') {
      const value = argv[index + 1]?.trim();
      if (!value) {
        throw new Error('--scale-evidence requires a JSON evidence path.');
      }
      args.scaleEvidencePath = value;
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
    throw new Error(
      `Unable to run Docker/PostgreSQL spatial probe: ${result.error.message}`,
      {
        cause: result.error,
      },
    );
  }
  if (result.status !== 0) {
    throw new Error(
      `Data.gov spatial probe failed (exit ${result.status}).\n${result.stderr || result.stdout}`,
    );
  }
  return result.stdout;
}

export async function run(argv = process.argv.slice(2)) {
  const { expectedCount, outputDir, scaleEvidencePath } = parseArgs(argv);
  const scaleCertification = scaleEvidencePath
    ? await loadScaleCertification(scaleEvidencePath)
    : null;
  const report = normalizeProbe(
    parsePsqlJson(runPsql(buildProbeSql())),
    new Date().toISOString(),
    scaleCertification,
  );
  const resolvedOutputDir = path.resolve(outputDir);
  await mkdir(resolvedOutputDir, { recursive: true });
  const jsonPath = path.join(
    resolvedOutputDir,
    'data-gov-spatial-availability.json',
  );
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

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} must be a non-empty string.`);
  }
  return value;
}

function sha256(value, name) {
  if (typeof value !== 'string' || !SHA256.test(value)) {
    throw new Error(`${name} must be a lowercase SHA-256 value.`);
  }
  return value;
}

const invokedDirectly =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  await run();
}
