import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { summarizePairedLatencyEvidence } from './search-comparison-statistics.mjs';

const DEFAULT_BASE_URL = 'http://localhost:8080/api';
const DEFAULT_WARMUP_RUNS = 5;
const DEFAULT_MEASURED_RUNS = 100;
const DEFAULT_EXECUTION_ORDER = 'SOLR_FIRST';
const MAX_WARMUP_RUNS = 20;
const MAX_MEASURED_RUNS = 100;
const EXECUTION_ORDERS = new Set(['SOLR_FIRST', 'OPENSEARCH_FIRST']);

function requireBoundedInteger(value, label, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `${label} must be an integer from ${minimum} to ${maximum}.`,
    );
  }
  return value;
}

function requireTiming(value, label) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `${label} must be a finite, non-negative millisecond value.`,
    );
  }
  return value;
}

function requireExecutionOrder(value) {
  if (!EXECUTION_ORDERS.has(value)) {
    throw new Error(
      `executionOrder must be one of ${[...EXECUTION_ORDERS].join(', ')}.`,
    );
  }
  return value;
}

export function nearestRankPercentile(values, percentile) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('At least one timing sample is required.');
  }
  if (!(percentile > 0 && percentile <= 1)) {
    throw new Error('Percentile must be greater than 0 and no greater than 1.');
  }

  const sorted = values
    .map((value) => requireTiming(value, 'Timing sample'))
    .sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil(percentile * sorted.length));
  return sorted[rank - 1];
}

export function summarizeTimingSamples(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('At least one measured timing sample is required.');
  }

  const sorted = values
    .map((value) => requireTiming(value, 'Timing sample'))
    .sort((a, b) => a - b);
  const total = sorted.reduce((sum, value) => sum + value, 0);

  return {
    sampleCount: sorted.length,
    minMs: sorted[0],
    p50Ms: nearestRankPercentile(sorted, 0.5),
    p95Ms: nearestRankPercentile(sorted, 0.95),
    p99Ms: nearestRankPercentile(sorted, 0.99),
    maxMs: sorted.at(-1),
    meanMs: Math.round((total / sorted.length) * 100) / 100,
  };
}

function validateEngine(engine, label) {
  if (!engine?.enabled) {
    throw new Error(
      `${label} is disabled; refusing to record a comparison benchmark.`,
    );
  }
  if (!engine.reachable) {
    throw new Error(
      `${label} is not reachable; refusing to record a comparison benchmark.`,
    );
  }
  requireTiming(engine.elapsedMs, `${label} elapsedMs`);
  requireTiming(engine.engineReportedMs, `${label} engineReportedMs`);
}

function validateResponse(response, expectedProjectionId) {
  if (!response?.sameProjection) {
    throw new Error(
      'Solr and OpenSearch are not on the same deterministic projection.',
    );
  }

  const projectionId = response?.projection?.projectionId;
  if (
    typeof projectionId !== 'string' ||
    !/^[0-9a-f]{64}$/.test(projectionId)
  ) {
    throw new Error(
      'Comparison response does not contain a valid deterministic projection ID.',
    );
  }
  if (expectedProjectionId && projectionId !== expectedProjectionId) {
    throw new Error(
      'Projection changed while timing samples were being collected.',
    );
  }

  validateEngine(response.solr, 'Solr');
  validateEngine(response.openSearch, 'OpenSearch');
  return projectionId;
}

export async function runSearchComparisonBenchmark({
  fetchImpl = globalThis.fetch,
  baseUrl = DEFAULT_BASE_URL,
  warmupRuns = DEFAULT_WARMUP_RUNS,
  measuredRuns = DEFAULT_MEASURED_RUNS,
  executionOrder = DEFAULT_EXECUTION_ORDER,
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

  requireBoundedInteger(warmupRuns, 'warmupRuns', 0, MAX_WARMUP_RUNS);
  requireBoundedInteger(measuredRuns, 'measuredRuns', 1, MAX_MEASURED_RUNS);
  const order = requireExecutionOrder(executionOrder);

  const endpoint = `${baseUrl.replace(/\/$/, '')}/search/comparison/run?order=${encodeURIComponent(order)}`;
  let projectionId = null;
  let projection = null;
  const solrSamples = [];
  const openSearchSamples = [];
  const solrEngineSamples = [];
  const openSearchEngineSamples = [];

  const execute = async (recordSample) => {
    const httpResponse = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!httpResponse.ok) {
      throw new Error(
        `Comparison request failed with HTTP ${httpResponse.status}.`,
      );
    }

    const response = await httpResponse.json();
    projectionId = validateResponse(response, projectionId);
    projection = response.projection;

    if (recordSample) {
      solrSamples.push(response.solr.elapsedMs);
      openSearchSamples.push(response.openSearch.elapsedMs);
      solrEngineSamples.push(response.solr.engineReportedMs);
      openSearchEngineSamples.push(response.openSearch.engineReportedMs);
    }
  };

  for (let index = 0; index < warmupRuns; index += 1) {
    await execute(false);
  }
  for (let index = 0; index < measuredRuns; index += 1) {
    await execute(true);
  }

  return {
    kind: 'local-search-comparison-diagnostic',
    capturedAt: now().toISOString(),
    measurementBoundary:
      'API elapsed measures Spring around each engine HTTP request. Engine-reported timing is captured from that same response (Solr QTime / OpenSearch took); vendor definitions differ and are not directly equivalent.',
    executionOrder: order,
    comparativeClaimAllowed: false,
    caveat:
      'Warm-up runs are excluded and execution order is explicit, but this remains a single local/container topology. Solr QTime and OpenSearch took also have different vendor semantics. Compare reversed-order passes before treating an engine lead as robust.',
    endpoint,
    request,
    projection,
    warmupRuns,
    measuredRuns,
    rawSamples: {
      pairing:
        'Arrays are index-paired: values at the same index came from the same comparison request.',
      apiElapsed: {
        solrMs: [...solrSamples],
        openSearchMs: [...openSearchSamples],
      },
      engineReported: {
        solrMs: [...solrEngineSamples],
        openSearchMs: [...openSearchEngineSamples],
      },
    },
    pairedStatistics: {
      apiElapsed: summarizePairedLatencyEvidence(
        solrSamples,
        openSearchSamples,
      ),
      engineReported: summarizePairedLatencyEvidence(
        solrEngineSamples,
        openSearchEngineSamples,
      ),
    },
    solr: {
      engine: 'SOLR',
      elapsed: summarizeTimingSamples(solrSamples),
      engineReported: summarizeTimingSamples(solrEngineSamples),
    },
    openSearch: {
      engine: 'OPENSEARCH',
      elapsed: summarizeTimingSamples(openSearchSamples),
      engineReported: summarizeTimingSamples(openSearchEngineSamples),
    },
  };
}

export function parseArguments(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    warmupRuns: DEFAULT_WARMUP_RUNS,
    measuredRuns: DEFAULT_MEASURED_RUNS,
    executionOrder: DEFAULT_EXECUTION_ORDER,
    output: 'browser-evidence-artifacts/search-comparison-benchmark.json',
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
      case '--warmups':
        options.warmupRuns = Number(value);
        index += 1;
        break;
      case '--samples':
        options.measuredRuns = Number(value);
        index += 1;
        break;
      case '--order':
        options.executionOrder = value;
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
        throw new Error(`Unknown benchmark argument: ${argument}`);
    }
  }

  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const result = await runSearchComparisonBenchmark({
    baseUrl: options.baseUrl,
    warmupRuns: options.warmupRuns,
    measuredRuns: options.measuredRuns,
    executionOrder: options.executionOrder,
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

  console.log(`Search comparison diagnostic written to ${outputPath}`);
  console.log(`Projection: ${result.projection.projectionId}`);
  console.log(`Execution order: ${result.executionOrder}`);
  console.log(
    `Solr API elapsed p50/p95/p99: ${result.solr.elapsed.p50Ms}/${result.solr.elapsed.p95Ms}/${result.solr.elapsed.p99Ms} ms`,
  );
  console.log(
    `OpenSearch API elapsed p50/p95/p99: ${result.openSearch.elapsed.p50Ms}/${result.openSearch.elapsed.p95Ms}/${result.openSearch.elapsed.p99Ms} ms`,
  );
  console.log(
    `Paired API median difference (OpenSearch - Solr): ${result.pairedStatistics.apiElapsed.medianDifferenceMs} ms; ${Math.round(result.pairedStatistics.apiElapsed.bootstrap.confidenceLevel * 100)}% bootstrap CI ${result.pairedStatistics.apiElapsed.bootstrap.lowerMs}..${result.pairedStatistics.apiElapsed.bootstrap.upperMs} ms`,
  );
  console.log(
    `Solr QTime p50/p95/p99: ${result.solr.engineReported.p50Ms}/${result.solr.engineReported.p95Ms}/${result.solr.engineReported.p99Ms} ms`,
  );
  console.log(
    `OpenSearch took p50/p95/p99: ${result.openSearch.engineReported.p50Ms}/${result.openSearch.engineReported.p95Ms}/${result.openSearch.engineReported.p99Ms} ms`,
  );
  console.log(result.caveat);
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
