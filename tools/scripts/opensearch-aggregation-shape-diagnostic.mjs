import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { discoverSelectiveProgram } from './search-comparison-100k-adaptive.mjs';
import { summarizeTimingSamples } from './search-comparison-benchmark.mjs';

const DEFAULT_API_BASE_URL = 'http://localhost:8080/api';
const DEFAULT_OPENSEARCH_BASE_URL = 'http://localhost:9200';
const DEFAULT_INDEX = 'discovery-comparison';
const DEFAULT_OUTPUT =
  'browser-evidence-artifacts/opensearch-aggregation-shape-diagnostic.json';

const FACETS = Object.freeze([
  Object.freeze({ name: 'program', field: 'programName', size: 100 }),
  Object.freeze({ name: 'publisher', field: 'publisher.keyword', size: 100 }),
  Object.freeze({ name: 'sourceSystem', field: 'sourceSystem', size: 25 }),
  Object.freeze({ name: 'geography', field: 'geography.keyword', size: 100 }),
  Object.freeze({ name: 'contentType', field: 'contentType', size: 25 }),
  Object.freeze({ name: 'vintageYear', field: 'vintageYear', size: 50 }),
]);

function requireBoundedInteger(value, label, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `${label} must be an integer from ${minimum} to ${maximum}.`,
    );
  }
  return value;
}

function termsAggregation(facet) {
  const terms = { field: facet.field, size: facet.size };
  if (facet.name === 'vintageYear') {
    terms.order = { _key: 'desc' };
  }
  return { terms };
}

export function currentUnfilteredAggregations() {
  return Object.fromEntries(
    FACETS.map((facet) => [
      `${facet.name}_scope`,
      {
        filter: { match_all: {} },
        aggs: { values: termsAggregation(facet) },
      },
    ]),
  );
}

export function directUnfilteredAggregations() {
  return Object.fromEntries(
    FACETS.map((facet) => [`${facet.name}_scope`, termsAggregation(facet)]),
  );
}

function programFilter(program) {
  return { terms: { programName: [program] } };
}

export function currentSelectiveAggregations(program) {
  return Object.fromEntries(
    FACETS.map((facet) => {
      const filters = facet.name === 'program' ? [] : [programFilter(program)];
      const scope =
        filters.length === 0
          ? { match_all: {} }
          : { bool: { filter: filters } };
      return [
        `${facet.name}_scope`,
        {
          filter: scope,
          aggs: { values: termsAggregation(facet) },
        },
      ];
    }),
  );
}

export function groupedSelectiveAggregations(program) {
  const programFacet = FACETS.find((facet) => facet.name === 'program');
  const sharedFacets = FACETS.filter((facet) => facet.name !== 'program');
  return {
    program_scope: termsAggregation(programFacet),
    shared_program_scope: {
      filter: { bool: { filter: [programFilter(program)] } },
      aggs: Object.fromEntries(
        sharedFacets.map((facet) => [
          `${facet.name}_scope`,
          termsAggregation(facet),
        ]),
      ),
    },
  };
}

function searchBody(aggregations, program = null) {
  const body = {
    from: 0,
    size: 10,
    track_total_hits: true,
    query: { match_all: {} },
    aggs: aggregations,
  };
  if (program) {
    body.post_filter = { bool: { filter: [programFilter(program)] } };
  }
  return body;
}

function bucketMap(buckets) {
  return Object.fromEntries(
    buckets
      .map((bucket) => [
        String(bucket.key_as_string ?? bucket.key),
        Number(bucket.doc_count),
      ])
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

export function canonicalFacetCounts(response, shape) {
  const aggregations = response?.aggregations ?? {};
  const counts = {};
  for (const facet of FACETS) {
    let node;
    if (shape === 'current') {
      node = aggregations[`${facet.name}_scope`]?.values;
    } else if (shape === 'direct') {
      node = aggregations[`${facet.name}_scope`];
    } else if (shape === 'grouped') {
      node =
        facet.name === 'program'
          ? aggregations.program_scope
          : aggregations.shared_program_scope?.[`${facet.name}_scope`];
    } else {
      throw new Error(`Unknown aggregation response shape: ${shape}.`);
    }
    counts[facet.name] = bucketMap(node?.buckets ?? []);
  }
  return counts;
}

async function fetchJson(fetchImpl, url, init) {
  const response = await fetchImpl(url, init);
  if (!response.ok) {
    throw new Error(`Request failed with HTTP ${response.status}: ${url}`);
  }
  return response.json();
}

async function executeSearch(fetchImpl, endpoint, body) {
  const started = performance.now();
  const response = await fetchJson(fetchImpl, endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return {
    response,
    elapsedMs: Math.max(0, performance.now() - started),
    tookMs: Number(response.took),
  };
}

function validateTiming(sample, label) {
  if (!Number.isFinite(sample.elapsedMs) || sample.elapsedMs < 0) {
    throw new Error(`${label} elapsed time is invalid.`);
  }
  if (!Number.isFinite(sample.tookMs) || sample.tookMs < 0) {
    throw new Error(`${label} OpenSearch took is invalid.`);
  }
}

async function compareShapes({
  fetchImpl,
  endpoint,
  baselineBody,
  candidateBody,
  baselineShape,
  candidateShape,
  warmupRuns,
  measuredRuns,
}) {
  const baselineElapsed = [];
  const baselineTook = [];
  const candidateElapsed = [];
  const candidateTook = [];

  const executePair = async (record, candidateFirst) => {
    const sequence = candidateFirst
      ? [
          ['candidate', candidateBody, candidateShape],
          ['baseline', baselineBody, baselineShape],
        ]
      : [
          ['baseline', baselineBody, baselineShape],
          ['candidate', candidateBody, candidateShape],
        ];
    const pair = {};
    for (const [label, body, shape] of sequence) {
      pair[label] = {
        ...(await executeSearch(fetchImpl, endpoint, body)),
        shape,
      };
      validateTiming(pair[label], label);
    }

    assert.deepEqual(
      canonicalFacetCounts(pair.baseline.response, pair.baseline.shape),
      canonicalFacetCounts(pair.candidate.response, pair.candidate.shape),
      'Candidate aggregation shape changed facet bucket counts.',
    );
    assert.equal(
      pair.baseline.response?.hits?.total?.value,
      pair.candidate.response?.hits?.total?.value,
      'Candidate aggregation shape changed total hit count.',
    );

    if (record) {
      baselineElapsed.push(pair.baseline.elapsedMs);
      baselineTook.push(pair.baseline.tookMs);
      candidateElapsed.push(pair.candidate.elapsedMs);
      candidateTook.push(pair.candidate.tookMs);
    }
  };

  for (let index = 0; index < warmupRuns; index += 1) {
    await executePair(false, index % 2 === 1);
  }
  for (let index = 0; index < measuredRuns; index += 1) {
    await executePair(true, index % 2 === 1);
  }

  return {
    baseline: {
      elapsed: summarizeTimingSamples(baselineElapsed),
      took: summarizeTimingSamples(baselineTook),
    },
    candidate: {
      elapsed: summarizeTimingSamples(candidateElapsed),
      took: summarizeTimingSamples(candidateTook),
    },
  };
}

async function fetchEvidence(fetchImpl, apiBaseUrl) {
  const endpoint = `${apiBaseUrl.replace(/\/$/, '')}/admin/corpus/scale/evidence?profile=FEDERATED_100K`;
  const evidence = await fetchJson(fetchImpl, endpoint);
  if (!evidence?.valid || evidence.activeProfile !== 'FEDERATED_100K') {
    throw new Error('FEDERATED_100K evidence is not valid and active.');
  }
  if (!evidence.targetParity) {
    throw new Error('FEDERATED_100K evidence reports target parity false.');
  }
  return evidence;
}

async function fetchOpenSearchCount(fetchImpl, openSearchBaseUrl, index) {
  const endpoint = `${openSearchBaseUrl.replace(/\/$/, '')}/${index}/_count`;
  const response = await fetchJson(fetchImpl, endpoint);
  return Number(response.count);
}

export async function runOpenSearchAggregationShapeDiagnostic({
  fetchImpl = globalThis.fetch,
  apiBaseUrl = DEFAULT_API_BASE_URL,
  openSearchBaseUrl = DEFAULT_OPENSEARCH_BASE_URL,
  index = DEFAULT_INDEX,
  warmupRuns = 3,
  measuredRuns = 20,
  now = () => new Date(),
} = {}) {
  requireBoundedInteger(warmupRuns, 'warmupRuns', 0, 20);
  requireBoundedInteger(measuredRuns, 'measuredRuns', 1, 100);

  const evidence = await fetchEvidence(fetchImpl, apiBaseUrl);
  const openSearchCount = await fetchOpenSearchCount(
    fetchImpl,
    openSearchBaseUrl,
    index,
  );
  if (openSearchCount !== evidence.currentProjectionObjectCount) {
    throw new Error(
      `OpenSearch count ${openSearchCount} does not match evidence count ${evidence.currentProjectionObjectCount}.`,
    );
  }

  const selectedProgram = await discoverSelectiveProgram({
    fetchImpl,
    baseUrl: apiBaseUrl,
  });
  const endpoint = `${openSearchBaseUrl.replace(/\/$/, '')}/${index}/_search`;

  const unfiltered = await compareShapes({
    fetchImpl,
    endpoint,
    baselineBody: searchBody(currentUnfilteredAggregations()),
    candidateBody: searchBody(directUnfilteredAggregations()),
    baselineShape: 'current',
    candidateShape: 'direct',
    warmupRuns,
    measuredRuns,
  });

  const selective = await compareShapes({
    fetchImpl,
    endpoint,
    baselineBody: searchBody(
      currentSelectiveAggregations(selectedProgram.value),
      selectedProgram.value,
    ),
    candidateBody: searchBody(
      groupedSelectiveAggregations(selectedProgram.value),
      selectedProgram.value,
    ),
    baselineShape: 'current',
    candidateShape: 'grouped',
    warmupRuns,
    measuredRuns,
  });

  return {
    kind: 'opensearch-aggregation-shape-diagnostic',
    capturedAt: now().toISOString(),
    profile: 'FEDERATED_100K',
    projection: {
      projectionId: evidence.currentProjectionId,
      objectCount: evidence.currentProjectionObjectCount,
    },
    index,
    selectedProgram,
    warmupRuns,
    measuredRuns,
    methodology:
      'Candidate and current OpenSearch aggregation shapes are alternated against the same live alias. Every pair must return identical total hits and facet bucket counts before timings are retained. This isolates aggregation construction without changing the application implementation.',
    experiments: {
      unfilteredDirectTerms: unfiltered,
      selectiveSharedFilterScope: selective,
    },
  };
}

export function parseArguments(argv) {
  const options = {
    apiBaseUrl: DEFAULT_API_BASE_URL,
    openSearchBaseUrl: DEFAULT_OPENSEARCH_BASE_URL,
    index: DEFAULT_INDEX,
    warmupRuns: 3,
    measuredRuns: 20,
    output: DEFAULT_OUTPUT,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    switch (argument) {
      case '--':
        break;
      case '--api-base-url':
        options.apiBaseUrl = value;
        index += 1;
        break;
      case '--opensearch-base-url':
        options.openSearchBaseUrl = value;
        index += 1;
        break;
      case '--index':
        options.index = value;
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
        throw new Error(`Unknown aggregation diagnostic argument: ${argument}`);
    }
  }
  return options;
}

function printExperiment(label, experiment) {
  console.log(`\n${label}`);
  console.log(
    `Current elapsed p50/p95/p99 ${experiment.baseline.elapsed.p50Ms}/${experiment.baseline.elapsed.p95Ms}/${experiment.baseline.elapsed.p99Ms} ms; candidate ${experiment.candidate.elapsed.p50Ms}/${experiment.candidate.elapsed.p95Ms}/${experiment.candidate.elapsed.p99Ms} ms`,
  );
  console.log(
    `Current took p50/p95/p99 ${experiment.baseline.took.p50Ms}/${experiment.baseline.took.p95Ms}/${experiment.baseline.took.p99Ms} ms; candidate ${experiment.candidate.took.p50Ms}/${experiment.candidate.took.p95Ms}/${experiment.candidate.took.p99Ms} ms`,
  );
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const result = await runOpenSearchAggregationShapeDiagnostic({
    apiBaseUrl: options.apiBaseUrl,
    openSearchBaseUrl: options.openSearchBaseUrl,
    index: options.index,
    warmupRuns: options.warmupRuns,
    measuredRuns: options.measuredRuns,
  });

  const outputPath = resolve(options.output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

  console.log(`OpenSearch aggregation diagnostic written to ${outputPath}`);
  console.log(
    `Projection: ${result.projection.projectionId} (${result.projection.objectCount} documents)`,
  );
  console.log(
    `Selective program: ${JSON.stringify(result.selectedProgram.value)} (${result.selectedProgram.count} documents)`,
  );
  printExperiment(
    'UNFILTERED: current filter/match_all scopes vs direct terms',
    result.experiments.unfilteredDirectTerms,
  );
  printExperiment(
    'SELECTIVE: current duplicated scopes vs one shared filter scope',
    result.experiments.selectiveSharedFilterScope,
  );
  console.log(`\n${result.methodology}`);
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
