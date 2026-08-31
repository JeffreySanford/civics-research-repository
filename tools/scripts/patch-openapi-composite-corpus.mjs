import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_SCHEMA = 'schemas/openapi/repository-api.yaml';

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) {
    return source;
  }
  const occurrences = source.split(before).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `${label} expected exactly one contract anchor but found ${occurrences}.`,
    );
  }
  return source.replace(before, () => after);
}

export function upgradeCompositeCorpusContract(input) {
  let source = input;

  source = replaceRequired(
    source,
    `  /admin/federation/harvest/status:\n`,
    `  /admin/federation/compositions:\n    get:\n      tags: [Admin]\n      operationId: listFederatedCompositeCorpusEvidence\n      summary: List recent immutable mixed-source corpus composition evidence.\n      parameters:\n        - name: corpusProfile\n          in: query\n          required: true\n          schema:\n            $ref: '#/components/schemas/CorpusProfile'\n        - name: limit\n          in: query\n          required: false\n          schema:\n            type: integer\n            minimum: 1\n            maximum: 1000\n            default: 20\n      responses:\n        '200':\n          description: Recent immutable composition manifests for the requested profile.\n          content:\n            application/json:\n              schema:\n                type: array\n                items:\n                  $ref: '#/components/schemas/FederatedCompositeCorpusManifest'\n        '400':\n          $ref: '#/components/responses/BadRequest'\n        '500':\n          $ref: '#/components/responses/InternalServerError'\n    post:\n      tags: [Admin]\n      operationId: captureFederatedCompositeCorpusEvidence\n      summary: Compose existing bounded source snapshots into one durable corpus identity.\n      description: >-\n        Captures composition evidence only from already-persisted bounded snapshots. Each requested\n        source quota must exactly match its selected snapshot and all quotas must sum to the named\n        corpus profile target. This does not activate a search projection.\n      requestBody:\n        required: true\n        content:\n          application/json:\n            schema:\n              $ref: '#/components/schemas/FederatedCompositeCorpusCaptureRequest'\n      responses:\n        '200':\n          description: Durable immutable composite corpus evidence.\n          content:\n            application/json:\n              schema:\n                $ref: '#/components/schemas/FederatedCompositeCorpusManifest'\n        '400':\n          $ref: '#/components/responses/BadRequest'\n        '500':\n          $ref: '#/components/responses/InternalServerError'\n  /admin/federation/compositions/{compositionSha256}:\n    get:\n      tags: [Admin]\n      operationId: getFederatedCompositeCorpusEvidence\n      summary: Resolve one exact immutable composition identity.\n      parameters:\n        - name: compositionSha256\n          in: path\n          required: true\n          schema:\n            type: string\n            pattern: '^[0-9a-f]{64}$'\n      responses:\n        '200':\n          description: Exact immutable composite corpus evidence.\n          content:\n            application/json:\n              schema:\n                $ref: '#/components/schemas/FederatedCompositeCorpusManifest'\n        '404':\n          $ref: '#/components/responses/NotFound'\n        '500':\n          $ref: '#/components/responses/InternalServerError'\n  /admin/federation/harvest/status:\n`,
    'composite corpus admin paths',
  );

  source = replaceRequired(
    source,
    `    FederatedSourceSystem:\n      type: string\n      enum: [DATA_GOV, DOE_OSTI, NASA_CMR, PUBMED, OPENALEX]\n`,
    `    FederatedCompositeCorpusSourceRequest:\n      type: object\n      required: [sourceSystem, requestedRecordCount, snapshotId]\n      properties:\n        sourceSystem:\n          $ref: '#/components/schemas/FederatedSourceSystem'\n        requestedRecordCount:\n          type: integer\n          format: int64\n          minimum: 1\n        snapshotId:\n          type: string\n          minLength: 1\n    FederatedCompositeCorpusCaptureRequest:\n      type: object\n      required: [corpusProfile, sources]\n      properties:\n        corpusProfile:\n          $ref: '#/components/schemas/CorpusProfile'\n        sources:\n          type: array\n          minItems: 2\n          items:\n            $ref: '#/components/schemas/FederatedCompositeCorpusSourceRequest'\n    FederatedCompositeCorpusSource:\n      type: object\n      required:\n        - sourceSystem\n        - requestedRecordCount\n        - snapshotId\n        - runId\n        - runAdapterVersion\n        - recordAdapterVersions\n        - retainedRecordCount\n        - sha256\n        - snapshotCapturedAt\n      properties:\n        sourceSystem:\n          $ref: '#/components/schemas/FederatedSourceSystem'\n        requestedRecordCount:\n          type: integer\n          format: int64\n          minimum: 1\n        snapshotId:\n          type: string\n        runId:\n          type: string\n        runAdapterVersion:\n          type: string\n        recordAdapterVersions:\n          type: array\n          items:\n            type: string\n        retainedRecordCount:\n          type: integer\n          format: int64\n          minimum: 1\n        sha256:\n          type: string\n          pattern: '^[0-9a-f]{64}$'\n        snapshotCapturedAt:\n          type: string\n          format: date-time\n    FederatedCompositeCorpusManifest:\n      type: object\n      required:\n        - compositionVersion\n        - mode\n        - corpusProfile\n        - sources\n        - federatedRecordCount\n        - compositionSha256\n        - capturedAt\n      properties:\n        compositionVersion:\n          type: string\n        mode:\n          type: string\n          enum: [COMPOSITE_SNAPSHOT]\n        corpusProfile:\n          $ref: '#/components/schemas/CorpusProfile'\n        sources:\n          type: array\n          minItems: 2\n          items:\n            $ref: '#/components/schemas/FederatedCompositeCorpusSource'\n        federatedRecordCount:\n          type: integer\n          format: int64\n          minimum: 2\n        compositionSha256:\n          type: string\n          pattern: '^[0-9a-f]{64}$'\n        capturedAt:\n          type: string\n          format: date-time\n    FederatedSourceSystem:\n      type: string\n      enum: [DATA_GOV, DOE_OSTI, NASA_CMR, PUBMED, OPENALEX]\n`,
    'composite corpus schemas',
  );

  return source;
}

export async function patchCompositeCorpusContract(schemaPath = DEFAULT_SCHEMA) {
  const path = resolve(schemaPath);
  const before = await readFile(path, 'utf8');
  const after = upgradeCompositeCorpusContract(before);
  if (after === before) {
    return { path, changed: false };
  }
  await writeFile(path, after, 'utf8');
  return { path, changed: true };
}

async function main() {
  const schemaPath = process.argv[2] ?? DEFAULT_SCHEMA;
  const result = await patchCompositeCorpusContract(schemaPath);
  console.log(
    result.changed
      ? `Updated composite-corpus OpenAPI contract: ${result.path}`
      : `Composite-corpus OpenAPI contract already current: ${result.path}`,
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
