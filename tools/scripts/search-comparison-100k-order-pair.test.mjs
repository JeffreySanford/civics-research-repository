import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseArguments,
  runOrderPairedHundredKBenchmark,
} from './search-comparison-100k-order-pair.mjs';

const PROJECTION_ID = 'a'.repeat(64);
const PROGRAM =
  'U.S. Department of Commerce, U.S. Census Bureau, Geography Division';

function evidenceResponse() {
  return {
    profile: 'FEDERATED_100K',
    valid: true,
    targetFederatedRecordCount: 100000,
    retainedFederatedRecordCount: 100000,
    activeProfile: 'FEDERATED_100K',
    activationProjectionObjectCount: 100181,
    activationProjectionId: PROJECTION_ID,
    currentProjectionObjectCount: 100181,
    currentProjectionId: PROJECTION_ID,
    targetParity: true,
    storageEvidencePresent: true,
    storageProjectionObjectCount: 100181,
    storageRetainedFederatedCount: 100000,
    storageProjectionId: PROJECTION_ID,
    storageCapturedAt: '2026-08-31T01:11:17Z',
    violations: [],
  };
}

function engine(engine, elapsedMs, engineReportedMs, facets = []) {
  return {
    engine,
    enabled: true,
    reachable: true,
    indexName:
      engine === 'SOLR' ? 'discovery' : 'discovery-comparison',
    indexedDocumentCount: 100181,
    elapsedMs,
    engineReportedMs,
    totalHits: 100,
    returnedHits: 10,
    results: [],
    facets,
  };
}

function programFacets() {
  return [
    {
      field: 'program',
      label: 'Program',
      values: [
        {
          value: PROGRAM,
          label: PROGRAM,
          count: 1419,
          selected: false,
        },
        {
          value: 'Small program',
          label: 'Small program',
          count: 50,
          selected: false,
        },
      ],
    },
  ];
}

function comparisonResponse(request, order, facets = []) {
  const solrElapsed = order === 'OPENSEARCH_FIRST' ? 4 : 3;
  const openSearchElapsed = order === 'OPENSEARCH_FIRST' ? 7 : 8;
  return {
    scenario: request.scenario,
    projection: {
      projectionId: PROJECTION_ID,
      source: 'REPOSITORY',
      objectCount: 100181,
      rebuiltAt: '2026-08-31T01:33:00Z',
    },
    sameProjection: true,
    solr: engine('SOLR', solrElapsed, 1, facets),
    openSearch: engine('OPENSEARCH', openSearchElapsed, 4, facets),
  };
}

function pairedFetch() {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.includes('/admin/corpus/scale/evidence')) {
      return {
        ok: true,
        status: 200,
        async json() {
          return evidenceResponse();
        },
      };
    }

    const request = JSON.parse(init.body);
    const order = new URL(url).searchParams.get('order');
    const facets = order ? [] : programFacets();
    return {
      ok: true,
      status: 200,
      async json() {
        return comparisonResponse(request, order, facets);
      },
    };
  };
  return { fetchImpl, calls };
}

test('paired 100K benchmark reuses one selective filter across both execution orders', async () => {
  const { fetchImpl, calls } = pairedFetch();

  const result = await runOrderPairedHundredKBenchmark({
    fetchImpl,
    baseUrl: 'http://repository.test/api',
    warmupRuns: 0,
    measuredRuns: 1,
    now: () => new Date('2026-08-31T14:00:00Z'),
    hostContext: {
      logicalCpuCount: 24,
      totalMemoryBytes: 64 * 1024 ** 3,
      platform: 'win32',
      architecture: 'x64',
    },
  });

  assert.equal(calls.length, 9);
  assert.equal(result.projection.projectionId, PROJECTION_ID);
  assert.equal(result.selectedFilter.value, PROGRAM);
  assert.equal(result.selectedFilter.matchingDocuments, 1419);
  assert.equal(result.passes.SOLR_FIRST.executionOrder, 'SOLR_FIRST');
  assert.equal(
    result.passes.OPENSEARCH_FIRST.executionOrder,
    'OPENSEARCH_FIRST',
  );
  assert.ok(
    result.orderRobustness.every(
      (scenario) =>
        scenario.solrLeadsP50BothOrders && scenario.solrLeadsP95BothOrders,
    ),
  );

  const filteredRequests = calls
    .filter((call) => call.init?.body)
    .map((call) => JSON.parse(call.init.body))
    .filter((request) => request.scenario === 'FILTERING');
  assert.equal(filteredRequests.length, 2);
  assert.ok(
    filteredRequests.every(
      (request) => request.programs?.length === 1 && request.programs[0] === PROGRAM,
    ),
  );
  assert.equal(
    calls.filter((call) => call.url.includes('order=SOLR_FIRST')).length,
    3,
  );
  assert.equal(
    calls.filter((call) => call.url.includes('order=OPENSEARCH_FIRST')).length,
    3,
  );
});

test('paired CLI parser accepts warmup, sample, and output controls', () => {
  const options = parseArguments([
    '--',
    '--warmups',
    '3',
    '--samples',
    '25',
    '--output',
    'evidence/paired.json',
  ]);

  assert.equal(options.warmupRuns, 3);
  assert.equal(options.measuredRuns, 25);
  assert.equal(options.output, 'evidence/paired.json');
});
