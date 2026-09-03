import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBalancedExecutionOrderSchedule,
  parseArguments,
  runBatchedSearchComparisonBenchmark,
  summarizeIndependentBatchDifferences,
} from './search-comparison-batches.mjs';

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
      objectCount: 1_000_181,
      rebuiltAt: '2026-09-03T16:00:00Z',
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

test('balanced execution-order schedule is deterministic and order-balanced', () => {
  const first = buildBalancedExecutionOrderSchedule(8, 42);
  const second = buildBalancedExecutionOrderSchedule(8, 42);

  assert.deepEqual(first, second);
  assert.equal(first.filter((value) => value === 'SOLR_FIRST').length, 4);
  assert.equal(
    first.filter((value) => value === 'OPENSEARCH_FIRST').length,
    4,
  );
});

test('batch-level summary bootstraps independently warmed batch medians', () => {
  const result = summarizeIndependentBatchDifferences([10, 10, 10, 10], {
    bootstrapIterations: 1000,
    seed: 42,
  });

  assert.equal(result.batchCount, 4);
  assert.equal(result.medianBatchDifferenceMs, 10);
  assert.equal(result.solrLeadBatchRatePercent, 100);
  assert.equal(result.tieBatchRatePercent, 0);
  assert.equal(result.bootstrap.lowerMs, 10);
  assert.equal(result.bootstrap.upperMs, 10);
  assert.equal(result.bootstrap.excludesZero, true);
  assert.match(result.interpretation, /batch median/);
});

test('batched benchmark preserves batch evidence and aggregates paired samples', async () => {
  const requests = [];
  const responses = [
    comparisonResponse(10, 20),
    comparisonResponse(11, 21),
    comparisonResponse(12, 22),
    comparisonResponse(13, 23),
    comparisonResponse(14, 24),
    comparisonResponse(15, 25),
    comparisonResponse(16, 26),
    comparisonResponse(17, 27),
  ];

  const result = await runBatchedSearchComparisonBenchmark({
    fetchImpl: queuedFetch(responses, requests),
    baseUrl: 'http://repository.test/api/',
    batchCount: 4,
    warmupRuns: 0,
    samplesPerBatch: 2,
    seed: 42,
    now: () => new Date('2026-09-03T16:30:00Z'),
  });

  assert.equal(requests.length, 8);
  assert.equal(result.projection.projectionId, PROJECTION_ID);
  assert.equal(result.batchCount, 4);
  assert.equal(result.samplesPerBatch, 2);
  assert.equal(result.totalMeasuredPairs, 8);
  assert.equal(result.batches.length, 4);
  assert.equal(result.randomization.orderCounts.SOLR_FIRST, 2);
  assert.equal(result.randomization.orderCounts.OPENSEARCH_FIRST, 2);
  assert.equal(result.batchLevel.apiElapsed.batchCount, 4);
  assert.equal(result.batchLevel.apiElapsed.medianBatchDifferenceMs, 10);
  assert.equal(result.batchLevel.apiElapsed.solrLeadBatchRatePercent, 100);
  assert.equal(result.batchLevel.apiElapsed.bootstrap.excludesZero, true);
  assert.equal(result.aggregate.rawSamples.apiElapsed.solrMs.length, 8);
  assert.equal(result.aggregate.rawSamples.apiElapsed.openSearchMs.length, 8);
  assert.equal(result.aggregate.pairedStatistics.apiElapsed.sampleCount, 8);
  assert.equal(result.aggregate.pairedStatistics.apiElapsed.medianDifferenceMs, 10);
  assert.equal(result.aggregate.pairedStatistics.apiElapsed.solrWinRatePercent, 100);
  assert.equal(result.aggregate.pairedStatistics.apiElapsed.bootstrap.excludesZero, true);
  assert.equal(result.comparativeClaimAllowed, false);

  const requestedOrders = requests.map((request) =>
    new URL(request.url).searchParams.get('order'),
  );
  for (let batchIndex = 0; batchIndex < result.batchCount; batchIndex += 1) {
    const expectedOrder = result.randomization.orderSchedule[batchIndex];
    assert.deepEqual(
      requestedOrders.slice(batchIndex * 2, batchIndex * 2 + 2),
      [expectedOrder, expectedOrder],
    );
  }
});

test('batched benchmark refuses projection changes between batches', async () => {
  const responses = [
    comparisonResponse(10, 20),
    comparisonResponse(11, 21, 'b'.repeat(64)),
  ];

  await assert.rejects(
    runBatchedSearchComparisonBenchmark({
      fetchImpl: queuedFetch(responses),
      batchCount: 2,
      warmupRuns: 0,
      samplesPerBatch: 1,
      seed: 7,
    }),
    /Projection changed between benchmark batches/,
  );
});

test('CLI parser accepts batch controls and deterministic seed', () => {
  const options = parseArguments([
    '--',
    '--batches',
    '12',
    '--warmups',
    '3',
    '--samples-per-batch',
    '25',
    '--seed',
    '99',
    '--query',
    'climate adaptation',
  ]);

  assert.equal(options.batchCount, 12);
  assert.equal(options.warmupRuns, 3);
  assert.equal(options.samplesPerBatch, 25);
  assert.equal(options.seed, 99);
  assert.equal(options.query, 'climate adaptation');
});
