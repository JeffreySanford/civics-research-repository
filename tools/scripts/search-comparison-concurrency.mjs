import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  adaptiveScenarios,
  discoverSelectiveProgram,
} from './search-comparison-100k-adaptive.mjs';
import {
  buildExecutionOrderPlan,
  summarizeTimingSamples,
} from './search-comparison-benchmark.mjs';
import { summarizePairedLatencyEvidence } from './search-comparison-statistics.mjs';

const DEFAULT_BASE_URL = 'http://localhost:8080/api';
const DEFAULT_PROFILE = 'FEDERATED_100K';
const DEFAULT_CONCURRENCY_LEVELS = Object.freeze([1, 8, 32]);
const DEFAULT_BATCHES = 6;
const DEFAULT_WARMUP_ROUNDS = 1;
const DEFAULT_MEASURED_ROUNDS = 5;
const DEFAULT_SEED = 20260903;
const DEFAULT_OUTPUT =
  'browser-evidence-artifacts/search-comparison-concurrency.json';

function requireInteger(value, label, minimum, maximum) {
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

function requireProjectionId(value, label) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 projection ID.`);
  }
  return value;
}

export function parseConcurrencyLevels(value) {
  const values = Array.isArray(value)
    ? value
    : String(value)
        .split(',')
        .map((entry) => Number(entry.trim()));
  if (values.length === 0) {
    throw new Error('At least one concurrency level is required.');
  }

  const normalized = values.map((level) =>
    requireInteger(level, 'concurrency level', 1, 64),
  );
  if (new Set(normalized).size !== normalized.length) {
    throw new Error('Concurrency levels must be unique.');
  }
  return normalized;
}

async function fetchScaleEvidence(fetchImpl, baseUrl, profile) {
  const endpoint = `${baseUrl.replace(/\/$/, '')}/admin/corpus/scale/evidence?profile=${encodeURIComponent(profile)}`;
  const response = await fetchImpl(endpoint);
  if (!response.ok) {
    throw new Error(
      `Corpus scale evidence request failed with HTTP ${response.status}.`,
    );
  }

  const evidence = await response.json();
  if (!evidence?.valid || evidence.activeProfile !== profile) {
    throw new Error(`Corpus scale evidence is not valid for ${profile}.`);
  }
  if (!evidence.targetParity) {
    throw new Error(
      'Corpus scale evidence reports discovery target parity false.',
    );
  }
  requireProjectionId(
    evidence.currentProjectionId,
    'Evidence currentProjectionId',
  );
  return evidence;
}

function validateEngine(engine, label) {
  if (!engine?.enabled || !engine.reachable) {
    throw new Error(`${label} is unavailable during concurrency measurement.`);
  }
  requireTiming(engine.elapsedMs, `${label} elapsedMs`);
  requireTiming(engine.engineReportedMs, `${label} engineReportedMs`);
}

function validateComparisonResponse(response, expectedProjectionId) {
  if (!response?.sameProjection) {
    throw new Error(
      'Solr and OpenSearch are not on the same deterministic projection.',
    );
  }
  const projectionId = requireProjectionId(
    response?.projection?.projectionId,
    'Comparison projectionId',
  );
  if (projectionId !== expectedProjectionId) {
    throw new Error('Projection changed during concurrency measurement.');
  }
  validateEngine(response.solr, 'Solr');
  validateEngine(response.openSearch, 'OpenSearch');
  return response;
}

async function executeComparison({
  fetchImpl,
  endpoint,
  request,
  expectedProjectionId,
  monotonicNow,
}) {
  const startedAt = monotonicNow();
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

  const payload = await httpResponse.json();
  const completedAt = monotonicNow();
  const response = validateComparisonResponse(payload, expectedProjectionId);
  return {
    comparisonRoundTripMs: requireTiming(
      completedAt - startedAt,
      'Comparison round-trip',
    ),
    solrApiElapsedMs: response.solr.elapsedMs,
    openSearchApiElapsedMs: response.openSearch.elapsedMs,
    solrEngineReportedMs: response.solr.engineReportedMs,
    openSearchEngineReportedMs: response.openSearch.engineReportedMs,
  };
}

async function executeConcurrentRound({
  concurrency,
  fetchImpl,
  endpoint,
  request,
  expectedProjectionId,
  monotonicNow,
}) {
  const roundStartedAt = monotonicNow();
  const samples = await Promise.all(
    Array.from({ length: concurrency }, () =>
      executeComparison({
        fetchImpl,
        endpoint,
        request,
        expectedProjectionId,
        monotonicNow,
      }),
    ),
  );
  const roundCompletedAt = monotonicNow();
  return {
    wallMs: requireTiming(roundCompletedAt - roundStartedAt, 'Round wall time'),
    samples,
  };
}

function appendRoundSamples(
  target,
  round,
  batchId,
  roundNumber,
  executionOrder,
) {
  for (const [clientIndex, sample] of round.samples.entries()) {
    target.push({
      batchId,
      roundNumber,
      clientIndex: clientIndex + 1,
      executionOrder,
      ...sample,
    });
  }
}

function summarizeSamples(samples) {
  const solrApi = samples.map((sample) => sample.solrApiElapsedMs);
  const openSearchApi = samples.map((sample) => sample.openSearchApiElapsedMs);
  const solrEngine = samples.map((sample) => sample.solrEngineReportedMs);
  const openSearchEngine = samples.map(
    (sample) => sample.openSearchEngineReportedMs,
  );
  const comparisonRoundTrip = samples.map(
    (sample) => sample.comparisonRoundTripMs,
  );

  return {
    pairedStatistics: {
      apiElapsed: summarizePairedLatencyEvidence(solrApi, openSearchApi),
      engineReported: summarizePairedLatencyEvidence(
        solrEngine,
        openSearchEngine,
      ),
    },
    solr: {
      apiElapsed: summarizeTimingSamples(solrApi),
      engineReported: summarizeTimingSamples(solrEngine),
    },
    openSearch: {
      apiElapsed: summarizeTimingSamples(openSearchApi),
      engineReported: summarizeTimingSamples(openSearchEngine),
    },
    comparisonRoundTrip: summarizeTimingSamples(comparisonRoundTrip),
  };
}

function throughputEvidence(requestCount, wallMs) {
  const seconds = wallMs / 1000;
  const comparisonRequestsPerSecond =
    seconds === 0 ? null : requestCount / seconds;
  return {
    measuredComparisonRequests: requestCount,
    measuredWallMs: Math.round(wallMs * 100) / 100,
    comparisonRequestsPerSecond:
      comparisonRequestsPerSecond === null
        ? null
        : Math.round(comparisonRequestsPerSecond * 100) / 100,
    perEngineQueriesPerSecond:
      comparisonRequestsPerSecond === null
        ? null
        : Math.round(comparisonRequestsPerSecond * 100) / 100,
    totalEngineQueriesPerSecond:
      comparisonRequestsPerSecond === null
        ? null
        : Math.round(comparisonRequestsPerSecond * 2 * 100) / 100,
    interpretation:
      'Each comparison request issues one query to Solr and one to OpenSearch. Per-engine query throughput therefore equals comparison-request throughput; total engine-query throughput is twice that value.',
  };
}

async function runConcurrentWorkload({
  fetchImpl,
  baseUrl,
  expectedProjectionId,
  scenario,
  concurrency,
  batches,
  warmupRounds,
  measuredRounds,
  seed,
  monotonicNow,
}) {
  const orderPlan = buildExecutionOrderPlan({
    batches,
    executionOrder: 'SOLR_FIRST',
    orderStrategy: 'RANDOMIZED',
    seed,
  });
  const samples = [];
  const batchEvidence = [];
  let measuredWallMs = 0;

  for (const [batchIndex, executionOrder] of orderPlan.entries()) {
    const endpoint = `${baseUrl.replace(/\/$/, '')}/search/comparison/run?order=${encodeURIComponent(executionOrder)}`;
    for (let roundIndex = 0; roundIndex < warmupRounds; roundIndex += 1) {
      await executeConcurrentRound({
        concurrency,
        fetchImpl,
        endpoint,
        request: scenario.request,
        expectedProjectionId,
        monotonicNow,
      });
    }

    const batchSamples = [];
    let batchWallMs = 0;
    for (let roundIndex = 0; roundIndex < measuredRounds; roundIndex += 1) {
      const round = await executeConcurrentRound({
        concurrency,
        fetchImpl,
        endpoint,
        request: scenario.request,
        expectedProjectionId,
        monotonicNow,
      });
      batchWallMs += round.wallMs;
      appendRoundSamples(
        batchSamples,
        round,
        batchIndex + 1,
        roundIndex + 1,
        executionOrder,
      );
    }

    samples.push(...batchSamples);
    measuredWallMs += batchWallMs;
    batchEvidence.push({
      batchId: batchIndex + 1,
      executionOrder,
      measuredRounds,
      sampleCount: batchSamples.length,
      throughput: throughputEvidence(batchSamples.length, batchWallMs),
      summary: summarizeSamples(batchSamples),
    });
  }

  return {
    id: scenario.id,
    workloadClass: scenario.workloadClass,
    description: scenario.description,
    request: scenario.request,
    concurrency,
    executionOrderPlan: orderPlan,
    warmupRoundsPerBatch: warmupRounds,
    measuredRoundsPerBatch: measuredRounds,
    totalMeasuredComparisons: samples.length,
    throughput: throughputEvidence(samples.length, measuredWallMs),
    summary: summarizeSamples(samples),
    batchEvidence,
    rawSamples: samples,
  };
}

export async function runConcurrencyMatrix({
  fetchImpl = globalThis.fetch,
  baseUrl = DEFAULT_BASE_URL,
  profile = DEFAULT_PROFILE,
  concurrencyLevels = DEFAULT_CONCURRENCY_LEVELS,
  batches = DEFAULT_BATCHES,
  warmupRounds = DEFAULT_WARMUP_ROUNDS,
  measuredRounds = DEFAULT_MEASURED_ROUNDS,
  seed = DEFAULT_SEED,
  monotonicNow = () => performance.now(),
  now = () => new Date(),
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('A fetch implementation is required.');
  }
  const levels = parseConcurrencyLevels(concurrencyLevels);
  requireInteger(batches, 'batches', 2, 20);
  requireInteger(warmupRounds, 'warmupRounds', 0, 10);
  requireInteger(measuredRounds, 'measuredRounds', 1, 50);
  requireInteger(seed, 'seed', 0, Number.MAX_SAFE_INTEGER);

  const evidence = await fetchScaleEvidence(fetchImpl, baseUrl, profile);
  const selectedProgram = await discoverSelectiveProgram({
    fetchImpl,
    baseUrl,
  });
  const scenarios = adaptiveScenarios(selectedProgram);
  const workloads = [];

  for (const [scenarioIndex, scenario] of scenarios.entries()) {
    const concurrencyResults = [];
    for (const concurrency of levels) {
      concurrencyResults.push(
        await runConcurrentWorkload({
          fetchImpl,
          baseUrl,
          expectedProjectionId: evidence.currentProjectionId,
          scenario,
          concurrency,
          batches,
          warmupRounds,
          measuredRounds,
          seed: seed + scenarioIndex * 1000 + concurrency,
          monotonicNow,
        }),
      );
    }
    workloads.push({
      id: scenario.id,
      workloadClass: scenario.workloadClass,
      description: scenario.description,
      concurrencyResults,
    });
  }

  return {
    kind: 'federated-search-comparison-concurrency-matrix',
    capturedAt: now().toISOString(),
    profile,
    projection: {
      projectionId: evidence.currentProjectionId,
      objectCount: evidence.currentProjectionObjectCount,
      retainedFederatedRecordCount: evidence.retainedFederatedRecordCount,
    },
    selectedFilter: {
      field: 'program',
      value: selectedProgram.value,
      matchingDocuments: selectedProgram.count,
    },
    concurrencyLevels: levels,
    batches,
    warmupRoundsPerBatch: warmupRounds,
    measuredRoundsPerBatch: measuredRounds,
    seed,
    comparativeClaimAllowed: false,
    methodology:
      'Concurrency is applied at the comparison-request boundary. Each concurrent client issues the same normalized workload through one comparison request, which performs one Solr and one OpenSearch query against the same deterministic projection. Every batch repeats excluded warmup rounds and uses a deterministically randomized, balanced engine-first order plan. API elapsed, engine-native timing, full comparison round-trip latency including response-body consumption, achieved paired-request throughput and batch-level evidence are retained separately. This measures the documented local comparison topology under concurrent load; it is not a universal production-capacity claim.',
    workloads,
  };
}

export function parseArguments(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    profile: DEFAULT_PROFILE,
    concurrencyLevels: [...DEFAULT_CONCURRENCY_LEVELS],
    batches: DEFAULT_BATCHES,
    warmupRounds: DEFAULT_WARMUP_ROUNDS,
    measuredRounds: DEFAULT_MEASURED_ROUNDS,
    seed: DEFAULT_SEED,
    output: DEFAULT_OUTPUT,
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
      case '--profile':
        options.profile = value;
        index += 1;
        break;
      case '--concurrency':
        options.concurrencyLevels = parseConcurrencyLevels(value);
        index += 1;
        break;
      case '--batches':
        options.batches = Number(value);
        index += 1;
        break;
      case '--warmup-rounds':
        options.warmupRounds = Number(value);
        index += 1;
        break;
      case '--rounds':
        options.measuredRounds = Number(value);
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
      default:
        throw new Error(`Unknown concurrency benchmark argument: ${argument}`);
    }
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const result = await runConcurrencyMatrix({
    baseUrl: options.baseUrl,
    profile: options.profile,
    concurrencyLevels: options.concurrencyLevels,
    batches: options.batches,
    warmupRounds: options.warmupRounds,
    measuredRounds: options.measuredRounds,
    seed: options.seed,
  });

  const outputPath = resolve(options.output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

  console.log(`Concurrency comparison matrix written to ${outputPath}`);
  console.log(
    `Projection: ${result.projection.projectionId} (${result.projection.objectCount} documents)`,
  );
  console.log(`Concurrency levels: ${result.concurrencyLevels.join(', ')}`);
  for (const workload of result.workloads) {
    for (const level of workload.concurrencyResults) {
      console.log(
        `${workload.id} @ ${level.concurrency} clients: ${level.throughput.comparisonRequestsPerSecond} paired requests/s; Solr API p50/p95 ${level.summary.solr.apiElapsed.p50Ms}/${level.summary.solr.apiElapsed.p95Ms} ms; OpenSearch API p50/p95 ${level.summary.openSearch.apiElapsed.p50Ms}/${level.summary.openSearch.apiElapsed.p95Ms} ms`,
      );
    }
  }
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
