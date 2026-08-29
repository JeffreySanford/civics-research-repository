import { readFile, writeFile } from 'node:fs/promises';

const schemaPath = 'schemas/openapi/repository-api.yaml';
let schema = await readFile(schemaPath, 'utf8');

function replaceOnce(source, needle, replacement) {
  const index = source.indexOf(needle);
  if (index < 0) {
    throw new Error(`OpenAPI patch anchor not found: ${needle.slice(0, 80)}`);
  }
  if (source.indexOf(needle, index + needle.length) >= 0) {
    throw new Error(`OpenAPI patch anchor is not unique: ${needle.slice(0, 80)}`);
  }
  return source.slice(0, index) + replacement + source.slice(index + needle.length);
}

if (!schema.includes('/search/comparison/scenarios:')) {
  schema = replaceOnce(
    schema,
    '  /datasets/{datasetId}:\n',
    `  /search/comparison/scenarios:\n    get:\n      tags: [Search]\n      operationId: listSearchComparisonScenarios\n      summary: List supported Solr/OpenSearch comparison scenarios.\n      responses:\n        '200':\n          description: Supported comparison scenarios.\n          content:\n            application/json:\n              schema:\n                type: array\n                items:\n                  $ref: '#/components/schemas/SearchComparisonScenario'\n        '500':\n          $ref: '#/components/responses/InternalServerError'\n  /search/comparison/run:\n    post:\n      tags: [Search]\n      operationId: runSearchComparison\n      summary: Run one normalized discovery query against Solr and OpenSearch.\n      description: >-\n        Both engines query projections built from the same normalized DSpace research-object set.\n        Elapsed timings are local demo measurements and must not be presented as production\n        benchmarks.\n      requestBody:\n        required: true\n        content:\n          application/json:\n            schema:\n              $ref: '#/components/schemas/SearchComparisonRequest'\n      responses:\n        '200':\n          description: Side-by-side engine results and projection parity evidence.\n          content:\n            application/json:\n              schema:\n                $ref: '#/components/schemas/SearchComparisonResponse'\n        '400':\n          $ref: '#/components/responses/BadRequest'\n        '500':\n          $ref: '#/components/responses/InternalServerError'\n        '503':\n          $ref: '#/components/responses/ServiceUnavailable'\n  /datasets/{datasetId}:\n`,
  );
}

if (!schema.includes('    SearchComparisonRequest:\n')) {
  schema = replaceOnce(
    schema,
    '    ResearchObjectDetail:\n',
    `    SearchComparisonScenarioId:\n      type: string\n      enum: [FACETED_SEARCH, FULL_TEXT_RELEVANCE, FILTERING]\n    SearchComparisonScenario:\n      type: object\n      required: [id, label, description]\n      properties:\n        id:\n          $ref: '#/components/schemas/SearchComparisonScenarioId'\n        label:\n          type: string\n        description:\n          type: string\n    SearchComparisonRequest:\n      type: object\n      required: [scenario]\n      properties:\n        scenario:\n          $ref: '#/components/schemas/SearchComparisonScenarioId'\n        query:\n          type: string\n          default: ''\n        programs:\n          type: array\n          items:\n            $ref: '#/components/schemas/ResearchProgram'\n        geography:\n          type: string\n        contentType:\n          $ref: '#/components/schemas/ResearchObjectType'\n        vintageYear:\n          type: integer\n          format: int32\n        page:\n          type: integer\n          minimum: 0\n          default: 0\n        pageSize:\n          type: integer\n          minimum: 1\n          maximum: 100\n          default: 10\n    SearchComparisonProjection:\n      type: object\n      required: [source, objectCount]\n      properties:\n        projectionId:\n          type: string\n          pattern: '^[0-9a-f]{64}$'\n          description: SHA-256 identity of the normalized DiscoveryDocument set supplied to the targets.\n        source:\n          $ref: '#/components/schemas/RepositorySource'\n        objectCount:\n          type: integer\n          minimum: 0\n        rebuiltAt:\n          type: string\n          format: date-time\n    SearchComparisonEngine:\n      type: string\n      enum: [SOLR, OPENSEARCH]\n    SearchEngineComparison:\n      type: object\n      required: [engine, enabled, reachable, indexName, elapsedMs, returnedHits, results, facets]\n      properties:\n        engine:\n          $ref: '#/components/schemas/SearchComparisonEngine'\n        enabled:\n          type: boolean\n        reachable:\n          type: boolean\n        indexName:\n          type: string\n        indexedDocumentCount:\n          type: integer\n          minimum: 0\n        elapsedMs:\n          type: integer\n          format: int64\n          minimum: 0\n          description: Local API elapsed time around the engine request, not a production benchmark.\n        totalHits:\n          type: integer\n          minimum: 0\n        returnedHits:\n          type: integer\n          minimum: 0\n        results:\n          type: array\n          items:\n            $ref: '#/components/schemas/SearchResult'\n        facets:\n          type: array\n          items:\n            $ref: '#/components/schemas/FacetGroup'\n        warning:\n          type: string\n    SearchComparisonResponse:\n      type: object\n      required: [scenario, projection, sameProjection, solr, openSearch]\n      properties:\n        scenario:\n          $ref: '#/components/schemas/SearchComparisonScenarioId'\n        projection:\n          $ref: '#/components/schemas/SearchComparisonProjection'\n        sameProjection:\n          type: boolean\n          description: True only when both enabled targets successfully received the current normalized projection and their document counts match it.\n        solr:\n          $ref: '#/components/schemas/SearchEngineComparison'\n        openSearch:\n          $ref: '#/components/schemas/SearchEngineComparison'\n    ResearchObjectDetail:\n`,
  );
}

const oldProjection = `    DiscoveryProjectionState:\n      type: object\n      required: [source, objectCount]\n      properties:\n        source:\n          $ref: '#/components/schemas/RepositorySource'\n        objectCount:\n          type: integer\n          minimum: 0\n        rebuiltAt:\n          type: string\n          format: date-time\n          description: When the projection was last rebuilt; absent before the first reindex.\n`;

if (!schema.includes('description: SHA-256 identity of the normalized document set used for the latest rebuild.')) {
  schema = replaceOnce(
    schema,
    oldProjection,
    `    DiscoveryProjectionState:\n      type: object\n      required: [source, objectCount]\n      properties:\n        source:\n          $ref: '#/components/schemas/RepositorySource'\n        objectCount:\n          type: integer\n          minimum: 0\n        projectionId:\n          type: string\n          pattern: '^[0-9a-f]{64}$'\n          description: SHA-256 identity of the normalized document set used for the latest rebuild.\n        rebuiltAt:\n          type: string\n          format: date-time\n          description: When the projection was last rebuilt; absent before the first reindex.\n`,
  );
}

await writeFile(schemaPath, schema);
