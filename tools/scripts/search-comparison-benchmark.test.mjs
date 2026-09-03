import assert from 'node:assert/strict';
import test from 'node:test';
import './search-comparison-100k-matrix.test.mjs';
import './search-comparison-100k-adaptive.test.mjs';
import './search-comparison-100k-order-pair.test.mjs';
import './search-comparison-statistics.test.mjs';
import './search-comparison-concurrency.test.mjs';
import './opensearch-aggregation-shape-diagnostic.test.mjs';
import './research-performance-report.test.mjs';
import './research-scale-preflight.test.mjs';
import './research-scale-runner.test.mjs';
import './federation-sample-all.test.mjs';
import {
  buildExecutionOrderPlan,
  nearestRankPercentile,
  parseArguments,
  runSearchComparisonBenchmark,
  summarizeTimingSamples,
} from './search-comparison-benchmark.mjs';

const PROJECTION_ID = 'a'.repeat(64);

function comparisonResponse(
  solrElapsedMs,
  openSearchElapsedMs,
  projectionId = PROJECTION_ID,
) {
  return {
    scenario: 'FULL_TEXT_RELEVANCE',
    projection: {
      projectionId,
      source: 'REPOSITORY',
      objectCount: 181,
      rebuiltAt: '2026-08-29T20:00:00Z',
    },
    sameProjection: true,
    solr: {
      engine: 'SOLR',
      enabled: true,
      reachable: true,
      indexName: 'discovery',
      elapsedMs: solrElapsedMs,
      engineReportedMs: solrElapsedMs,
      returnedHits: 2,
      results: [],
      facets: [],
    },
    openSearch: {
      engine: 'OPENSEARCH',
      enabled: true,
      reachable: true,
      indexName: 'discovery-comparison',
      elapsedMs: openSearchElapsedMs,
      engineReportedMs: openSearchElapsedMs,
      returnedHits: 2,
      results: [],
      facets: [],
    },
  };
}

function queuedFetch(responses, requests = []) {
  let index = 0;
  return async (url, init) => {
    requests.push({ url, init });
    const response = responses[index];
    index += 1;
    if (!response) {
      throw new Error('Unexpected extra benchmark request.');
    }
    return {
      ok: true,
      status: 200,
      async json() {
        return response;
      },
    };
  };
}

test('nearest-rank percentiles and summary are deterministic', () => {
  const values = [50, 10, 30, 20, 40];

  assert.equal(nearestRankPercentile(values, 0.5), 30);
  assert.equal(nearestRankPercentile(values, 0.95), 50);
  assert.deepEqual(summarizeTimingSamples(values), {
    sampleCount: 5,
    minMs: 10,
    p50Ms: 30,
    p95Ms: 50,
    p99Ms: 50,
    maxMs: 50,
    meanMs: 30,
  });
});

test('CLI parser accepts a conventional standalone argument separator and order', () => {
  const options = parseArguments([
    '--',
    '--warmups',
    '5',
    '--samples',
    '100',
    '--order',
    'OPENSEARCH_FIRST',
    '--batches',
    '3',
    '--order-strategy',
    'ALTERNATE',
    '--seed',
    '1234',
    '--query',
    'North Dakota workforce',
  ]);

  assert.equal(options.warmupRuns, 5);
  assert.equal(options.measuredRuns, 100);
  assert.equal(options.executionOrder, 'OPENSEARCH_FIRST');
  assert.equal(options.batches, 3);
  assert.equal(options.orderStrategy, 'ALTERNATE');
  assert.equal(options.seed, 1234);
  assert.equal(options.query, 'North Dakota workforce');
});

test('execution order plans support fixed, alternating and seeded randomized batches', () => {
  assert.deepEqual(
    buildExecutionOrderPlan({
      batches: 3,
      executionOrder: 'SOLR_FIRST',
      orderStrategy: 'FIXED',
    }),
    ['SOLR_FIRST', 'SOLR_FIRST', 'SOLR_FIRST'],
  );
  assert.deepEqual(
    buildExecutionOrderPlan({
      batches: 4,
      executionOrder: 'OPENSEARCH_FIRST',
      orderStrategy: 'ALTERNATE',
    }),
    ['OPENSEARCH_FIRST', 'SOLR_FIRST', 'OPENSEARCH_FIRST', 'SOLR_FIRST'],
  );
  assert.deepEqual(
    buildExecutionOrderPlan({
      batches: 5,
      executionOrder: 'SOLR_FIRST',
      orderStrategy: 'RANDOMIZED',
      seed: 42,
    }),
    [
      'SOLR_FIRST',
      'OPENSEARCH_FIRST',
      'SOLR_FIRST',
      'SOLR_FIRST',
      'OPENSEARCH_FIRST',
    ],
  );
});

test('benchmark excludes warmups and reports measured distributions only', async () => {
  const requests = [];
  const responses = [
    comparisonResponse(900, 800),
    comparisonResponse(700, 600),
    comparisonResponse(10, 12),
    comparisonResponse(20, 22),
    comparisonResponse(30, 32),
    comparisonResponse(40, 42),
    comparisonResponse(50, 52),
  ];

  const result = await runSearchComparisonBenchmark({
    fetchImpl: queuedFetch(responses, requests),
    baseUrl: 'http://repository.test/api/',
    warmupRuns: 2,
    measuredRuns: 5,
    executionOrder: 'OPENSEARCH_FIRST',
    now: () => new Date('2026-08-29T20:30:00Z'),
  });

  assert.equal(requests.length, 7);
  assert.equal(
    requests[0].url,
    'http://repository.test/api/search/comparison/run?order=OPENSEARCH_FIRST',
  );
  assert.equal(requests[0].init.method, 'POST');
  assert.equal(result.projection.projectionId, PROJECTION_ID);
  assert.equal(result.warmupRuns, 2);
  assert.equal(result.measuredRuns, 5);
  assert.equal(result.batches, 1);
  assert.equal(result.totalMeasuredRuns, 5);
  assert.deepEqual(result.executionPlan.batchExecutionOrders, [
    'OPENSEARCH_FIRST',
  ]);
  assert.equal(result.solr.elapsed.minMs, 10);
  assert.equal(result.solr.elapsed.p50Ms, 30);
  assert.equal(result.solr.elapsed.p95Ms, 50);
  assert.equal(result.solr.elapsed.maxMs, 50);
  assert.equal(result.openSearch.elapsed.minMs, 12);
  assert.equal(result.openSearch.elapsed.p50Ms, 32);
  assert.equal(result.openSearch.elapsed.p95Ms, 52);
  assert.equal(result.openSearch.elapsed.maxMs, 52);
  assert.equal(result.solr.engineReported.sampleCount, 5);
  assert.equal(result.solr.engineReported.p50Ms, 30);
  assert.equal(result.openSearch.engineReported.p95Ms, 52);
  assert.deepEqual(result.rawSamples.apiElapsed.solrMs, [10, 20, 30, 40, 50]);
  assert.deepEqual(
    result.rawSamples.apiElapsed.openSearchMs,
    [12, 22, 32, 42, 52],
  );
  assert.equal(result.pairedStatistics.apiElapsed.medianDifferenceMs, 2);
  assert.equal(result.pairedStatistics.apiElapsed.solrWinRatePercent, 100);
  assert.equal(result.pairedStatistics.apiElapsed.bootstrap.lowerMs, 2);
  assert.equal(result.pairedStatistics.apiElapsed.bootstrap.upperMs, 2);
  assert.equal(result.pairedStatistics.apiElapsed.bootstrap.excludesZero, true);
  assert.equal(result.comparativeClaimAllowed, false);
  assert.equal(result.executionOrder, 'OPENSEARCH_FIRST');
  assert.deepEqual(result.batchEvidence, [
    {
      batchId: 1,
      executionOrder: 'OPENSEARCH_FIRST',
      warmupRuns: 2,
      measuredRuns: 5,
      sampleIndexes: [0, 1, 2, 3, 4],
    },
  ]);
  assert.match(result.measurementBoundary, /API elapsed measures Spring/);
  assert.match(result.rawSamples.pairing, /same comparison request/);
  assert.match(result.caveat, /independent batches/);
});

test('benchmark records independent batches with alternating execution order', async () => {
  const requests = [];
  const responses = [
    comparisonResponse(900, 800),
    comparisonResponse(10, 12),
    comparisonResponse(20, 22),
    comparisonResponse(700, 600),
    comparisonResponse(30, 32),
    comparisonResponse(40, 42),
  ];

  const result = await runSearchComparisonBenchmark({
    fetchImpl: queuedFetch(responses, requests),
    baseUrl: 'http://repository.test/api',
    warmupRuns: 1,
    measuredRuns: 2,
    batches: 2,
    executionOrder: 'SOLR_FIRST',
    orderStrategy: 'ALTERNATE',
    now: () => new Date('2026-09-03T15:00:00Z'),
  });

  assert.equal(requests.length, 6);
  assert.deepEqual(
    requests.map(({ url }) => new URL(url).searchParams.get('order')),
    [
      'SOLR_FIRST',
      'SOLR_FIRST',
      'SOLR_FIRST',
      'OPENSEARCH_FIRST',
      'OPENSEARCH_FIRST',
      'OPENSEARCH_FIRST',
    ],
  );
  assert.deepEqual(result.executionPlan, {
    orderStrategy: 'ALTERNATE',
    seed: 20260903,
    batches: 2,
    measuredRunsPerBatch: 2,
    totalMeasuredRuns: 4,
    batchExecutionOrders: ['SOLR_FIRST', 'OPENSEARCH_FIRST'],
  });
  assert.deepEqual(result.rawSamples.apiElapsed.solrMs, [10, 20, 30, 40]);
  assert.deepEqual(result.rawSamples.apiElapsed.openSearchMs, [12, 22, 32, 42]);
  assert.deepEqual(result.batchEvidence, [
    {
      batchId: 1,
      executionOrder: 'SOLR_FIRST',
      warmupRuns: 1,
      measuredRuns: 2,
      sampleIndexes: [0, 1],
    },
    {
      batchId: 2,
      executionOrder: 'OPENSEARCH_FIRST',
      warmupRuns: 1,
      measuredRuns: 2,
      sampleIndexes: [2, 3],
    },
  ]);
});

test('benchmark refuses an unsupported execution order', async () => {
  await assert.rejects(
    runSearchComparisonBenchmark({
      fetchImpl: queuedFetch([]),
      warmupRuns: 0,
      measuredRuns: 1,
      executionOrder: 'RANDOM',
    }),
    /executionOrder must be one of/,
  );
});

test('benchmark refuses an unsupported order strategy', async () => {
  await assert.rejects(
    runSearchComparisonBenchmark({
      fetchImpl: queuedFetch([]),
      warmupRuns: 0,
      measuredRuns: 1,
      orderStrategy: 'ROTATE',
    }),
    /orderStrategy must be one of/,
  );
});

test('benchmark refuses to mix samples from different projections', async () => {
  const responses = [
    comparisonResponse(10, 12),
    comparisonResponse(11, 13, 'b'.repeat(64)),
  ];

  await assert.rejects(
    runSearchComparisonBenchmark({
      fetchImpl: queuedFetch(responses),
      warmupRuns: 0,
      measuredRuns: 2,
    }),
    /Projection changed while timing samples were being collected/,
  );
});

test('benchmark refuses unavailable engines instead of publishing partial performance evidence', async () => {
  const response = comparisonResponse(10, 12);
  response.openSearch.reachable = false;

  await assert.rejects(
    runSearchComparisonBenchmark({
      fetchImpl: queuedFetch([response]),
      warmupRuns: 0,
      measuredRuns: 1,
    }),
    /OpenSearch is not reachable/,
  );
});

test('benchmark refuses projection mismatch even when both engine timings exist', async () => {
  const response = comparisonResponse(10, 12);
  response.sameProjection = false;

  await assert.rejects(
    runSearchComparisonBenchmark({
      fetchImpl: queuedFetch([response]),
      warmupRuns: 0,
      measuredRuns: 1,
    }),
    /not on the same deterministic projection/,
  );
});
