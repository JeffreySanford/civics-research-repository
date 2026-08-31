import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  upgradeRepositoryApiContract as upgradeOnce,
} from './patch-openapi-corpus-scale.mjs';

const DEFAULT_SCHEMA = 'schemas/openapi/repository-api.yaml';

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

function isFullyMigrated(source) {
  return MIGRATED_MARKERS.every((marker) => source.includes(marker));
}

export function upgradeRepositoryApiContract(input) {
  if (isFullyMigrated(input)) {
    return input;
  }
  return upgradeOnce(input);
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
