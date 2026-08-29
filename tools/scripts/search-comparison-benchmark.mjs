import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_BASE_URL = 'http://localhost:8080/api';
const DEFAULT_WARMUP_RUNS = 3;
const DEFAULT_MEASURED_RUNS = 15;
const MAX_WARMUP_RUNS = 20;
const MAX_MEASURED_RUNS = 100;

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

  const endpoint = `${baseUrl.replace(/\/$/, '')}/search/comparison/run`;
  let projectionId = null;
  let projection = null;
  const solrSamples = [];
  const openSearchSamples = [];

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
      'Spring API elapsed time around each engine HTTP request. It includes local HTTP serialization/transport plus engine work, and excludes browser-to-repository-API latency.',
    executionOrder: 'SOLR_THEN_OPENSEARCH',
    comparativeClaimAllowed: false,
    caveat:
      'Warm-up runs are excluded, but engine order is fixed and this is a single local/container topology. Use these distributions as diagnostics, not as proof that either engine is inherently faster in production.',
    endpoint,
    request,
    projection,
    warmupRuns,
    measuredRuns,
    solr: {
      engine: 'SOLR',
      elapsed: summarizeTimingSamples(solrSamples),
    },
    openSearch: {
      engine: 'OPENSEARCH',
      elapsed: summarizeTimingSamples(openSearchSamples),
    },
  };
}

function parseArguments(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    warmupRuns: DEFAULT_WARMUP_RUNS,
    measuredRuns: DEFAULT_MEASURED_RUNS,
    output: 'browser-evidence-artifacts/search-comparison-benchmark.json',
    scenario: 'FULL_TEXT_RELEVANCE',
    query: 'North Dakota workforce',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    switch (argument) {
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
  console.log(
    `Solr API elapsed p50/p95/p99: ${result.solr.elapsed.p50Ms}/${result.solr.elapsed.p95Ms}/${result.solr.elapsed.p99Ms} ms`,
  );
  console.log(
    `OpenSearch API elapsed p50/p95/p99: ${result.openSearch.elapsed.p50Ms}/${result.openSearch.elapsed.p95Ms}/${result.openSearch.elapsed.p99Ms} ms`,
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
