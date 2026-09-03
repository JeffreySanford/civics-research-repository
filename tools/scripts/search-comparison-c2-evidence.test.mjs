import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildOrderPairEvidence,
  parseArguments,
  runC2EvidenceSuite,
} from './search-comparison-c2-evidence.mjs';

const PROJECTION_ID = 'a'.repeat(64);

function researchReport() {
  return {
    paired: {
      profile: 'FEDERATED_1M',
      projection: {
        projectionId: PROJECTION_ID,
        objectCount: 1000181,
      },
      orderRobustness: [
        {
          id: 'FULL_TEXT_RELEVANCE',
          solrLeadsApiP50BothOrders: true,
          solrLeadsApiP95BothOrders: false,
          solrLeadsNativeP50BothOrders: true,
          solrLeadsNativeP95BothOrders: true,
        },
      ],
    },
  };
}

test('C2 order-pair adapter preserves projection and API order robustness', () => {
  const result = buildOrderPairEvidence(researchReport());
  assert.equal(result.projection.projectionId, PROJECTION_ID);
  assert.deepEqual(result.orderRobustness, [
    {
      id: 'FULL_TEXT_RELEVANCE',
      solrLeadsP50BothOrders: true,
      solrLeadsP95BothOrders: false,
    },
  ]);
});

test('C2 order-pair adapter rejects a non-C2 research report', () => {
  const report = researchReport();
  report.paired.profile = 'FEDERATED_100K';
  assert.throws(
    () => buildOrderPairEvidence(report),
    /requires a FEDERATED_1M research-performance report/,
  );
});

test('C2 evidence suite runs standalone batches and telemetry against FEDERATED_1M exactly once', async () => {
  const calls = {
    standalone: [],
    telemetry: [],
    synthesize: [],
  };
  const paired = {
    projection: { projectionId: PROJECTION_ID },
  };
  const concurrency = {
    projection: { projectionId: PROJECTION_ID },
  };
  const telemetry = {
    benchmark: concurrency,
    resourceTelemetry: { delta: {} },
  };

  const result = await runC2EvidenceSuite({
    researchReport: researchReport(),
    runStandaloneBenchmark: async (options) => {
      calls.standalone.push(options);
      return paired;
    },
    runTelemetryBenchmark: async (options) => {
      calls.telemetry.push(options);
      return telemetry;
    },
    synthesizeReport: (options) => {
      calls.synthesize.push(options);
      return {
        projection: { projectionId: PROJECTION_ID },
        claimGuardrail: 'scoped',
      };
    },
    renderMarkdown: () => '# scoped report\n',
    now: () => new Date('2026-09-03T18:30:00Z'),
  });

  assert.equal(calls.standalone.length, 1);
  assert.equal(calls.telemetry.length, 1);
  assert.equal(calls.synthesize.length, 1);
  assert.equal(calls.standalone[0].batches, 6);
  assert.equal(calls.standalone[0].warmupRuns, 5);
  assert.equal(calls.standalone[0].measuredRuns, 20);
  assert.equal(calls.standalone[0].orderStrategy, 'RANDOMIZED');
  assert.equal(calls.standalone[0].seed, 20260903);
  assert.equal(calls.telemetry[0].benchmarkOptions.profile, 'FEDERATED_1M');
  assert.equal(calls.telemetry[0].benchmarkOptions.seed, 20260903);
  assert.equal(calls.synthesize[0].paired, paired);
  assert.equal(calls.synthesize[0].concurrency, concurrency);
  assert.equal(calls.synthesize[0].telemetry, telemetry);
  assert.equal(
    calls.synthesize[0].orderPair.orderRobustness[0].solrLeadsP50BothOrders,
    true,
  );
  assert.equal(result.profile, 'FEDERATED_1M');
  assert.equal(result.statisticalMarkdown, '# scoped report\n');
});

test('C2 evidence suite refuses telemetry without a concurrency benchmark', async () => {
  await assert.rejects(
    () =>
      runC2EvidenceSuite({
        researchReport: researchReport(),
        runStandaloneBenchmark: async () => ({
          projection: { projectionId: PROJECTION_ID },
        }),
        runTelemetryBenchmark: async () => ({
          resourceTelemetry: { delta: {} },
        }),
      }),
    /did not return its concurrency benchmark/,
  );
});

test('C2 evidence CLI arguments retain explicit research controls', () => {
  const options = parseArguments([
    '--base-url',
    'http://repository.test/api',
    '--solr-url',
    'http://solr.test/solr',
    '--opensearch-url',
    'http://opensearch.test',
    '--seed',
    '17',
    '--batches',
    '8',
    '--warmups',
    '3',
    '--samples',
    '12',
    '--output-dir',
    'artifacts',
  ]);

  assert.equal(options.baseUrl, 'http://repository.test/api');
  assert.equal(options.solrBaseUrl, 'http://solr.test/solr');
  assert.equal(options.openSearchBaseUrl, 'http://opensearch.test');
  assert.equal(options.seed, 17);
  assert.equal(options.batches, 8);
  assert.equal(options.warmupRuns, 3);
  assert.equal(options.measuredRuns, 12);
  assert.equal(options.outputDir, 'artifacts');
});
