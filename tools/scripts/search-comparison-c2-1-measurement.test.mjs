import assert from 'node:assert/strict';
import test from 'node:test';
import { buildC21RestartExecutionPlan } from './search-comparison-c2-1-foundation.mjs';
import {
  C2_1_EXPECTED,
  sha256Json,
} from './search-comparison-c2-1-manifest.mjs';
import {
  C2_1_ADMITTED_TREATMENT,
  buildC21SemanticCells,
} from './search-comparison-c2-1-semantic-admission.mjs';
import {
  applyC21TimingContract,
  buildC21MeasurementCells,
  parseArguments,
  runC21MeasurementSuite,
  validateC21TimingAuthorization,
} from './search-comparison-c2-1-measurement.mjs';

function authorization(
  executionPlan = buildC21RestartExecutionPlan({
    restartBlocks: 1,
    batchesPerBlock: 2,
  }),
) {
  return {
    experiment: 'C2.1_ADVERSARIAL_STANDALONE',
    kind: 'preflight-authorization',
    status: 'READY',
    timingAllowed: true,
    comparativeClaimAllowed: false,
    repositoryCommit: 'a'.repeat(40),
    protocol: {
      path: 'planning/C2_ADVERSARIAL_VALIDATION_PROTOCOL.md',
      commit: 'b'.repeat(40),
      sha256: 'c'.repeat(64),
    },
    projectionId: C2_1_EXPECTED.projectionId,
    projectionObjectCount: C2_1_EXPECTED.projectionObjectCount,
    openSearchTreatment: C2_1_ADMITTED_TREATMENT,
    executionPlan,
    filterBands: [
      {
        band: 'BROAD',
        status: 'SELECTED',
        selected: {
          field: 'program',
          value: 'Energy Data',
          count: 500000,
          selectivityPercent: 49.99,
          normalizedIdentity: 'program=Energy Data',
        },
      },
    ],
    unavailableBands: [],
    manifestSha256: 'd'.repeat(64),
    semanticAdmissionSha256: 'e'.repeat(64),
  };
}

function benchmarkResult({ request, openSearchTreatment }) {
  return {
    kind: 'local-search-comparison-diagnostic',
    projection: {
      projectionId: C2_1_EXPECTED.projectionId,
      objectCount: C2_1_EXPECTED.projectionObjectCount,
    },
    openSearchTreatment,
    request,
    rawSamples: {
      apiElapsed: {
        solrMs: [10, 20, 30, 40, 50],
        openSearchMs: [12, 22, 32, 42, 52],
      },
      engineReported: {
        solrMs: [1, 2, 3, 4, 5],
        openSearchMs: [2, 3, 4, 5, 6],
      },
    },
    solr: { elapsed: {}, engineReported: {} },
    openSearch: { elapsed: {}, engineReported: {} },
  };
}

test('timing authorization must be READY and bound to C2.1 semantics', () => {
  const ready = authorization();

  assert.equal(validateC21TimingAuthorization(ready), ready);
  assert.throws(
    () =>
      validateC21TimingAuthorization({
        ...ready,
        status: 'REFUSED',
      }),
    /READY timing authorization/,
  );
  assert.throws(
    () =>
      validateC21TimingAuthorization({
        ...ready,
        openSearchTreatment: 'BASELINE_SCOPED_FILTERS',
      }),
    /C2_1_OPTIMIZED_EQUIVALENT/,
  );
  assert.throws(
    () =>
      validateC21TimingAuthorization({
        ...ready,
        semanticAdmissionSha256: null,
      }),
    /semantic-admission SHA-256/,
  );
});

test('measurement cells reuse the preregistered semantic matrix', () => {
  const ready = authorization();
  const cells = buildC21MeasurementCells(ready);
  const semanticCells = buildC21SemanticCells({ bands: ready.filterBands });

  assert.equal(cells.length, semanticCells.length);
  assert.equal(cells[0].id, 'Q01');
  assert.equal(cells[19].id, 'Q20');
  assert.equal(cells[20].id, 'FACETS');
  assert.equal(cells[21].id, 'FILTER_BROAD');
  assert.deepEqual(cells[21].request.programs, ['Energy Data']);
});

test('C2.1 timing contract adds p90 without changing the generic benchmark contract', () => {
  const result = applyC21TimingContract(
    benchmarkResult({
      request: { scenario: 'FACETED_SEARCH' },
      openSearchTreatment: C2_1_ADMITTED_TREATMENT,
    }),
  );

  assert.equal(result.c21PercentileContract, 'p50/p90/p95/p99');
  assert.equal(result.solr.elapsed.p50Ms, 30);
  assert.equal(result.solr.elapsed.p90Ms, 50);
  assert.equal(result.openSearch.engineReported.p90Ms, 6);
});

test('measurement suite routes every workload through block authorization and optimized treatment', async () => {
  const ready = authorization();
  const benchmarkCalls = [];
  const suite = await runC21MeasurementSuite({
    authorization: ready,
    warmupRuns: 1,
    measuredRuns: 1,
    recreateBetweenBlocks: false,
    runBenchmark: async (options) => {
      benchmarkCalls.push(options);
      return benchmarkResult(options);
    },
    now: () => new Date('2026-09-04T12:00:00Z'),
  });

  assert.equal(suite.acceptedC21Evidence, false);
  assert.equal(suite.restartBlocks.length, 1);
  assert.equal(suite.workloadMatrix.length, 22);
  assert.equal(benchmarkCalls.length, 22);
  assert.equal(benchmarkCalls[0].openSearchTreatment, C2_1_ADMITTED_TREATMENT);
  assert.deepEqual(
    benchmarkCalls[0].executionOrderPlan,
    ready.executionPlan.blocks[0].batchExecutionOrders,
  );
  assert.equal(
    suite.restartBlocks[0].preflightAuthorizationSha256,
    sha256Json(ready),
  );
});

test('accepted evidence path recreates and preflights each restart block', async () => {
  const plan = buildC21RestartExecutionPlan();
  const ready = authorization(plan);
  const recreatedBlocks = [];
  const preflightOutputs = [];
  const suite = await runC21MeasurementSuite({
    authorizePreflight: async (options) => {
      preflightOutputs.push(options.output);
      return { authorization: ready };
    },
    recreateStack: async ({ block }) => {
      recreatedBlocks.push(block.blockId);
    },
    runBenchmark: async (options) => benchmarkResult(options),
    warmupRuns: 1,
    measuredRuns: 1,
  });

  assert.equal(suite.acceptedC21Evidence, true);
  assert.deepEqual(recreatedBlocks, [1, 2, 3, 4]);
  assert.deepEqual(preflightOutputs, [
    'browser-evidence-artifacts/c2-1/restart-block-01/preflight-authorization.json',
    'browser-evidence-artifacts/c2-1/restart-block-02/preflight-authorization.json',
    'browser-evidence-artifacts/c2-1/restart-block-03/preflight-authorization.json',
    'browser-evidence-artifacts/c2-1/restart-block-04/preflight-authorization.json',
  ]);
  assert.equal(suite.restartBlocks.length, 4);
  assert.equal(suite.restartBlocks[0].workloads.length, 22);
  assert.equal(suite.restartBlocks[3].workloads.length, 22);
});

test('measurement suite refuses preflight execution-plan drift', async () => {
  const driftedPlan = buildC21RestartExecutionPlan({
    restartBlocks: 2,
    batchesPerBlock: 2,
  });

  await assert.rejects(
    runC21MeasurementSuite({
      authorizePreflight: async () => ({
        authorization: authorization(driftedPlan),
      }),
      recreateStack: async () => {},
      runBenchmark: async (options) => benchmarkResult(options),
      warmupRuns: 1,
      measuredRuns: 1,
    }),
    /execution plan drifted/,
  );
});

test('CLI parser keeps restarts enabled by default and supports smoke mode', () => {
  assert.deepEqual(parseArguments(['--warmups', '1', '--samples', '2']), {
    baseUrl: 'http://localhost:8080/api',
    output: 'browser-evidence-artifacts/c2-1/measurement-suite.json',
    warmupRuns: 1,
    measuredRuns: 2,
    recreateBetweenBlocks: true,
  });

  assert.equal(
    parseArguments(['--skip-restarts']).recreateBetweenBlocks,
    false,
  );
});
