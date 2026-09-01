import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { runScaleEvidenceCheck } from './scale-evidence-check.mjs';
import { runSearchComparisonBenchmark } from './search-comparison-benchmark.mjs';

const DEFAULT_BASE_URL = 'http://localhost:8080/api';
const DEFAULT_MATRIX = 'planning/evidence/SEARCH_SEMANTIC_MATRIX_V1.json';
const DEFAULT_OUTPUT =
  'browser-evidence-artifacts/search-semantic/c2-search-semantic-v1.json';
const DEFAULT_WARMUPS = 2;
const DEFAULT_SAMPLES = 20;
const EXECUTION_ORDERS = Object.freeze(['SOLR_FIRST', 'OPENSEARCH_FIRST']);
const SCENARIOS = new Set([
  'FULL_TEXT_RELEVANCE',
  'FACETED_SEARCH',
  'FILTERING',
]);

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

function requireInteger(value, label, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `${label} must be an integer from ${minimum} to ${maximum}.`,
    );
  }
  return value;
}

function requireProjectionId(value, label) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/u.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 projection ID.`);
  }
  return value;
}

function requireMatrix(matrix) {
  if (!matrix || typeof matrix !== 'object') {
    throw new Error('Semantic matrix must be a JSON object.');
  }
  if (matrix.schemaVersion !== '1.0.0') {
    throw new Error('Semantic matrix schemaVersion must be 1.0.0.');
  }
  if (matrix.profile !== 'FEDERATED_1M') {
    throw new Error('Semantic matrix v1 is bound to FEDERATED_1M.');
  }
  if (!Array.isArray(matrix.queries) || matrix.queries.length === 0) {
    throw new Error('Semantic matrix must contain at least one query.');
  }

  const ids = new Set();
  for (const query of matrix.queries) {
    if (typeof query?.id !== 'string' || query.id.trim() === '') {
      throw new Error('Every semantic query requires a non-empty id.');
    }
    if (ids.has(query.id)) {
      throw new Error(`Duplicate semantic query id: ${query.id}.`);
    }
    ids.add(query.id);
    if (!SCENARIOS.has(query?.request?.scenario)) {
      throw new Error(
        `Query ${query.id} has unsupported scenario ${query?.request?.scenario ?? 'missing'}.`,
      );
    }
    requireInteger(
      query?.request?.page ?? 0,
      `${query.id}.request.page`,
      0,
      10000,
    );
    requireInteger(
      query?.request?.pageSize ?? 10,
      `${query.id}.request.pageSize`,
      1,
      100,
    );
  }
  return matrix;
}

export async function loadSemanticMatrix(path = DEFAULT_MATRIX) {
  const absolute = resolve(path);
  const raw = await readFile(absolute, 'utf8');
  const matrix = requireMatrix(JSON.parse(raw));
  return {
    path: absolute,
    sha256: sha256(raw),
    matrix,
  };
}

function engineResults(engine) {
  return Array.isArray(engine?.results) ? engine.results : [];
}

function resultIds(engine) {
  return engineResults(engine)
    .map((result) => result?.id)
    .filter((id) => typeof id === 'string' && id.length > 0);
}

function resultSnapshot(engine) {
  return engineResults(engine).map((result) => ({
    id: result?.id ?? null,
    title: result?.title ?? null,
    sourceSystem: result?.sourceSystem ?? null,
    publisher: result?.publisher ?? null,
  }));
}

function facetMap(engine) {
  const facets = Array.isArray(engine?.facets) ? engine.facets : [];
  const mapped = new Map();
  for (const facet of facets) {
    const values = new Map();
    for (const value of Array.isArray(facet?.values) ? facet.values : []) {
      values.set(String(value?.value ?? ''), Number(value?.count ?? 0));
    }
    mapped.set(String(facet?.field ?? ''), values);
  }
  return mapped;
}

function facetSnapshot(engine) {
  const mapped = facetMap(engine);
  return Object.fromEntries(
    [...mapped.entries()].map(([field, values]) => [
      field,
      Object.fromEntries([...values.entries()]),
    ]),
  );
}

function setIntersection(left, right) {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value));
}

export function summarizeReturnedResultOverlap(solr, openSearch) {
  const solrIds = resultIds(solr);
  const openSearchIds = resultIds(openSearch);
  const solrSet = new Set(solrIds);
  const openSearchSet = new Set(openSearchIds);
  const shared = [...solrSet].filter((id) => openSearchSet.has(id));
  const union = new Set([...solrSet, ...openSearchSet]);
  const exactOrder =
    solrIds.length === openSearchIds.length &&
    solrIds.every((id, index) => id === openSearchIds[index]);

  return {
    windowSize: Math.max(solrIds.length, openSearchIds.length),
    solrReturned: solrIds.length,
    openSearchReturned: openSearchIds.length,
    sharedCount: shared.length,
    unionCount: union.size,
    jaccard: union.size === 0 ? 1 : shared.length / union.size,
    exactOrder,
    solrOnly: solrIds.filter((id) => !openSearchSet.has(id)),
    openSearchOnly: openSearchIds.filter((id) => !solrSet.has(id)),
  };
}

export function summarizeRankMovement(solr, openSearch) {
  const solrIds = resultIds(solr);
  const openSearchIds = resultIds(openSearch);
  const openSearchRanks = new Map(
    openSearchIds.map((id, index) => [id, index + 1]),
  );
  const movements = [];
  for (let index = 0; index < solrIds.length; index += 1) {
    const id = solrIds[index];
    const openSearchRank = openSearchRanks.get(id);
    if (openSearchRank == null) {
      continue;
    }
    const solrRank = index + 1;
    movements.push({
      id,
      solrRank,
      openSearchRank,
      delta: openSearchRank - solrRank,
      absoluteDelta: Math.abs(openSearchRank - solrRank),
    });
  }
  const absoluteTotal = movements.reduce(
    (sum, movement) => sum + movement.absoluteDelta,
    0,
  );
  const sorted = [...movements].sort(
    (left, right) => right.absoluteDelta - left.absoluteDelta,
  );
  return {
    sharedCount: movements.length,
    meanAbsoluteDelta:
      movements.length === 0 ? 0 : absoluteTotal / movements.length,
    maxAbsoluteDelta: sorted[0]?.absoluteDelta ?? 0,
    largestMovements: sorted.slice(0, 10),
  };
}

export function summarizeFacetDifferences(solr, openSearch) {
  const solrFacets = facetMap(solr);
  const openSearchFacets = facetMap(openSearch);
  const fields = [
    ...new Set([...solrFacets.keys(), ...openSearchFacets.keys()]),
  ]
    .filter(Boolean)
    .sort();
  let differingBucketCount = 0;
  const summaries = [];

  for (const field of fields) {
    const solrValues = solrFacets.get(field) ?? new Map();
    const openSearchValues = openSearchFacets.get(field) ?? new Map();
    const values = [
      ...new Set([...solrValues.keys(), ...openSearchValues.keys()]),
    ].sort();
    const differences = [];
    for (const value of values) {
      const solrCount = solrValues.get(value) ?? 0;
      const openSearchCount = openSearchValues.get(value) ?? 0;
      if (solrCount !== openSearchCount) {
        differingBucketCount += 1;
        differences.push({
          value,
          solrCount,
          openSearchCount,
          delta: openSearchCount - solrCount,
        });
      }
    }
    summaries.push({
      field,
      solrBucketCount: solrValues.size,
      openSearchBucketCount: openSearchValues.size,
      exact: differences.length === 0,
      differences: differences.slice(0, 25),
    });
  }

  return {
    exact: differingBucketCount === 0,
    differingBucketCount,
    fields: summaries,
  };
}

export function summarizeSemanticComparison(response) {
  const solr = response?.solr;
  const openSearch = response?.openSearch;
  const solrTotal = Number(solr?.totalHits ?? 0);
  const openSearchTotal = Number(openSearch?.totalHits ?? 0);
  const overlap = summarizeReturnedResultOverlap(solr, openSearch);
  const rank = summarizeRankMovement(solr, openSearch);
  const facets = summarizeFacetDifferences(solr, openSearch);

  return {
    totalHits: {
      solr: solrTotal,
      openSearch: openSearchTotal,
      equal: solrTotal === openSearchTotal,
      delta: openSearchTotal - solrTotal,
    },
    returnedResultOverlap: overlap,
    rankMovement: rank,
    facetDifferences: facets,
    semanticParity:
      solrTotal === openSearchTotal && overlap.exactOrder && facets.exact,
  };
}

function validateEngineAvailability(engine, label) {
  if (!engine?.enabled || !engine?.reachable) {
    throw new Error(
      `${label} is unavailable during semantic evidence capture.`,
    );
  }
}

function verifyFacetExpectations(definition, engine, label) {
  const facets = facetMap(engine);
  for (const field of definition.requiredFacetFields ?? []) {
    if (!facets.has(field)) {
      throw new Error(
        `${definition.id}: ${label} did not return required facet ${field}.`,
      );
    }
  }
  for (const [field, expectedBuckets] of Object.entries(
    definition.expectedFacetBuckets ?? {},
  )) {
    const actual = facets.get(field) ?? new Map();
    for (const [value, expectedCount] of Object.entries(expectedBuckets)) {
      const actualCount = actual.get(value);
      if (actualCount !== expectedCount) {
        throw new Error(
          `${definition.id}: ${label} facet ${field}/${value} expected ${expectedCount} but found ${actualCount ?? 'missing'}.`,
        );
      }
    }
  }
}

function verifyDefinitionExpectations(definition, response) {
  for (const [label, engine] of [
    ['Solr', response.solr],
    ['OpenSearch', response.openSearch],
  ]) {
    validateEngineAvailability(engine, label);
    if (
      definition.expectedTotalHits != null &&
      Number(engine.totalHits) !== Number(definition.expectedTotalHits)
    ) {
      throw new Error(
        `${definition.id}: ${label} expected ${definition.expectedTotalHits} total hits but found ${engine.totalHits}.`,
      );
    }
    const minimumReturnedHits = Number(definition.minimumReturnedHits ?? 0);
    if (engineResults(engine).length < minimumReturnedHits) {
      throw new Error(
        `${definition.id}: ${label} returned ${engineResults(engine).length} hits; expected at least ${minimumReturnedHits}.`,
      );
    }
    verifyFacetExpectations(definition, engine, label);
  }
}

function canonicalEngineSignature(engine) {
  return JSON.stringify({
    totalHits: Number(engine?.totalHits ?? 0),
    resultIds: resultIds(engine),
    facets: facetSnapshot(engine),
  });
}

async function executeComparison({ fetchImpl, baseUrl, order, request }) {
  const root = baseUrl.replace(/\/$/u, '');
  const response = await fetchImpl(
    `${root}/search/comparison/run?order=${encodeURIComponent(order)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Semantic comparison request failed with HTTP ${response.status}.`,
    );
  }
  return response.json();
}

function verifyProjection(response, expectedProjectionId, queryId, order) {
  if (!response?.sameProjection) {
    throw new Error(
      `${queryId}/${order}: search engines are not on the same projection.`,
    );
  }
  if (response?.projection?.projectionId !== expectedProjectionId) {
    throw new Error(`${queryId}/${order}: projection identity changed.`);
  }
}

export async function runSearchSemanticMatrix({
  fetchImpl = globalThis.fetch,
  baseUrl = DEFAULT_BASE_URL,
  matrixPath = DEFAULT_MATRIX,
  warmupRuns = DEFAULT_WARMUPS,
  measuredRuns = DEFAULT_SAMPLES,
  now = () => new Date(),
  diskProvider,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('A fetch implementation is required.');
  }
  requireInteger(warmupRuns, 'warmupRuns', 0, 20);
  requireInteger(measuredRuns, 'measuredRuns', 1, 100);

  const loaded = await loadSemanticMatrix(matrixPath);
  const scaleEvidence = await runScaleEvidenceCheck({
    fetchImpl,
    baseUrl,
    profile: loaded.matrix.profile,
    ...(diskProvider ? { diskProvider } : {}),
    now,
  });
  if (scaleEvidence.status !== 'PASS') {
    const failures = scaleEvidence.checks
      .filter((entry) => entry.status !== 'PASS')
      .map((entry) => entry.id)
      .join(', ');
    throw new Error(
      `Scale evidence is not PASS: ${failures || 'unknown failure'}.`,
    );
  }
  const expectedProjectionId = requireProjectionId(
    scaleEvidence.projectionId,
    'Scale-evidence projectionId',
  );

  const cases = [];
  for (const definition of loaded.matrix.queries) {
    const orderEvidence = {};
    for (const order of EXECUTION_ORDERS) {
      const response = await executeComparison({
        fetchImpl,
        baseUrl,
        order,
        request: definition.request,
      });
      verifyProjection(response, expectedProjectionId, definition.id, order);
      verifyDefinitionExpectations(definition, response);
      const timing = await runSearchComparisonBenchmark({
        fetchImpl,
        baseUrl,
        warmupRuns,
        measuredRuns,
        executionOrder: order,
        request: definition.request,
        now,
      });
      if (timing?.projection?.projectionId !== expectedProjectionId) {
        throw new Error(
          `${definition.id}/${order}: projection changed during timing capture.`,
        );
      }
      orderEvidence[order] = {
        semantic: summarizeSemanticComparison(response),
        timing: {
          solr: timing.solr,
          openSearch: timing.openSearch,
        },
        snapshots: {
          solr: {
            totalHits: response.solr.totalHits,
            results: resultSnapshot(response.solr),
            facets: facetSnapshot(response.solr),
          },
          openSearch: {
            totalHits: response.openSearch.totalHits,
            results: resultSnapshot(response.openSearch),
            facets: facetSnapshot(response.openSearch),
          },
        },
        signatures: {
          solr: canonicalEngineSignature(response.solr),
          openSearch: canonicalEngineSignature(response.openSearch),
        },
      };
    }

    const solrOrderInvariant =
      orderEvidence.SOLR_FIRST.signatures.solr ===
      orderEvidence.OPENSEARCH_FIRST.signatures.solr;
    const openSearchOrderInvariant =
      orderEvidence.SOLR_FIRST.signatures.openSearch ===
      orderEvidence.OPENSEARCH_FIRST.signatures.openSearch;

    cases.push({
      id: definition.id,
      class: definition.class,
      description: definition.description,
      request: definition.request,
      orderInvariant: {
        solr: solrOrderInvariant,
        openSearch: openSearchOrderInvariant,
        both: solrOrderInvariant && openSearchOrderInvariant,
      },
      orders: Object.fromEntries(
        EXECUTION_ORDERS.map((order) => [
          order,
          {
            semantic: orderEvidence[order].semantic,
            timing: orderEvidence[order].timing,
            snapshots: orderEvidence[order].snapshots,
          },
        ]),
      ),
    });
  }

  return {
    kind: 'c2-search-semantic-matrix',
    capturedAt: now().toISOString(),
    matrix: {
      id: loaded.matrix.matrixId,
      schemaVersion: loaded.matrix.schemaVersion,
      sha256: loaded.sha256,
      queryCount: loaded.matrix.queries.length,
      unsupportedCapabilities: loaded.matrix.unsupportedCapabilities ?? [],
    },
    profile: loaded.matrix.profile,
    compositionSha256: scaleEvidence.compositionSha256,
    projectionId: expectedProjectionId,
    projectionObjectCount: scaleEvidence.projectionObjectCount,
    retainedFederatedRecordCount: scaleEvidence.retainedFederatedRecordCount,
    executionOrders: EXECUTION_ORDERS,
    warmupRuns,
    measuredRuns,
    methodology:
      'Every query is executed in both engine orders against one exact C2 projection. Semantic summaries compare total hits, the bounded returned result window, rank movement for shared results, and returned facet buckets. Timing distributions reuse the existing benchmark harness. Differences are evidence rather than automatic failures; corpus identity, projection identity, engine availability, and explicit matrix expectations are hard gates.',
    cases,
  };
}

function percent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

export function renderSemanticMatrixMarkdown(result) {
  const rows = [];
  for (const entry of result.cases) {
    const semantic = entry.orders.SOLR_FIRST.semantic;
    const solrTiming = entry.orders.SOLR_FIRST.timing.solr.elapsed;
    const openSearchTiming = entry.orders.SOLR_FIRST.timing.openSearch.elapsed;
    rows.push(
      `| ${entry.id} | ${semantic.totalHits.solr.toLocaleString('en-US')} / ${semantic.totalHits.openSearch.toLocaleString('en-US')} | ${percent(semantic.returnedResultOverlap.jaccard)} | ${semantic.rankMovement.maxAbsoluteDelta} | ${semantic.facetDifferences.differingBucketCount} | ${entry.orderInvariant.both ? 'YES' : 'NO'} | ${solrTiming.p50Ms}/${solrTiming.p95Ms}/${solrTiming.p99Ms} | ${openSearchTiming.p50Ms}/${openSearchTiming.p95Ms}/${openSearchTiming.p99Ms} |`,
    );
  }

  return `# C2 Search Semantic Matrix — ${result.matrix.id}\n\nCaptured: ${result.capturedAt}\n\n- Profile: \`${result.profile}\`\n- Retained federated records: **${result.retainedFederatedRecordCount.toLocaleString('en-US')}**\n- Projection objects: **${result.projectionObjectCount.toLocaleString('en-US')}**\n- Composition: \`${result.compositionSha256}\`\n- Projection: \`${result.projectionId}\`\n- Matrix SHA-256: \`${result.matrix.sha256}\`\n- Warmups / measured samples per query/order: **${result.warmupRuns} / ${result.measuredRuns}**\n\n| Query | total hits Solr / OpenSearch | top-window Jaccard | max rank Δ | facet bucket Δ | order invariant | Solr API p50/p95/p99 | OpenSearch API p50/p95/p99 |\n| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |\n${rows.join('\n')}\n\n## Capability gaps recorded by v1\n\n${result.matrix.unsupportedCapabilities.map((item) => `- ${item}`).join('\n')}\n\n${result.methodology}\n`;
}

export function parseArguments(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    matrixPath: DEFAULT_MATRIX,
    output: DEFAULT_OUTPUT,
    warmupRuns: DEFAULT_WARMUPS,
    measuredRuns: DEFAULT_SAMPLES,
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
      case '--matrix':
        options.matrixPath = value;
        index += 1;
        break;
      case '--output':
        options.output = value;
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
      default:
        throw new Error(`Unknown semantic matrix argument: ${argument}`);
    }
  }
  return options;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  const result = await runSearchSemanticMatrix({
    baseUrl: options.baseUrl,
    matrixPath: options.matrixPath,
    warmupRuns: options.warmupRuns,
    measuredRuns: options.measuredRuns,
  });
  const outputPath = resolve(options.output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  const markdownPath = outputPath.replace(/\.json$/iu, '.md');
  const markdown = renderSemanticMatrixMarkdown(result);
  await writeFile(markdownPath, markdown, 'utf8');
  console.log(`Semantic matrix JSON written to ${outputPath}`);
  console.log(`Semantic matrix Markdown written to ${markdownPath}`);
  console.log(markdown);
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
