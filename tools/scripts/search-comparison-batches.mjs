import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  runSearchComparisonBenchmark,
  summarizeTimingSamples,
} from './search-comparison-benchmark.mjs';
import { summarizePairedLatencyEvidence } from './search-comparison-statistics.mjs';

const DEFAULT_BASE_URL = 'http://localhost:8080/api';
const DEFAULT_BATCH_COUNT = 30;
const DEFAULT_WARMUP_RUNS = 5;
const DEFAULT_SAMPLES_PER_BATCH = 50;
const DEFAULT_SEED = 20260903;
const DEFAULT_OUTPUT =
  'browser-evidence-artifacts/search-comparison-batches.json';

function requireInteger(value, label, minimum, maximum = Number.MAX_SAFE_INTEGER) {
  if (
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(
      `${label} must be an integer from ${minimum} to ${maximum}.`,
    );
  }
  return value;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function buildBalancedExecutionOrderSchedule(
  batchCount,
  seed = DEFAULT_SEED,
) {
  requireInteger(batchCount, 'batchCount', 2, 100);
  requireInteger(seed, 'seed', 0);

  const schedule = Array.from({ length: batchCount }, (_, index) =>
    index % 2 === 0 ? 'SOLR_FIRST' : 'OPENSEARCH_FIRST',
  );
  const random = seededRandom(seed);

  for (let index = schedule.length - 1; index > 0; index -= 1) {
    const selectedIndex = Math.floor(random() * (index + 1));
    [schedule[index], schedule[selectedIndex]] = [
      schedule[selectedIndex],
      schedule[index],
    ];
  }

  return schedule;
}

function countOrders(schedule) {
  return schedule.reduce(
    (counts, order) => {
      counts[order] += 1;
      return counts;
    },
    { SOLR_FIRST: 0, OPENSEARCH_FIRST: 0 },
  );
}

function appendSamples(target, source) {
  target.solrMs.push(...source.solrMs);
  target.openSearchMs.push(...source.openSearchMs);
}

export async function runBatchedSearchComparisonBenchmark({
  fetchImpl = globalThis.fetch,
  baseUrl = DEFAULT_BASE_URL,
  batchCount = DEFAULT_BATCH_COUNT,
  warmupRuns = DEFAULT_WARMUP_RUNS,
  samplesPerBatch = DEFAULT_SAMPLES_PER_BATCH,
  seed = DEFAULT_SEED,
  request = {
    scenario: 'FULL_TEXT_RELEVANCE',
    query: 'North Dakota workforce',
    page: 0,
    pageSize: 10,
  },
  now = () => new Date(),
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('A fetch implementation is required.');
  }
  requireInteger(batchCount, 'batchCount', 2, 100);
  requireInteger(warmupRuns, 'warmupRuns', 0, 20);
  requireInteger(samplesPerBatch, 'samplesPerBatch', 1, 100);
  requireInteger(seed, 'seed', 0);

  const orderSchedule = buildBalancedExecutionOrderSchedule(batchCount, seed);
  const apiElapsed = { solrMs: [], openSearchMs: [] };
  const engineReported = { solrMs: [], openSearchMs: [] };
  const batches = [];
  let projectionId = null;
  let projection = null;

  for (let index = 0; index < orderSchedule.length; index += 1) {
    const executionOrder = orderSchedule[index];
    const result = await runSearchComparisonBenchmark({
      fetchImpl,
      baseUrl,
      warmupRuns,
      measuredRuns: samplesPerBatch,
      executionOrder,
      request,
      now,
    });

    const currentProjectionId = result.projection?.projectionId;
    if (projectionId && currentProjectionId !== projectionId) {
      throw new Error(
        `Projection changed between benchmark batches ${index} and ${index + 1}.`,
      );
    }
    projectionId = currentProjectionId;
    projection = result.projection;

    appendSamples(apiElapsed, result.rawSamples.apiElapsed);
    appendSamples(engineReported, result.rawSamples.engineReported);
    batches.push({
      batchNumber: index + 1,
      executionOrder,
      capturedAt: result.capturedAt,
      apiElapsed: result.solr.elapsed,
      openSearchApiElapsed: result.openSearch.elapsed,
      solrEngineReported: result.solr.engineReported,
      openSearchEngineReported: result.openSearch.engineReported,
      pairedStatistics: result.pairedStatistics,
      rawSamples: result.rawSamples,
    });
  }

  return {
    kind: 'batched-local-search-comparison-diagnostic',
    capturedAt: now().toISOString(),
    comparativeClaimAllowed: false,
    request,
    projection,
    batchCount,
    warmupRunsPerBatch: warmupRuns,
    samplesPerBatch,
    totalMeasuredPairs: batchCount * samplesPerBatch,
    randomization: {
      method:
        'Deterministic seeded Fisher-Yates shuffle of an execution-order schedule balanced to within one batch.',
      seed,
      orderSchedule,
      orderCounts: countOrders(orderSchedule),
    },
    methodology:
      'Each batch performs its own excluded warmup sequence before collecting paired measurements. Solr-first and OpenSearch-first batches are balanced and deterministically shuffled to reduce systematic ordering and run-position effects. Every batch must remain on the same deterministic projection. API elapsed and engine-native timing remain separate, and the result is still a documented local-topology experiment rather than a universal engine ranking.',
    aggregate: {
      rawSamples: {
        pairing:
          'Arrays remain index-paired within each batch and are concatenated in batch order.',
        apiElapsed,
        engineReported,
      },
      pairedStatistics: {
        apiElapsed: summarizePairedLatencyEvidence(
          apiElapsed.solrMs,
          apiElapsed.openSearchMs,
          { seed },
        ),
        engineReported: summarizePairedLatencyEvidence(
          engineReported.solrMs,
          engineReported.openSearchMs,
          { seed },
        ),
      },
      solr: {
        elapsed: summarizeTimingSamples(apiElapsed.solrMs),
        engineReported: summarizeTimingSamples(engineReported.solrMs),
      },
      openSearch: {
        elapsed: summarizeTimingSamples(apiElapsed.openSearchMs),
        engineReported: summarizeTimingSamples(engineReported.openSearchMs),
      },
    },
    batches,
  };
}

export function parseArguments(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    batchCount: DEFAULT_BATCH_COUNT,
    warmupRuns: DEFAULT_WARMUP_RUNS,
    samplesPerBatch: DEFAULT_SAMPLES_PER_BATCH,
    seed: DEFAULT_SEED,
    output: DEFAULT_OUTPUT,
    scenario: 'FULL_TEXT_RELEVANCE',
    query: 'North Dakota workforce',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    switch (argument) {
      case '--':
        break;
      case '--base-url':
        options.baseUrl = value;
        index += 1;
        break;
      case '--batches':
        options.batchCount = Number(value);
        index += 1;
        break;
      case '--warmups':
        options.warmupRuns = Number(value);
        index += 1;
        break;
      case '--samples-per-batch':
        options.samplesPerBatch = Number(value);
        index += 1;
        break;
      case '--seed':
        options.seed = Number(value);
        index += 1;
        break;
      case '--output':
        options.output = value;
        index += 1;
        break;
      case '--scenario':
        options.scenario = value;
        index += 1;
        break;
      case '--query':
        options.query = value;
        index += 1;
        break;
      default:
        throw new Error(`Unknown batched benchmark argument: ${argument}`);
    }
  }

  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const result = await runBatchedSearchComparisonBenchmark({
    baseUrl: options.baseUrl,
    batchCount: options.batchCount,
    warmupRuns: options.warmupRuns,
    samplesPerBatch: options.samplesPerBatch,
    seed: options.seed,
    request: {
      scenario: options.scenario,
      query: options.query,
      page: 0,
      pageSize: 10,
    },
  });

  const outputPath = resolve(options.output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

  console.log(`Batched search comparison written to ${outputPath}`);
  console.log(`Projection: ${result.projection.projectionId}`);
  console.log(
    `Batches/pairs: ${result.batchCount}/${result.totalMeasuredPairs}; order counts Solr-first=${result.randomization.orderCounts.SOLR_FIRST}, OpenSearch-first=${result.randomization.orderCounts.OPENSEARCH_FIRST}`,
  );
  console.log(
    `Aggregate Solr API p50/p95/p99: ${result.aggregate.solr.elapsed.p50Ms}/${result.aggregate.solr.elapsed.p95Ms}/${result.aggregate.solr.elapsed.p99Ms} ms`,
  );
  console.log(
    `Aggregate OpenSearch API p50/p95/p99: ${result.aggregate.openSearch.elapsed.p50Ms}/${result.aggregate.openSearch.elapsed.p95Ms}/${result.aggregate.openSearch.elapsed.p99Ms} ms`,
  );
  console.log(
    `Paired API median difference (OpenSearch - Solr): ${result.aggregate.pairedStatistics.apiElapsed.medianDifferenceMs} ms; 95% bootstrap CI ${result.aggregate.pairedStatistics.apiElapsed.bootstrap.lowerMs}..${result.aggregate.pairedStatistics.apiElapsed.bootstrap.upperMs} ms`,
  );
  console.log(result.methodology);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
