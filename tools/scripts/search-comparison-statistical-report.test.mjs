import assert from 'node:assert/strict';
import test from 'node:test';
import {
  renderStatisticalMarkdown,
  summarizeConcurrencyBatchEvidence,
  summarizeIndependentBatchEvidence,
  synthesizeStatisticalReport,
} from './search-comparison-statistical-report.mjs';

const PROJECTION_ID = 'a'.repeat(64);

function pairedArtifact() {
  return {
    projection: { projectionId: PROJECTION_ID },
    request: {
      scenario: 'FULL_TEXT_RELEVANCE',
      query: 'North Dakota workforce',
      filters: [],
    },
    requestedExecutionOrder: 'SOLR_FIRST',
    executionOrder: 'OPENSEARCH_FIRST',
    endpoint:
      'http://repository.test/api/search/comparison/run?order=OPENSEARCH_FIRST',
    endpointTemplate:
      'http://repository.test/api/search/comparison/run?order={batchExecutionOrder}',
    executionPlan: {
      orderStrategy: 'RANDOMIZED',
      requestedStartingOrder: 'SOLR_FIRST',
      realizedFirstBatchOrder: 'OPENSEARCH_FIRST',
      seed: 5,
      seedApplied: true,
      batches: 2,
      measuredRunsPerBatch: 2,
      totalMeasuredRuns: 4,
      batchExecutionOrders: ['OPENSEARCH_FIRST', 'SOLR_FIRST'],
    },
    rawSamples: {
      apiElapsed: {
        solrMs: [10, 20, 30, 40],
        openSearchMs: [20, 30, 40, 50],
      },
      engineReported: {
        solrMs: [4, 5, 6, 7],
        openSearchMs: [8, 9, 10, 11],
      },
    },
    batchEvidence: [
      { batchId: 1, sampleIndexes: [0, 1] },
      { batchId: 2, sampleIndexes: [2, 3] },
    ],
    pairedStatistics: {
      apiElapsed: {
        medianDifferenceMs: 10,
        solrWinRatePercent: 100,
        bootstrap: { lowerMs: 10, upperMs: 10, excludesZero: true },
      },
      engineReported: {
        medianDifferenceMs: 4,
        solrWinRatePercent: 100,
        bootstrap: { lowerMs: 4, upperMs: 4, excludesZero: true },
      },
    },
  };
}

function orderPairArtifact() {
  return {
    projection: { projectionId: PROJECTION_ID },
    orderRobustness: [
      {
        id: 'FULL_TEXT_RELEVANCE',
        solrLeadsP50BothOrders: true,
        solrLeadsP95BothOrders: true,
      },
      {
        id: 'FACETED_SEARCH',
        solrLeadsP50BothOrders: true,
        solrLeadsP95BothOrders: false,
      },
    ],
  };
}

function batchSummary(solrApi, openSearchApi, solrNative, openSearchNative) {
  return {
    summary: {
      solr: {
        apiElapsed: { p50Ms: solrApi },
        engineReported: { p50Ms: solrNative },
      },
      openSearch: {
        apiElapsed: { p50Ms: openSearchApi },
        engineReported: { p50Ms: openSearchNative },
      },
    },
  };
}

function concurrencyArtifact() {
  return {
    projection: { projectionId: PROJECTION_ID },
    workloads: [
      {
        id: 'FULL_TEXT_RELEVANCE',
        workloadClass: 'FULL_TEXT',
        concurrencyResults: [
          {
            concurrency: 8,
            totalMeasuredComparisons: 80,
            throughput: { comparisonRequestsPerSecond: 20 },
            batchEvidence: [
              batchSummary(18, 28, 4, 8),
              batchSummary(22, 32, 5, 9),
            ],
            summary: {
              solr: {
                apiElapsed: { p50Ms: 20, p95Ms: 40 },
              },
              openSearch: {
                apiElapsed: { p50Ms: 30, p95Ms: 60 },
              },
              pairedStatistics: {
                apiElapsed: {
                  medianDifferenceMs: 10,
                  solrWinRatePercent: 90,
                  bootstrap: { lowerMs: 5, upperMs: 15 },
                },
              },
            },
          },
        ],
      },
    ],
  };
}

function telemetryArtifact() {
  return {
    benchmark: { projection: { projectionId: PROJECTION_ID } },
    resourceTelemetry: {
      delta: {
        interpretation: 'counter deltas vs instantaneous observations',
        counterResetDetected: false,
        counterResetFields: [],
        openSearch: {
          processCpuTotalMillisDelta: 100,
          gcCollectionCountDelta: 2,
          gcCollectionTimeMillisDelta: 8,
          searchQueryTotalDelta: 160,
        },
        solr: {
          garbageCollectionMetricDeltas: { 'jvm.gc.count': 1 },
          beforeGarbageCollectionMetrics: { 'jvm.gc.count': 5 },
          afterGarbageCollectionMetrics: { 'jvm.gc.count': 6 },
          cpuTimeMetricDeltas: { 'jvm.os.processCpuTime': 80 },
          beforeCpuAndLoadMetrics: { 'jvm.os.processCpuLoad': 0.4 },
          afterCpuAndLoadMetrics: { 'jvm.os.processCpuLoad': 0.5 },
          beforeHeapAndMemoryMetrics: { 'jvm.memory.heap.used': 100 },
          afterHeapAndMemoryMetrics: { 'jvm.memory.heap.used': 120 },
        },
        docker: {
          solr: {
            memoryUsedBytesDelta: 20,
            beforeCpuPercent: 10,
            afterCpuPercent: 12,
            beforeMemoryPercent: 20,
            afterMemoryPercent: 21,
          },
        },
      },
    },
  };
}

test('independent batch evidence treats separately warmed batches as the repeated unit', () => {
  const result = summarizeIndependentBatchEvidence(pairedArtifact(), {
    seed: 42,
  });
  assert.equal(result.available, true);
  assert.equal(result.workload.scenario, 'FULL_TEXT_RELEVANCE');
  assert.equal(result.workload.query, 'North Dakota workforce');
  assert.equal(result.batchCount, 2);
  assert.deepEqual(result.apiElapsed.solrBatchMediansMs, [10, 30]);
  assert.deepEqual(result.apiElapsed.openSearchBatchMediansMs, [20, 40]);
  assert.equal(result.apiElapsed.statistics.medianDifferenceMs, 10);
  assert.equal(result.apiElapsed.statistics.bootstrap.excludesZero, true);
  assert.match(result.experimentalUnit, /separately warmed benchmark batch/);
});

test('batch evidence is explicitly unavailable for a single batch', () => {
  const paired = pairedArtifact();
  paired.batchEvidence = [{ batchId: 1, sampleIndexes: [0, 1, 2, 3] }];
  const result = summarizeIndependentBatchEvidence(paired);
  assert.equal(result.available, false);
  assert.match(result.reason, /At least two batches/);
});

test('concurrency batch evidence produces inference for each workload and client level', () => {
  const result = summarizeConcurrencyBatchEvidence(concurrencyArtifact(), {
    seed: 42,
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].available, true);
  assert.equal(result[0].workloadId, 'FULL_TEXT_RELEVANCE');
  assert.equal(result[0].concurrency, 8);
  assert.equal(result[0].batchCount, 2);
  assert.deepEqual(result[0].apiElapsed.solrBatchMediansMs, [18, 22]);
  assert.deepEqual(result[0].apiElapsed.openSearchBatchMediansMs, [28, 32]);
  assert.equal(result[0].apiElapsed.statistics.medianDifferenceMs, 10);
  assert.equal(result[0].apiElapsed.statistics.bootstrap.excludesZero, true);
});

test('statistical report enforces projection identity and conservative scope', () => {
  const report = synthesizeStatisticalReport({
    paired: pairedArtifact(),
    orderPair: orderPairArtifact(),
    concurrency: concurrencyArtifact(),
    telemetry: telemetryArtifact(),
    seed: 42,
    now: () => new Date('2026-09-03T17:30:00Z'),
  });

  assert.equal(report.projection.projectionId, PROJECTION_ID);
  assert.equal(report.scope, 'LOCAL_CERTIFIED_TOPOLOGY_ONLY');
  assert.equal(report.comparativeClaimAllowed, false);
  assert.equal(report.executionControlEvidence.orderStrategy, 'RANDOMIZED');
  assert.equal(
    report.executionControlEvidence.requestedStartingOrder,
    'SOLR_FIRST',
  );
  assert.equal(
    report.executionControlEvidence.realizedFirstBatchOrder,
    'OPENSEARCH_FIRST',
  );
  assert.equal(report.executionControlEvidence.seed, 5);
  assert.equal(report.executionControlEvidence.seedApplied, true);
  assert.deepEqual(report.executionControlEvidence.batchExecutionOrders, [
    'OPENSEARCH_FIRST',
    'SOLR_FIRST',
  ]);
  assert.equal(
    report.executionControlEvidence.endpointTemplate,
    'http://repository.test/api/search/comparison/run?order={batchExecutionOrder}',
  );
  assert.equal(
    report.requestLevelEvidence.workload.scenario,
    'FULL_TEXT_RELEVANCE',
  );
  assert.equal(report.batchLevelEvidence.available, true);
  assert.equal(report.orderRobustness.scenarioCount, 2);
  assert.equal(report.orderRobustness.solrLeadsP50BothOrdersCount, 2);
  assert.equal(report.orderRobustness.solrLeadsP95BothOrdersCount, 1);
  assert.equal(report.concurrencyEvidence.length, 1);
  assert.equal(report.concurrencyEvidence[0].concurrency, 8);
  assert.equal(report.concurrencyBatchEvidence.length, 1);
  assert.equal(report.concurrencyBatchEvidence[0].available, true);
  assert.equal(report.resourceEvidence.openSearch.gcCollectionCountDelta, 2);
  assert.equal(report.resourceEvidence.counterResetDetected, false);
  assert.deepEqual(report.resourceEvidence.counterResetFields, []);
  assert.equal(
    report.resourceEvidence.solr.cpuTimeMetricDeltas['jvm.os.processCpuTime'],
    80,
  );
  assert.equal(
    report.resourceEvidence.solr.beforeCpuAndLoadMetrics[
      'jvm.os.processCpuLoad'
    ],
    0.4,
  );
  assert.match(report.claimGuardrail, /multiplicity-adjusted/);
});

test('legacy non-random execution metadata does not imply that an unused seed was applied', () => {
  const paired = pairedArtifact();
  paired.executionOrder = 'SOLR_FIRST';
  delete paired.requestedExecutionOrder;
  delete paired.endpointTemplate;
  paired.executionPlan = {
    orderStrategy: 'ALTERNATE',
    seed: 20260903,
    batches: 2,
    measuredRunsPerBatch: 2,
    totalMeasuredRuns: 4,
    batchExecutionOrders: ['SOLR_FIRST', 'OPENSEARCH_FIRST'],
  };

  const report = synthesizeStatisticalReport({ paired });
  assert.equal(report.executionControlEvidence.orderStrategy, 'ALTERNATE');
  assert.equal(
    report.executionControlEvidence.requestedStartingOrder,
    'SOLR_FIRST',
  );
  assert.equal(
    report.executionControlEvidence.realizedFirstBatchOrder,
    'SOLR_FIRST',
  );
  assert.equal(report.executionControlEvidence.seed, 20260903);
  assert.equal(report.executionControlEvidence.seedApplied, false);
});

test('statistical report preserves counter reset evidence', () => {
  const telemetry = telemetryArtifact();
  telemetry.resourceTelemetry.delta.counterResetDetected = true;
  telemetry.resourceTelemetry.delta.counterResetFields = [
    'openSearch.process.cpuTotalMillis',
  ];
  telemetry.resourceTelemetry.delta.openSearch.processCpuTotalMillisDelta =
    null;

  const report = synthesizeStatisticalReport({
    paired: pairedArtifact(),
    telemetry,
  });

  assert.equal(report.resourceEvidence.counterResetDetected, true);
  assert.deepEqual(report.resourceEvidence.counterResetFields, [
    'openSearch.process.cpuTotalMillis',
  ]);
  assert.equal(
    report.resourceEvidence.openSearch.processCpuTotalMillisDelta,
    null,
  );
});

test('statistical report rejects evidence from different projections', () => {
  const concurrency = concurrencyArtifact();
  concurrency.projection.projectionId = 'b'.repeat(64);
  assert.throws(
    () =>
      synthesizeStatisticalReport({
        paired: pairedArtifact(),
        concurrency,
      }),
    /Evidence projection mismatch/,
  );
});

test('Markdown report surfaces execution controls, workload-scoped and matrix batch inference, resources and interpretation boundary', () => {
  const report = synthesizeStatisticalReport({
    paired: pairedArtifact(),
    orderPair: orderPairArtifact(),
    concurrency: concurrencyArtifact(),
    telemetry: telemetryArtifact(),
    seed: 42,
    now: () => new Date('2026-09-03T17:30:00Z'),
  });
  const markdown = renderStatisticalMarkdown(report);
  assert.match(markdown, /Paired benchmark execution controls/);
  assert.match(markdown, /Requested starting order: \*\*SOLR_FIRST\*\*/);
  assert.match(
    markdown,
    /Realized first batch order: \*\*OPENSEARCH_FIRST\*\*/,
  );
  assert.match(markdown, /Effective seed: \*\*5\*\*/);
  assert.match(markdown, /Standalone independent batch evidence/);
  assert.match(markdown, /FULL_TEXT_RELEVANCE/);
  assert.match(markdown, /Batch count: \*\*2\*\*/);
  assert.match(markdown, /Execution-order robustness/);
  assert.match(markdown, /Concurrency matrix/);
  assert.match(
    markdown,
    /Independent batch evidence by workload and concurrency/,
  );
  assert.match(markdown, /not multiplicity-adjusted/);
  assert.match(markdown, /Counter reset detected/);
  assert.match(markdown, /Resource evidence/);
  assert.match(markdown, /does \*\*not\*\* establish universal/);
});
