import assert from 'node:assert/strict';
import test from 'node:test';
import './search-comparison-resource-telemetry.test.mjs';
import {
  parseArguments,
  parseConcurrencyLevels,
  runConcurrencyMatrix,
} from './search-comparison-concurrency.mjs';

const PROJECTION_ID = 'a'.repeat(64);

function scaleEvidence() {
  return {
    valid: true,
    activeProfile: 'FEDERATED_100K',
    targetParity: true,
    retainedFederatedRecordCount: 100000,
    currentProjectionObjectCount: 100181,
    currentProjectionId: PROJECTION_ID,
  };
}

function facets() {
  return [
    {
      field: 'program',
      values: [
        { value: '006:070', count: 1419 },
        { value: '001:001', count: 10 },
      ],
    },
  ];
}

function comparisonResponse(request, projectionId = PROJECTION_ID) {
  return {
    scenario: request.scenario,
    projection: {
      projectionId,
      source: 'REPOSITORY',
      objectCount: 100181,
      rebuiltAt: '2026-09-03T16:00:00Z',
    },
    sameProjection: true,
    solr: {
      engine: 'SOLR',
      enabled: true,
      reachable: true,
      elapsedMs: 10,
      engineReportedMs: 4,
      facets: request.scenario === 'FACETED_SEARCH' ? facets() : [],
    },
    openSearch: {
      engine: 'OPENSEARCH',
      enabled: true,
      reachable: true,
      elapsedMs: 14,
      engineReportedMs: 6,
      facets: request.scenario === 'FACETED_SEARCH' ? facets() : [],
    },
  };
}

function concurrencyFetch({ driftAfterDiscovery = false } = {}) {
  const calls = [];
  let comparisonCount = 0;
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.includes('/admin/corpus/scale/evidence')) {
      return {
        ok: true,
        status: 200,
        async json() {
          return scaleEvidence();
        },
      };
    }

    const request = JSON.parse(init.body);
    const isDiscovery = !url.includes('?order=');
    if (!isDiscovery) {
      comparisonCount += 1;
    }
    return {
      ok: true,
      status: 200,
      async json() {
        return comparisonResponse(
          request,
          driftAfterDiscovery && !isDiscovery && comparisonCount === 1
            ? 'b'.repeat(64)
            : PROJECTION_ID,
        );
      },
    };
  };
  return { fetchImpl, calls };
}

function monotonicClock() {
  let value = 0;
  return () => {
    value += 1;
    return value;
  };
}

test('concurrency levels parse the planned 1/8/32 client matrix', () => {
  assert.deepEqual(parseConcurrencyLevels('1,8,32'), [1, 8, 32]);
  assert.throws(() => parseConcurrencyLevels('1,8,8'), /must be unique/);
  assert.throws(() => parseConcurrencyLevels('0,8'), /from 1 to 64/);
});

test('concurrency matrix retains four workloads, balanced batch order and throughput evidence', async () => {
  const { fetchImpl, calls } = concurrencyFetch();
  const result = await runConcurrencyMatrix({
    fetchImpl,
    baseUrl: 'http://repository.test/api/',
    concurrencyLevels: [1, 2],
    batches: 2,
    warmupRounds: 0,
    measuredRounds: 1,
    seed: 42,
    monotonicNow: monotonicClock(),
    now: () => new Date('2026-09-03T17:00:00Z'),
  });

  assert.equal(result.projection.projectionId, PROJECTION_ID);
  assert.deepEqual(result.concurrencyLevels, [1, 2]);
  assert.deepEqual(
    result.workloads.map((workload) => workload.workloadClass),
    ['FULL_TEXT', 'FACETS', 'BROAD_FILTER', 'SELECTIVE_FILTER'],
  );
  assert.equal(result.selectedFilter.value, '006:070');
  assert.equal(result.comparativeClaimAllowed, false);
  assert.match(result.methodology, /comparison-request boundary/);
  assert.match(result.methodology, /batch-level evidence/);

  for (const workload of result.workloads) {
    assert.equal(workload.concurrencyResults.length, 2);
    const serial = workload.concurrencyResults[0];
    const concurrent = workload.concurrencyResults[1];
    assert.equal(serial.totalMeasuredComparisons, 2);
    assert.equal(concurrent.totalMeasuredComparisons, 4);
    assert.deepEqual(
      new Set(serial.executionOrderPlan),
      new Set(['SOLR_FIRST', 'OPENSEARCH_FIRST']),
    );
    assert.equal(serial.batchEvidence.length, 2);
    assert.equal(serial.summary.pairedStatistics.apiElapsed.sampleCount, 2);
    assert.equal(
      serial.summary.pairedStatistics.apiElapsed.medianDifferenceMs,
      4,
    );
    assert.equal(
      typeof serial.throughput.comparisonRequestsPerSecond,
      'number',
    );
    assert.equal(
      serial.throughput.perEngineQueriesPerSecond,
      serial.throughput.comparisonRequestsPerSecond,
    );
  }

  assert.ok(calls.some((call) => call.url.endsWith('?order=SOLR_FIRST')));
  assert.ok(calls.some((call) => call.url.endsWith('?order=OPENSEARCH_FIRST')));
});

test('concurrency matrix refuses projection drift under load', async () => {
  const { fetchImpl } = concurrencyFetch({ driftAfterDiscovery: true });
  await assert.rejects(
    runConcurrencyMatrix({
      fetchImpl,
      concurrencyLevels: [1],
      batches: 2,
      warmupRounds: 0,
      measuredRounds: 1,
      monotonicNow: monotonicClock(),
    }),
    /Projection changed during concurrency measurement/,
  );
});

test('concurrency CLI parser accepts client levels and batch controls', () => {
  const options = parseArguments([
    '--',
    '--concurrency',
    '1,8,32',
    '--batches',
    '8',
    '--warmup-rounds',
    '2',
    '--rounds',
    '12',
    '--seed',
    '99',
    '--output',
    'evidence/concurrency.json',
  ]);

  assert.deepEqual(options.concurrencyLevels, [1, 8, 32]);
  assert.equal(options.batches, 8);
  assert.equal(options.warmupRounds, 2);
  assert.equal(options.measuredRounds, 12);
  assert.equal(options.seed, 99);
  assert.equal(options.output, 'evidence/concurrency.json');
});
