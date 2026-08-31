import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { upgradeRepositoryApiContract as upgradeOnce } from './patch-openapi-corpus-scale.mjs';

const DEFAULT_SCHEMA = 'schemas/openapi/repository-api.yaml';
const HASH_PATTERN_PREFIX = "pattern: '^[0-9a-f]{64}";
const HASH_PATTERN_LITERAL = "pattern: '^[0-9a-f]{64}$'";

const MIGRATED_MARKERS = [
  'name: order',
  '/admin/reindex/progress:',
  '/admin/corpus/scale:',
  '/admin/corpus/scale/evidence:',
  '/admin/federation/harvest/status:',
  'SearchComparisonExecutionOrder:',
  'CorpusProfileActivationProgress:',
  'CorpusScaleEvidenceReport:',
  'FederationHarvestStatusResponse:',
];

const NULLABILITY_REPLACEMENTS = [
  [
    `        operationId:\n          type: string\n`,
    `        operationId:\n          type: [string, 'null']\n`,
  ],
  [
    `        profile:\n          $ref: '#/components/schemas/CorpusProfile'\n        phase:\n`,
    `        profile:\n          oneOf:\n            - $ref: '#/components/schemas/CorpusProfile'\n            - type: 'null'\n        phase:\n`,
  ],
  [
    `        totalDocuments:\n          type: integer\n          format: int64\n          minimum: 0\n`,
    `        totalDocuments:\n          type: [integer, 'null']\n          format: int64\n          minimum: 0\n`,
  ],
  [
    `        startedAt:\n          type: string\n          format: date-time\n`,
    `        startedAt:\n          type: [string, 'null']\n          format: date-time\n`,
  ],
  [
    `        completedAt:\n          type: string\n          format: date-time\n`,
    `        completedAt:\n          type: [string, 'null']\n          format: date-time\n`,
  ],
  [
    `        documentsPerSecond:\n          type: number\n          format: double\n          minimum: 0\n`,
    `        documentsPerSecond:\n          type: [number, 'null']\n          format: double\n          minimum: 0\n`,
  ],
  [
    `        targetFederatedRecordCount:\n          type: integer\n          format: int64\n          minimum: 0\n`,
    `        targetFederatedRecordCount:\n          type: [integer, 'null']\n          format: int64\n          minimum: 0\n`,
  ],
  [
    `        activeProfile:\n          $ref: '#/components/schemas/CorpusProfile'\n        activationProjectionObjectCount:\n`,
    `        activeProfile:\n          oneOf:\n            - $ref: '#/components/schemas/CorpusProfile'\n            - type: 'null'\n        activationProjectionObjectCount:\n`,
  ],
  [
    `        activationProjectionObjectCount:\n          type: integer\n          format: int64\n          minimum: 0\n`,
    `        activationProjectionObjectCount:\n          type: [integer, 'null']\n          format: int64\n          minimum: 0\n`,
  ],
  [
    `        activationProjectionId:\n          type: string\n          pattern: '^[0-9a-f]{64}$'\n`,
    `        activationProjectionId:\n          type: [string, 'null']\n          pattern: '^[0-9a-f]{64}$'\n`,
  ],
  [
    `        currentProjectionId:\n          type: string\n          pattern: '^[0-9a-f]{64}$'\n`,
    `        currentProjectionId:\n          type: [string, 'null']\n          pattern: '^[0-9a-f]{64}$'\n`,
  ],
  [
    `        storageProjectionObjectCount:\n          type: integer\n          format: int64\n          minimum: 0\n`,
    `        storageProjectionObjectCount:\n          type: [integer, 'null']\n          format: int64\n          minimum: 0\n`,
  ],
  [
    `        storageRetainedFederatedCount:\n          type: integer\n          format: int64\n          minimum: 0\n`,
    `        storageRetainedFederatedCount:\n          type: [integer, 'null']\n          format: int64\n          minimum: 0\n`,
  ],
  [
    `        storageProjectionId:\n          type: string\n          pattern: '^[0-9a-f]{64}$'\n`,
    `        storageProjectionId:\n          type: [string, 'null']\n          pattern: '^[0-9a-f]{64}$'\n`,
  ],
  [
    `        storageCapturedAt:\n          type: string\n          format: date-time\n`,
    `        storageCapturedAt:\n          type: [string, 'null']\n          format: date-time\n`,
  ],
];

function hasMigratedMarkers(source) {
  return MIGRATED_MARKERS.every((marker) => source.includes(marker));
}

function hasOnlyLiteralHashPatterns(source) {
  const hashPatternLines = source
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith(HASH_PATTERN_PREFIX));

  return (
    hashPatternLines.length >= 3 &&
    hashPatternLines.every((line) => line === HASH_PATTERN_LITERAL)
  );
}

function replaceOptional(source, before, after) {
  if (source.includes(after)) {
    return source;
  }
  if (!source.includes(before)) {
    throw new Error(
      `Cannot normalize OpenAPI contract because an expected field shape is missing: ${before.split('\n')[0].trim()}.`,
    );
  }
  return source.replace(before, () => after);
}

function normalizeNullableRuntimeFields(input) {
  return NULLABILITY_REPLACEMENTS.reduce(
    (source, [before, after]) => replaceOptional(source, before, after),
    input,
  );
}

export function upgradeRepositoryApiContract(input) {
  let migrated = input;
  if (hasMigratedMarkers(input)) {
    if (!hasOnlyLiteralHashPatterns(input)) {
      throw new Error(
        'Corpus-scale OpenAPI migration markers are present but the projection-id regex literals are invalid. Restore schemas/openapi/repository-api.yaml from git before rerunning the migration.',
      );
    }
  } else {
    migrated = upgradeOnce(input);
  }

  return normalizeNullableRuntimeFields(migrated);
}

export async function patchRepositoryApiContract(schemaPath = DEFAULT_SCHEMA) {
  const path = resolve(schemaPath);
  const before = await readFile(path, 'utf8');
  const after = upgradeRepositoryApiContract(before);
  if (after === before) {
    return { path, changed: false };
  }
  await writeFile(path, after, 'utf8');
  return { path, changed: true };
}

async function main() {
  const schemaPath = process.argv[2] ?? DEFAULT_SCHEMA;
  const result = await patchRepositoryApiContract(schemaPath);
  console.log(
    result.changed
      ? `Updated corpus-scale OpenAPI contract: ${result.path}`
      : `Corpus-scale OpenAPI contract already current: ${result.path}`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
