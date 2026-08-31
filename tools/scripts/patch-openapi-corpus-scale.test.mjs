import assert from 'node:assert/strict';
import test from 'node:test';
import { upgradeRepositoryApiContract } from './patch-openapi-corpus-scale-idempotent.mjs';

const fixture = `openapi: 3.1.0
paths:
  /search/comparison/run:
    post:
      description: >-
        Both engines query projections built from the same normalized DSpace research-object set.
        Elapsed timings are local demo measurements and must not be presented as production
        benchmarks.
      requestBody:
        required: true
  /admin/reindex:
    get:
      tags: [Admin]
      operationId: getDiscoveryProjectionState
      summary: Get the current discovery projection state without rebuilding it.
      responses:
        '200':
          description: Discovery projection metadata.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DiscoveryProjectionState'
        '500':
          $ref: '#/components/responses/InternalServerError'
        '503':
          $ref: '#/components/responses/ServiceUnavailable'
    post:
      tags: [Admin]
      operationId: reindexDiscoveryProjection
      summary: Rebuild the discovery Solr projection from DSpace.
      responses:
        '202':
          description: Reindex accepted and completed.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DiscoveryProjectionState'
        '500':
          $ref: '#/components/responses/InternalServerError'
        '503':
          $ref: '#/components/responses/ServiceUnavailable'
  /admin/dspace/overview:
    get: {}
components:
  responses:
    BadRequest: {}
    NotFound:
      description: Resource not found.
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
    InternalServerError:
      description: Unexpected server error.
  schemas:
    CorpusProfile:
      type: string
      description: >-
        Stable local corpus profile. FEDERATED_10K/100K/1M describe target federated metadata counts
        in addition to the curated repository records; FULL has no fixed count.
      enum: [CURATED_DEMO, FEDERATED_10K, FEDERATED_100K, FEDERATED_1M, FULL]
    DeploymentTopology:
      type: string
`;

test('migration adds the proven corpus, progress, harvest, evidence, and execution-order contract', () => {
  const output = upgradeRepositoryApiContract(fixture);

  assert.match(output, /name: order/);
  assert.match(output, /SearchComparisonExecutionOrder/);
  assert.match(output, /\/admin\/reindex\/progress:/);
  assert.match(output, /\/admin\/corpus\/scale:/);
  assert.match(output, /\/admin\/corpus\/scale\/evidence:/);
  assert.match(output, /\/admin\/federation\/harvest\/status:/);
  assert.match(output, /CorpusProfileActivationProgress:/);
  assert.match(output, /CorpusScaleEvidenceReport:/);
  assert.match(output, /FederationHarvestStatusResponse:/);
  assert.match(output, /Conflict:/);
  assert.match(output, /enum: \[SOLR_FIRST, OPENSEARCH_FIRST\]/);
  assert.match(output, /enum: \[RUNNING, PAUSED, COMPLETED, FAILED, CANCELLED\]/);
  assert.equal(
    output.split("pattern: '^[0-9a-f]{64}$'").length - 1,
    3,
  );
  assert.equal(output.split('DeploymentTopology:').length - 1, 1);
});

test('migration is idempotent', () => {
  const once = upgradeRepositoryApiContract(fixture);
  const twice = upgradeRepositoryApiContract(once);

  assert.equal(twice, once);
});

test('migration refuses a partially migrated contract instead of calling it current', () => {
  const migrated = upgradeRepositoryApiContract(fixture);
  const corrupted = migrated.replace(
    "pattern: '^[0-9a-f]{64}$'",
    "pattern: '^[0-9a-f]{64}",
  );

  assert.throws(
    () => upgradeRepositoryApiContract(corrupted),
    /migration markers are present but the projection-id regex literals are invalid/,
  );
});

test('migration fails instead of guessing when a stale anchor no longer matches', () => {
  assert.throws(
    () => upgradeRepositoryApiContract(fixture.replace('Rebuild the discovery Solr projection from DSpace.', 'Changed elsewhere.')),
    /profile-aware reindex and corpus admin paths expected exactly one stale contract anchor/,
  );
});
