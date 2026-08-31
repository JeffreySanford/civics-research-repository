import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  DEFAULT_SCENARIOS,
  runHundredKSearchComparisonMatrix,
} from './search-comparison-100k-matrix.mjs';

const DEFAULT_BASE_URL = 'http://localhost:8080/api';
const DEFAULT_OUTPUT =
  'browser-evidence-artifacts/search-comparison-100k-adaptive.json';

function requireFacetGroup(engine, field) {
  const group = engine?.facets?.find((facet) => facet.field === field);
  if (!group || !Array.isArray(group.values) || group.values.length === 0) {
    throw new Error(`No ${field} facet values are available for adaptive filtering.`);
  }
  return group;
}

function countMap(group) {
  return new Map(
    group.values.map((value) => [value.value, Number(value.count ?? 0)]),
  );
}

export function chooseSelectiveProgram(response) {
  if (!response?.sameProjection) {
    throw new Error('Adaptive filter discovery requires Solr/OpenSearch projection parity.');
  }
  if (!response?.solr?.reachable || !response?.openSearch?.reachable) {
    throw new Error('Adaptive filter discovery requires both engines to be reachable.');
  }

  const solrGroup = requireFacetGroup(response.solr, 'program');
  const openSearchGroup = requireFacetGroup(response.openSearch, 'program');
  const openSearchCounts = countMap(openSearchGroup);
  const total = Number(response?.projection?.objectCount ?? 0);
  if (!Number.isFinite(total) || total <= 0) {
    throw new Error('Adaptive filter discovery requires a positive projection object count.');
  }

  const minimumCount = Math.max(10, Math.floor(total * 0.001));
  const maximumCount = Math.floor(total * 0.5);
  const candidates = solrGroup.values
    .map((value) => ({
      value: value.value,
      count: Number(value.count ?? 0),
      openSearchCount: openSearchCounts.get(value.value),
    }))
    .filter(
      (candidate) =>
        typeof candidate.value === 'string' &&
        candidate.value.trim() !== '' &&
        Number.isFinite(candidate.count) &&
        candidate.count >= minimumCount &&
        candidate.count <= maximumCount &&
        candidate.openSearchCount === candidate.count,
    )
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));

  if (candidates.length === 0) {
    throw new Error(
      `No program facet has matching Solr/OpenSearch counts between ${minimumCount} and ${maximumCount} documents.`,
    );
  }
  return candidates[0];
}

export async function discoverSelectiveProgram({
  fetchImpl = globalThis.fetch,
  baseUrl = DEFAULT_BASE_URL,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('A fetch implementation is required.');
  }

  const endpoint = `${baseUrl.replace(/\/$/, '')}/search/comparison/run`;
  const request = {
    scenario: 'FACETED_SEARCH',
    query: '',
    page: 0,
    pageSize: 10,
  };
  const httpResponse = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!httpResponse.ok) {
    throw new Error(`Adaptive facet discovery failed with HTTP ${httpResponse.status}.`);
  }
  const response = await httpResponse.json();
  return chooseSelectiveProgram(response);
}

export function adaptiveScenarios(program) {
  if (!program?.value || !Number.isFinite(program.count)) {
    throw new Error('A valid selective program facet is required.');
  }
  return [
    DEFAULT_SCENARIOS[0],
    DEFAULT_SCENARIOS[1],
    Object.freeze({
      id: 'FILTERING_SELECTIVE_PROGRAM',
      request: Object.freeze({
        scenario: 'FILTERING',
        query: '',
        programs: Object.freeze([program.value]),
        page: 0,
        pageSize: 10,
      }),
    }),
  ];
}

export async function runAdaptiveHundredKBenchmark({
  fetchImpl = globalThis.fetch,
  baseUrl = DEFAULT_BASE_URL,
  warmupRuns = 5,
  measuredRuns = 100,
  now = () => new Date(),
} = {}) {
  const selectedProgram = await discoverSelectiveProgram({ fetchImpl, baseUrl });
  const matrix = await runHundredKSearchComparisonMatrix({
    fetchImpl,
    baseUrl,
    warmupRuns,
    measuredRuns,
    scenarios: adaptiveScenarios(selectedProgram),
    now,
  });
  return {
    ...matrix,
    kind: 'federated-100k-adaptive-search-comparison-matrix',
    selectedFilter: {
      field: 'program',
      value: selectedProgram.value,
      matchingDocuments: selectedProgram.count,
      selectivityPercent:
        Math.round(
          (selectedProgram.count / matrix.evidence.currentProjectionObjectCount) *
            10000,
        ) / 100,
    },
    methodology:
      `${matrix.methodology} The filtering workload is selected from the live program facet before measurement and requires identical Solr/OpenSearch facet counts; it intentionally avoids the DATASET type filter because Data.gov normalizes every harvested record as a dataset.`,
  };
}

export function parseArguments(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    warmupRuns: 5,
    measuredRuns: 100,
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
      default:
        throw new Error(`Unknown adaptive 100K benchmark argument: ${argument}`);
    }
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const result = await runAdaptiveHundredKBenchmark({
    baseUrl: options.baseUrl,
    warmupRuns: options.warmupRuns,
    measuredRuns: options.measuredRuns,
  });

  const outputPath = resolve(options.output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

  console.log(`Adaptive 100K search comparison written to ${outputPath}`);
  console.log(
    `Projection: ${result.evidence.currentProjectionId} (${result.evidence.currentProjectionObjectCount} documents)`,
  );
  console.log(
    `Selective filter: program=${JSON.stringify(result.selectedFilter.value)}, ${result.selectedFilter.matchingDocuments} documents (${result.selectedFilter.selectivityPercent}%)`,
  );
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
