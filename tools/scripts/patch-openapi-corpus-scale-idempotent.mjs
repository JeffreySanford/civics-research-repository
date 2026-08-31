import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  upgradeRepositoryApiContract as upgradeOnce,
} from './patch-openapi-corpus-scale.mjs';

const DEFAULT_SCHEMA = 'schemas/openapi/repository-api.yaml';
const SCHEMA_SUFFIX_ANCHOR = '    DeploymentTopology:\n';
const HASH_PATTERN_PREFIX = "          pattern: '^[0-9a-f]{64}";
const HASH_PATTERN_LITERAL = "          pattern: '^[0-9a-f]{64}$'";

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

function countOccurrences(source, value) {
  return source.split(value).length - 1;
}

function hasMigratedMarkers(source) {
  return MIGRATED_MARKERS.every((marker) => source.includes(marker));
}

function hasOnlyLiteralHashPatterns(source) {
  const prefixCount = countOccurrences(source, HASH_PATTERN_PREFIX);
  const literalCount = countOccurrences(source, HASH_PATTERN_LITERAL);
  return literalCount >= 3 && prefixCount === literalCount;
}

function isFullyMigrated(source) {
  return hasMigratedMarkers(source) && hasOnlyLiteralHashPatterns(source);
}

function repairLiteralReplacementExpansion(input, migrated) {
  const corpusIndex = input.indexOf('    CorpusProfile:\n');
  const suffixAnchorIndex = input.indexOf(
    SCHEMA_SUFFIX_ANCHOR,
    Math.max(0, corpusIndex),
  );
  if (corpusIndex < 0 || suffixAnchorIndex < 0) {
    throw new Error(
      'Cannot locate the corpus schema suffix needed for literal-safe OpenAPI migration.',
    );
  }

  const suffix = input.slice(
    suffixAnchorIndex + SCHEMA_SUFFIX_ANCHOR.length,
  );
  const expandedPattern = `${HASH_PATTERN_PREFIX}${suffix}`;
  const pieces = migrated.split(expandedPattern);
  const repairs = pieces.length - 1;

  if (repairs !== 3) {
    throw new Error(
      `Expected to repair 3 literal projection-id regex patterns but found ${repairs}.`,
    );
  }

  return pieces.join(HASH_PATTERN_LITERAL);
}

export function upgradeRepositoryApiContract(input) {
  if (isFullyMigrated(input)) {
    return input;
  }
  if (hasMigratedMarkers(input)) {
    throw new Error(
      'Corpus-scale OpenAPI migration markers are present but the projection-id regex literals are invalid. Restore schemas/openapi/repository-api.yaml from git before rerunning the migration.',
    );
  }

  return repairLiteralReplacementExpansion(input, upgradeOnce(input));
}

export async function patchRepositoryApiContract(
  schemaPath = DEFAULT_SCHEMA,
) {
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
