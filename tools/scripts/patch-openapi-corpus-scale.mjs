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
      `${label} expected exactly one stale contract anchor but found ${occurrences}.`,
    );
  }
  return source.replace(before, () => after);
}

export function upgradeRepositoryApiContract(input) {
  let source = input;

  source = replaceRequired(
    source,
    `      description: >-\n        Both engines query projections built from the same normalized DSpace research-object set.\n        Elapsed timings are local demo measurements and must not be presented as production\n        benchmarks.\n      requestBody:\n`,
    `      description: >-\n        Both engines query the same deterministic active discovery projection. Elapsed timings are\n        local diagnostic measurements and must not be presented as universal production benchmarks.\n        The optional execution order exists so controlled experiments can detect ordering effects.\n      parameters:\n        - name: order\n          in: query\n          required: false\n          description: Engine invocation order for controlled local diagnostics; defaults to SOLR_FIRST.\n          schema:\n            $ref: '#/components/schemas/SearchComparisonExecutionOrder'\n      requestBody:\n`,
    'search comparison execution order',
  );

  source = replaceRequired(
    source,
    `  /admin/reindex:\n    get:\n      tags: [Admin]\n      operationId: getDiscoveryProjectionState\n      summary: Get the current discovery projection state without rebuilding it.\n      responses:\n        '200':\n          description: Discovery projection metadata.\n          content:\n            application/json:\n              schema:\n                $ref: '#/components/schemas/DiscoveryProjectionState'\n        '500':\n          $ref: '#/components/responses/InternalServerError'\n        '503':\n          $ref: '#/components/responses/ServiceUnavailable'\n    post:\n      tags: [Admin]\n      operationId: reindexDiscoveryProjection\n      summary: Rebuild the discovery Solr projection from DSpace.\n      responses:\n        '202':\n          description: Reindex accepted and completed.\n          content:\n            application/json:\n              schema:\n                $ref: '#/components/schemas/DiscoveryProjectionState'\n        '500':\n          $ref: '#/components/responses/InternalServerError'\n        '503':\n          $ref: '#/components/responses/ServiceUnavailable'\n`,
    `  /admin/reindex:\n    get:\n      tags: [Admin]\n      operationId: getDiscoveryProjectionState\n      summary: Get the current discovery projection state without rebuilding it.\n      responses:\n        '200':\n          description: Discovery projection metadata.\n          content:\n            application/json:\n              schema:\n                $ref: '#/components/schemas/DiscoveryProjectionState'\n        '500':\n          $ref: '#/components/responses/InternalServerError'\n        '503':\n          $ref: '#/components/responses/ServiceUnavailable'\n    post:\n      tags: [Admin]\n      operationId: reindexDiscoveryProjection\n      summary: Activate or rebuild a deterministic discovery corpus profile.\n      description: >-\n        Rebuilds Solr and OpenSearch from the normalized records belonging to the requested corpus\n        profile and persists a named activation only after projection parity succeeds. When profile is\n        omitted, the currently active profile is rebuilt; before any activation exists that resolves\n        to CURATED_DEMO. This endpoint currently returns after activation completes even though its\n        historical HTTP status remains 202.\n      parameters:\n        - name: profile\n          in: query\n          required: false\n          schema:\n            $ref: '#/components/schemas/CorpusProfile'\n      responses:\n        '202':\n          description: Profile activation/rebuild completed and the resulting projection state is returned.\n          content:\n            application/json:\n              schema:\n                $ref: '#/components/schemas/DiscoveryProjectionState'\n        '400':\n          $ref: '#/components/responses/BadRequest'\n        '500':\n          $ref: '#/components/responses/InternalServerError'\n        '503':\n          $ref: '#/components/responses/ServiceUnavailable'\n  /admin/reindex/progress:\n    get:\n      tags: [Admin]\n      operationId: getCorpusProfileActivationProgress\n      summary: Get live progress for the current or most recent corpus-profile activation.\n      responses:\n        '200':\n          description: Operator-facing activation progress.\n          content:\n            application/json:\n              schema:\n                $ref: '#/components/schemas/CorpusProfileActivationProgress'\n        '500':\n          $ref: '#/components/responses/InternalServerError'\n  /admin/corpus/scale:\n    post:\n      tags: [Admin]\n      operationId: startCorpusProfileScale\n      summary: Start guarded asynchronous growth and activation of a supported corpus profile.\n      description: >-\n        Starts the durable harvest/snapshot/projection/evidence workflow. FEDERATED_100K is the\n        currently supported growth target; retained publisher metadata is reused when already present.\n      parameters:\n        - name: profile\n          in: query\n          required: true\n          schema:\n            $ref: '#/components/schemas/CorpusProfile'\n      responses:\n        '202':\n          description: Scale operation accepted; poll the reindex progress endpoint for completion.\n          content:\n            application/json:\n              schema:\n                $ref: '#/components/schemas/CorpusProfileActivationProgress'\n        '400':\n          $ref: '#/components/responses/BadRequest'\n        '409':\n          $ref: '#/components/responses/Conflict'\n  /admin/corpus/scale/evidence:\n    get:\n      tags: [Admin]\n      operationId: getCorpusScaleEvidence\n      summary: Verify the current evidence chain for a named corpus profile without mutating state.\n      parameters:\n        - name: profile\n          in: query\n          required: true\n          schema:\n            $ref: '#/components/schemas/CorpusProfile'\n      responses:\n        '200':\n          description: Read-only corpus evidence report and any detected violations.\n          content:\n            application/json:\n              schema:\n                $ref: '#/components/schemas/CorpusScaleEvidenceReport'\n        '400':\n          $ref: '#/components/responses/BadRequest'\n        '500':\n          $ref: '#/components/responses/InternalServerError'\n  /admin/federation/harvest/status:\n    get:\n      tags: [Admin]\n      operationId: getFederationHarvestStatus\n      summary: Inspect retained metadata and the durable harvest checkpoint for one federated source.\n      parameters:\n        - name: sourceSystem\n          in: query\n          required: true\n          schema:\n            $ref: '#/components/schemas/FederatedSourceSystem'\n      responses:\n        '200':\n          description: Source-scoped retained count plus resumable/latest durable run metadata.\n          content:\n            application/json:\n              schema:\n                $ref: '#/components/schemas/FederationHarvestStatusResponse'\n        '400':\n          $ref: '#/components/responses/BadRequest'\n        '500':\n          $ref: '#/components/responses/InternalServerError'\n`,
    'profile-aware reindex and corpus admin paths',
  );

  source = replaceRequired(
    source,
    `    NotFound:\n      description: Resource not found.\n      content:\n        application/json:\n          schema:\n            $ref: '#/components/schemas/ErrorResponse'\n    InternalServerError:\n`,
    `    NotFound:\n      description: Resource not found.\n      content:\n        application/json:\n          schema:\n            $ref: '#/components/schemas/ErrorResponse'\n    Conflict:\n      description: The requested operator action conflicts with current runtime state.\n      content:\n        application/json:\n          schema:\n            $ref: '#/components/schemas/ErrorResponse'\n    InternalServerError:\n`,
    'conflict response',
  );

  source = replaceRequired(
    source,
    `    CorpusProfile:\n      type: string\n      description: >-\n        Stable local corpus profile. FEDERATED_10K/100K/1M describe target federated metadata counts\n        in addition to the curated repository records; FULL has no fixed count.\n      enum: [CURATED_DEMO, FEDERATED_10K, FEDERATED_100K, FEDERATED_1M, FULL]\n    DeploymentTopology:\n`,
    `    CorpusProfile:\n      type: string\n      description: >-\n        Stable local corpus profile. FEDERATED_10K/100K/1M describe target federated metadata counts\n        in addition to the curated repository records; FULL has no fixed count.\n      enum: [CURATED_DEMO, FEDERATED_10K, FEDERATED_100K, FEDERATED_1M, FULL]\n    SearchComparisonExecutionOrder:\n      type: string\n      description: Invocation order used by a controlled Solr/OpenSearch comparison request.\n      enum: [SOLR_FIRST, OPENSEARCH_FIRST]\n    CorpusProfileActivationPhase:\n      type: string\n      enum:\n        - IDLE\n        - PREPARING\n        - HARVESTING\n        - SNAPSHOTTING\n        - PROJECTING\n        - VERIFYING\n        - CAPTURING_EVIDENCE\n        - COMPLETED\n        - FAILED\n    CorpusProfileActivationProgress:\n      type: object\n      required:\n        - phase\n        - processedDocuments\n        - percentComplete\n        - updatedAt\n        - elapsedMs\n        - message\n      properties:\n        operationId:\n          type: string\n        profile:\n          $ref: '#/components/schemas/CorpusProfile'\n        phase:\n          $ref: '#/components/schemas/CorpusProfileActivationPhase'\n        processedDocuments:\n          type: integer\n          format: int64\n          minimum: 0\n        totalDocuments:\n          type: integer\n          format: int64\n          minimum: 0\n        percentComplete:\n          type: integer\n          minimum: 0\n          maximum: 100\n        startedAt:\n          type: string\n          format: date-time\n        updatedAt:\n          type: string\n          format: date-time\n        completedAt:\n          type: string\n          format: date-time\n        elapsedMs:\n          type: integer\n          format: int64\n          minimum: 0\n        documentsPerSecond:\n          type: number\n          format: double\n          minimum: 0\n        message:\n          type: string\n    CorpusScaleEvidenceReport:\n      type: object\n      required:\n        - profile\n        - valid\n        - retainedFederatedRecordCount\n        - currentProjectionObjectCount\n        - targetParity\n        - storageEvidencePresent\n        - violations\n      properties:\n        profile:\n          $ref: '#/components/schemas/CorpusProfile'\n        valid:\n          type: boolean\n        targetFederatedRecordCount:\n          type: integer\n          format: int64\n          minimum: 0\n        retainedFederatedRecordCount:\n          type: integer\n          format: int64\n          minimum: 0\n        activeProfile:\n          $ref: '#/components/schemas/CorpusProfile'\n        activationProjectionObjectCount:\n          type: integer\n          format: int64\n          minimum: 0\n        activationProjectionId:\n          type: string\n          pattern: '^[0-9a-f]{64}$'\n        currentProjectionObjectCount:\n          type: integer\n          minimum: 0\n        currentProjectionId:\n          type: string\n          pattern: '^[0-9a-f]{64}$'\n        targetParity:\n          type: boolean\n        storageEvidencePresent:\n          type: boolean\n        storageProjectionObjectCount:\n          type: integer\n          format: int64\n          minimum: 0\n        storageRetainedFederatedCount:\n          type: integer\n          format: int64\n          minimum: 0\n        storageProjectionId:\n          type: string\n          pattern: '^[0-9a-f]{64}$'\n        storageCapturedAt:\n          type: string\n          format: date-time\n        violations:\n          type: array\n          items:\n            type: string\n    FederatedSourceSystem:\n      type: string\n      enum: [DATA_GOV, DOE_OSTI, NASA_CMR, PUBMED, OPENALEX]\n    HarvestRunStatus:\n      type: string\n      enum: [RUNNING, PAUSED, COMPLETED, FAILED, CANCELLED]\n    FederationHarvestResponse:\n      type: object\n      required:\n        - runId\n        - sourceSystem\n        - adapterVersion\n        - status\n        - pageSize\n        - pageCount\n        - acceptedCount\n        - rejectedCount\n        - skippedCount\n        - startedAt\n        - updatedAt\n        - projectionRefreshRequired\n      properties:\n        runId:\n          type: string\n        sourceSystem:\n          $ref: '#/components/schemas/FederatedSourceSystem'\n        adapterVersion:\n          type: string\n        status:\n          $ref: '#/components/schemas/HarvestRunStatus'\n        pageSize:\n          type: integer\n          minimum: 1\n        pageCount:\n          type: integer\n          minimum: 0\n        acceptedCount:\n          type: integer\n          format: int64\n          minimum: 0\n        rejectedCount:\n          type: integer\n          format: int64\n          minimum: 0\n        skippedCount:\n          type: integer\n          format: int64\n          minimum: 0\n        cursor:\n          type: string\n        startedAt:\n          type: string\n          format: date-time\n        updatedAt:\n          type: string\n          format: date-time\n        completedAt:\n          type: string\n          format: date-time\n        failureMessage:\n          type: string\n        projectionRefreshRequired:\n          type: boolean\n    FederationHarvestStatusResponse:\n      type: object\n      required: [sourceSystem, retainedRecordCount]\n      properties:\n        sourceSystem:\n          $ref: '#/components/schemas/FederatedSourceSystem'\n        retainedRecordCount:\n          type: integer\n          format: int64\n          minimum: 0\n        resumableRun:\n          $ref: '#/components/schemas/FederationHarvestResponse'\n        latestRun:\n          $ref: '#/components/schemas/FederationHarvestResponse'\n    DeploymentTopology:\n`,
    'corpus scale and harvest schemas',
  );

  return source;
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
