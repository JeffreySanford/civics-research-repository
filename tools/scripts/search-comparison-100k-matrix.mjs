import { mkdir, writeFile } from 'node:fs/promises';
import { arch, cpus, platform, totalmem } from 'node:os';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runSearchComparisonBenchmark } from './search-comparison-benchmark.mjs';

const DEFAULT_BASE_URL = 'http://localhost:8080/api';
const DEFAULT_PROFILE = 'FEDERATED_100K';
const DEFAULT_EXECUTION_ORDER = 'SOLR_FIRST';
const DEFAULT_OUTPUT =
  'browser-evidence-artifacts/search-comparison-100k-matrix.json';

export const DEFAULT_SCENARIOS = Object.freeze([
  Object.freeze({
    id: 'FULL_TEXT_RELEVANCE',
    workloadClass: 'FULL_TEXT',
    description: 'Weighted title, summary and publisher text relevance.',
    request: Object.freeze({
      scenario: 'FULL_TEXT_RELEVANCE',
      query: 'North Dakota workforce',
      page: 0,
      pageSize: 10,
    }),
  }),
  Object.freeze({
    id: 'FACETED_SEARCH',
    workloadClass: 'FACETS',
    description: 'Unqualified corpus-wide facet and aggregation workload.',
    request: Object.freeze({
      scenario: 'FACETED_SEARCH',
      query: '',
      page: 0,
      pageSize: 10,
    }),
  }),
  Object.freeze({
    id: 'FILTERING_BROAD_TYPE',
    workloadClass: 'BROAD_FILTER',
    description:
      'Broad type filter expected to match most harvested Data.gov records.',
    request: Object.freeze({
      scenario: 'FILTERING',
      query: '',
      contentType: 'DATASET',
      page: 0,
      pageSize: 10,
    }),
  }),
]);

function requireBoundedInteger(value, label, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `${label} must be an integer from ${minimum} to ${maximum}.`,
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

export function summarizeHostContext(
  os = {
    cpus,
    totalmem,
    platform,
    arch,
  },
) {
  return {
    logicalCpuCount: os.cpus().length,
    totalMemoryBytes: os.totalmem(),
    platform: os.platform(),
    architecture: os.arch(),
  };
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
  if (!evidence?.valid) {
    const violations = Array.isArray(evidence?.violations)
      ? evidence.violations.join(' | ')
      : 'unknown evidence violation';
    throw new Error(
      `Corpus scale evidence is not valid for ${profile}: ${violations}`,
    );
  }
  if (evidence.activeProfile !== profile) {
    throw new Error(
      `Corpus scale evidence reports ${evidence.activeProfile} active instead of ${profile}.`,
    );
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

export async function runHundredKSearchComparisonMatrix({
  fetchImpl = globalThis.fetch,
  baseUrl = DEFAULT_BASE_URL,
  profile = DEFAULT_PROFILE,
  warmupRuns = 5,
  measuredRuns = 100,
  executionOrder = DEFAULT_EXECUTION_ORDER,
  scenarios = DEFAULT_SCENARIOS,
  now = () => new Date(),
  hostContext = summarizeHostContext(),
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('A fetch implementation is required.');
  }
  requireBoundedInteger(warmupRuns, 'warmupRuns', 0, 20);
  requireBoundedInteger(measuredRuns, 'measuredRuns', 1, 100);
  if (!Array.isArray(scenarios) || scenarios.length === 0) {
    throw new Error('At least one benchmark scenario is required.');
  }

  const evidence = await fetchScaleEvidence(fetchImpl, baseUrl, profile);
  const expectedProjectionId = requireProjectionId(
    evidence.currentProjectionId,
    'Evidence currentProjectionId',
  );
  const results = [];

  for (const scenario of scenarios) {
    const result = await runSearchComparisonBenchmark({
      fetchImpl,
      baseUrl,
      warmupRuns,
      measuredRuns,
      executionOrder,
      request: scenario.request,
      now,
    });
    if (result.projection?.projectionId !== expectedProjectionId) {
      throw new Error(
        `Projection changed before or during scenario ${scenario.id}.`,
      );
    }
    results.push({
      id: scenario.id,
      workloadClass: scenario.workloadClass,
      description: scenario.description,
      ...result,
    });
  }

  return {
    kind: 'federated-100k-search-comparison-matrix',
    capturedAt: now().toISOString(),
    profile,
    executionOrder,
    comparativeClaimAllowed: false,
    methodology:
      'Each workload uses the existing diagnostic harness with warmups excluded and the same deterministic projection required for every sample. The matrix distinguishes full-text relevance, corpus-wide facets, broad filtering, and adaptive selective filtering. Engine execution order is explicit so reversed-order passes can test order sensitivity. Results remain local single-topology diagnostics rather than proof that either engine is inherently faster in production.',
    evidence: {
      retainedFederatedRecordCount: evidence.retainedFederatedRecordCount,
      activeProfile: evidence.activeProfile,
      currentProjectionObjectCount: evidence.currentProjectionObjectCount,
      currentProjectionId: expectedProjectionId,
      targetParity: evidence.targetParity,
      storageEvidencePresent: evidence.storageEvidencePresent,
      storageProjectionId: evidence.storageProjectionId,
      storageCapturedAt: evidence.storageCapturedAt,
    },
    hostContext,
    warmupRuns,
    measuredRuns,
    scenarios: results,
  };
}

export function parseArguments(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    profile: DEFAULT_PROFILE,
    warmupRuns: 5,
    measuredRuns: 100,
    executionOrder: DEFAULT_EXECUTION_ORDER,
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
      default:
        throw new Error(`Unknown 100K benchmark argument: ${argument}`);
    }
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const result = await runHundredKSearchComparisonMatrix({
    baseUrl: options.baseUrl,
    profile: options.profile,
    warmupRuns: options.warmupRuns,
    measuredRuns: options.measuredRuns,
    executionOrder: options.executionOrder,
  });

  const outputPath = resolve(options.output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

  console.log(`100K search comparison matrix written to ${outputPath}`);
  console.log(
    `Profile/projection: ${result.profile} / ${result.evidence.currentProjectionId}`,
  );
  console.log(`Execution order: ${result.executionOrder}`);
  for (const scenario of result.scenarios) {
    console.log(
      `${scenario.id}: Solr API p50/p95/p99 ${scenario.solr.elapsed.p50Ms}/${scenario.solr.elapsed.p95Ms}/${scenario.solr.elapsed.p99Ms} ms; OpenSearch API p50/p95/p99 ${scenario.openSearch.elapsed.p50Ms}/${scenario.openSearch.elapsed.p95Ms}/${scenario.openSearch.elapsed.p99Ms} ms`,
    );
    console.log(
      `${scenario.id}: Solr QTime p50/p95/p99 ${scenario.solr.engineReported.p50Ms}/${scenario.solr.engineReported.p95Ms}/${scenario.solr.engineReported.p99Ms} ms; OpenSearch took p50/p95/p99 ${scenario.openSearch.engineReported.p50Ms}/${scenario.openSearch.engineReported.p95Ms}/${scenario.openSearch.engineReported.p99Ms} ms`,
    );
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
