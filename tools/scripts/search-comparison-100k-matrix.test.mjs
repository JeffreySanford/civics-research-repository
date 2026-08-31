import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_SCENARIOS,
  parseArguments,
  runHundredKSearchComparisonMatrix,
  summarizeHostContext,
} from './search-comparison-100k-matrix.mjs';

const PROJECTION_ID = 'a'.repeat(64);

function evidenceResponse(overrides = {}) {
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
    ...overrides,
  };
}

function comparisonResponse(request, elapsedOffset = 0) {
  return {
    scenario: request.scenario,
    projection: {
      projectionId: PROJECTION_ID,
      source: 'REPOSITORY',
      objectCount: 100181,
      rebuiltAt: '2026-08-31T01:33:00Z',
    },
    sameProjection: true,
    solr: {
      engine: 'SOLR',
      enabled: true,
      reachable: true,
      indexName: 'discovery',
      indexedDocumentCount: 100181,
      elapsedMs: 10 + elapsedOffset,
      engineReportedMs: 4 + elapsedOffset,
      totalHits: 100,
      returnedHits: 10,
      results: [],
      facets: [],
    },
    openSearch: {
      engine: 'OPENSEARCH',
      enabled: true,
      reachable: true,
      indexName: 'discovery-comparison',
      indexedDocumentCount: 100181,
      elapsedMs: 12 + elapsedOffset,
      engineReportedMs: 5 + elapsedOffset,
      totalHits: 100,
      returnedHits: 10,
      results: [],
      facets: [],
    },
  };
}

function matrixFetch({ evidence = evidenceResponse() } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.includes('/admin/corpus/scale/evidence')) {
      return {
        ok: true,
        status: 200,
        async json() {
          return evidence;
        },
      };
    }

    const request = JSON.parse(init.body);
    return {
      ok: true,
      status: 200,
      async json() {
        return comparisonResponse(request, calls.length);
      },
    };
  };
  return { fetchImpl, calls };
}

test('100K matrix requires valid evidence and keeps every scenario on one projection', async () => {
  const { fetchImpl, calls } = matrixFetch();

  const result = await runHundredKSearchComparisonMatrix({
    fetchImpl,
    baseUrl: 'http://repository.test/api/',
    warmupRuns: 1,
    measuredRuns: 2,
    executionOrder: 'OPENSEARCH_FIRST',
    now: () => new Date('2026-08-31T02:00:00Z'),
    hostContext: {
      logicalCpuCount: 24,
      totalMemoryBytes: 64 * 1024 ** 3,
      platform: 'win32',
      architecture: 'x64',
    },
  });

  assert.equal(calls.length, 1 + DEFAULT_SCENARIOS.length * 3);
  assert.match(calls[0].url, /profile=FEDERATED_100K/);
  assert.ok(
    calls
      .slice(1)
      .every((call) => call.url.endsWith('?order=OPENSEARCH_FIRST')),
  );
  assert.equal(result.profile, 'FEDERATED_100K');
  assert.equal(result.executionOrder, 'OPENSEARCH_FIRST');
  assert.equal(result.evidence.currentProjectionId, PROJECTION_ID);
  assert.equal(result.scenarios.length, 3);
  assert.deepEqual(
    result.scenarios.map((scenario) => scenario.id),
    ['FULL_TEXT_RELEVANCE', 'FACETED_SEARCH', 'FILTERING'],
  );
  assert.ok(
    result.scenarios.every(
      (scenario) => scenario.projection.projectionId === PROJECTION_ID,
    ),
  );
  assert.equal(result.warmupRuns, 1);
  assert.equal(result.measuredRuns, 2);
  assert.equal(result.comparativeClaimAllowed, false);
  assert.match(result.methodology, /reversed-order passes/);
});

test('100K matrix refuses to benchmark when live scale evidence is invalid', async () => {
  const { fetchImpl } = matrixFetch({
    evidence: evidenceResponse({
      valid: false,
      activeProfile: 'CURATED_DEMO',
      violations: ['Requested profile is not active.'],
    }),
  });

  await assert.rejects(
    runHundredKSearchComparisonMatrix({
      fetchImpl,
      warmupRuns: 0,
      measuredRuns: 1,
    }),
    /Corpus scale evidence is not valid/,
  );
});

test('host context records reproducibility facts without inventing Docker limits', () => {
  const host = summarizeHostContext({
    cpus: () => Array.from({ length: 24 }, () => ({})),
    totalmem: () => 64 * 1024 ** 3,
    platform: () => 'win32',
    arch: () => 'x64',
  });

  assert.deepEqual(host, {
    logicalCpuCount: 24,
    totalMemoryBytes: 64 * 1024 ** 3,
    platform: 'win32',
    architecture: 'x64',
  });
});

test('CLI parser accepts bounded sample controls, order, and output path', () => {
  const options = parseArguments([
    '--',
    '--warmups',
    '3',
    '--samples',
    '50',
    '--profile',
    'FEDERATED_100K',
    '--order',
    'OPENSEARCH_FIRST',
    '--output',
    'evidence/100k.json',
  ]);

  assert.equal(options.warmupRuns, 3);
  assert.equal(options.measuredRuns, 50);
  assert.equal(options.profile, 'FEDERATED_100K');
  assert.equal(options.executionOrder, 'OPENSEARCH_FIRST');
  assert.equal(options.output, 'evidence/100k.json');
});
