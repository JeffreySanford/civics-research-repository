import { readFile, writeFile } from 'node:fs/promises';

const OPENAPI_PATH = 'schemas/openapi/repository-api.yaml';

let source = await readFile(OPENAPI_PATH, 'utf8');

const pathsAnchor = '  /admin/federation/harvest/status:\n';
if (!source.includes('  /admin/spatial/datagov/status:\n')) {
  if (!source.includes(pathsAnchor)) {
    throw new Error(`Missing OpenAPI paths anchor: ${pathsAnchor.trim()}`);
  }
  source = source.replace(
    pathsAnchor,
    () => `  /admin/spatial/datagov/status:\n    get:\n      tags: [Admin]\n      operationId: getDataGovSpatialSidecarStatus\n      summary: Inspect the active Data.gov spatial sidecar build\n      responses:\n        '200':\n          description: Active sidecar build and row count, if one has been activated.\n          content:\n            application/json:\n              schema:\n                $ref: '#/components/schemas/DataGovSpatialSidecarStatusResponse'\n        '500':\n          $ref: '#/components/responses/InternalServerError'\n  /admin/spatial/datagov/rebuild:\n    post:\n      tags: [Admin]\n      operationId: rebuildDataGovSpatialSidecar\n      summary: Rebuild and atomically activate the retained-C2 Data.gov spatial sidecar\n      description: >-\n        Traverses the current Data.gov geospatial subset, preserves publisher spatial_shape geometry,\n        filters persistence to retained C2 Data.gov identities, stamps the active composition/projection\n        identity, and activates the new build only after the full traversal succeeds. A personal\n        Data.gov API key and the exact active FEDERATED_1M corpus are required.\n      requestBody:\n        required: false\n        content:\n          application/json:\n            schema:\n              $ref: '#/components/schemas/DataGovSpatialSidecarRebuildRequest'\n      responses:\n        '200':\n          description: Completed and activated Data.gov spatial sidecar build.\n          content:\n            application/json:\n              schema:\n                $ref: '#/components/schemas/DataGovSpatialSidecarRefreshResult'\n        '400':\n          $ref: '#/components/responses/BadRequest'\n        '409':\n          $ref: '#/components/responses/Conflict'\n        '500':\n          $ref: '#/components/responses/InternalServerError'\n${pathsAnchor}`,
  );
}

const schemasAnchor = '    FederatedSourceSystem:\n';
if (!source.includes('    DataGovSpatialSidecarStatusResponse:\n')) {
  if (!source.includes(schemasAnchor)) {
    throw new Error(`Missing OpenAPI schemas anchor: ${schemasAnchor.trim()}`);
  }
  source = source.replace(
    schemasAnchor,
    () => `    ResearchSpatialSidecarBuildStatus:\n      type: string\n      enum: [RUNNING, COMPLETE, FAILED]\n    ResearchSpatialSidecarBuild:\n      type: object\n      required:\n        - buildId\n        - sourceSystem\n        - schemaVersion\n        - sourceSnapshotAt\n        - capturedAt\n        - compositionSha256\n        - projectionId\n        - status\n        - rowCount\n      properties:\n        buildId:\n          type: string\n        sourceSystem:\n          $ref: '#/components/schemas/FederatedSourceSystem'\n        schemaVersion:\n          type: integer\n          minimum: 1\n        sourceSnapshotAt:\n          type: string\n          format: date-time\n        capturedAt:\n          type: string\n          format: date-time\n        compositionSha256:\n          type: string\n          pattern: '^[0-9a-f]{64}$'\n        projectionId:\n          type: string\n          pattern: '^[0-9a-f]{64}$'\n        status:\n          $ref: '#/components/schemas/ResearchSpatialSidecarBuildStatus'\n        rowCount:\n          type: integer\n          format: int64\n          minimum: 0\n        failureMessage:\n          type: [string, 'null']\n        completedAt:\n          type: [string, 'null']\n          format: date-time\n    DataGovSpatialSidecarRebuildRequest:\n      type: object\n      properties:\n        pageSize:\n          type: integer\n          minimum: 1\n          maximum: 1000\n          default: 1000\n        maxPages:\n          type: integer\n          minimum: 1\n          maximum: 2000\n          default: 2000\n    DataGovSpatialSidecarRefreshResult:\n      type: object\n      required:\n        - build\n        - pagesFetched\n        - sourceRowsFetched\n        - publisherShapeRows\n        - retainedRows\n        - sourceQuarantinedShapeRows\n      properties:\n        build:\n          $ref: '#/components/schemas/ResearchSpatialSidecarBuild'\n        pagesFetched:\n          type: integer\n          minimum: 0\n        sourceRowsFetched:\n          type: integer\n          format: int64\n          minimum: 0\n        publisherShapeRows:\n          type: integer\n          format: int64\n          minimum: 0\n        retainedRows:\n          type: integer\n          format: int64\n          minimum: 0\n        sourceQuarantinedShapeRows:\n          type: integer\n          format: int64\n          minimum: 0\n    DataGovSpatialSidecarStatusResponse:\n      type: object\n      required: [activeRowCount]\n      properties:\n        activeBuild:\n          oneOf:\n            - $ref: '#/components/schemas/ResearchSpatialSidecarBuild'\n            - type: 'null'\n        activeRowCount:\n          type: integer\n          format: int64\n          minimum: 0\n${schemasAnchor}`,
  );
}

source = source
  .replace(
    `        failureMessage:\n          type: string\n          nullable: true`,
    `        failureMessage:\n          type: [string, 'null']`,
  )
  .replace(
    `        completedAt:\n          type: string\n          format: date-time\n          nullable: true`,
    `        completedAt:\n          type: [string, 'null']\n          format: date-time`,
  )
  .replace(
    `        activeBuild:\n          allOf:\n            - $ref: '#/components/schemas/ResearchSpatialSidecarBuild'\n          nullable: true`,
    `        activeBuild:\n          oneOf:\n            - $ref: '#/components/schemas/ResearchSpatialSidecarBuild'\n            - type: 'null'`,
  );

await writeFile(OPENAPI_PATH, source);
