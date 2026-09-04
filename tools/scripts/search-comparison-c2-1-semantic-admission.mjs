import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  C2_1_FULL_TEXT_QUERIES,
  selectC21FilterBands,
} from './search-comparison-c2-1-foundation.mjs';
import { C2_1_EXPECTED } from './search-comparison-c2-1-manifest.mjs';

export const C2_1_BASELINE_TREATMENT = 'BASELINE_SCOPED_FILTERS';
export const C2_1_ADMITTED_TREATMENT = 'C2_1_OPTIMIZED_EQUIVALENT';

const DEFAULT_BASE_URL = 'http://localhost:8080/api';
const DEFAULT_OUTPUT =
  'browser-evidence-artifacts/c2-1/semantic-admission.json';

function resultIds(engine) {
  return (Array.isArray(engine?.results) ? engine.results : [])
    .map((result) => result?.id)
    .filter((id) => typeof id === 'string' && id.length > 0);
}

function facetSnapshot(engine) {
  const facets = Array.isArray(engine?.facets) ? engine.facets : [];
  return Object.fromEntries(
    facets
      .map((facet) => [
        String(facet?.field ?? ''),
        Object.fromEntries(
          (Array.isArray(facet?.values) ? facet.values : [])
            .map((value) => [
              String(value?.value ?? ''),
              Number(value?.count ?? 0),
            ])
            .sort(([left], [right]) => left.localeCompare(right)),
        ),
      ])
      .filter(([field]) => field !== '')
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

export function semanticSnapshot(engine) {
  return {
    totalHits: Number(engine?.totalHits ?? 0),
    resultIds: resultIds(engine),
    facets: facetSnapshot(engine),
  };
}

function requireCertifiedResponse(response, label) {
  if (response?.sameProjection !== true) {
    throw new Error(`${label}: Solr/OpenSearch projection parity is false.`);
  }
  if (response?.projection?.projectionId !== C2_1_EXPECTED.projectionId) {
    throw new Error(`${label}: certified projection ID changed.`);
  }
  if (
    Number(response?.projection?.objectCount) !==
    C2_1_EXPECTED.projectionObjectCount
  ) {
    throw new Error(`${label}: certified projection object count changed.`);
  }
  for (const [engineLabel, engine] of [
    ['Solr', response?.solr],
    ['OpenSearch', response?.openSearch],
  ]) {
    if (!engine?.enabled || !engine?.reachable) {
      throw new Error(`${label}: ${engineLabel} is unavailable.`);
    }
    if (
      Number(engine?.indexedDocumentCount) !==
      C2_1_EXPECTED.projectionObjectCount
    ) {
      throw new Error(`${label}: ${engineLabel} indexed document count changed.`);
    }
  }
}

export function compareC21TreatmentSemantics({
  cellId,
  baseline,
  optimized,
}) {
  requireCertifiedResponse(baseline, `${cellId} baseline`);
  requireCertifiedResponse(optimized, `${cellId} optimized`);

  const baselineOpenSearch = semanticSnapshot(baseline.openSearch);
  const optimizedOpenSearch = semanticSnapshot(optimized.openSearch);
  const optimizedSolr = semanticSnapshot(optimized.solr);

  const treatmentPreservesTotalHits =
    baselineOpenSearch.totalHits === optimizedOpenSearch.totalHits;
  const treatmentPreservesResultOrder =
    JSON.stringify(baselineOpenSearch.resultIds) ===
    JSON.stringify(optimizedOpenSearch.resultIds);
  const treatmentPreservesFacets =
    JSON.stringify(baselineOpenSearch.facets) ===
    JSON.stringify(optimizedOpenSearch.facets);

  if (!treatmentPreservesTotalHits) {
    throw new Error(`${cellId}: optimized treatment changed OpenSearch total hits.`);
  }
  if (!treatmentPreservesResultOrder) {
    throw new Error(`${cellId}: optimized treatment changed OpenSearch top-N result order.`);
  }
  if (!treatmentPreservesFacets) {
    throw new Error(`${cellId}: optimized treatment changed OpenSearch facet bucket counts.`);
  }

  const crossEngineTotalHitsEqual =
    optimizedSolr.totalHits === optimizedOpenSearch.totalHits;
  const crossEngineFacetsEqual =
    JSON.stringify(optimizedSolr.facets) ===
    JSON.stringify(optimizedOpenSearch.facets);
  if (!crossEngineTotalHitsEqual) {
    throw new Error(`${cellId}: Solr/OpenSearch total-hit parity failed.`);
  }
  if (!crossEngineFacetsEqual) {
    throw new Error(`${cellId}: Solr/OpenSearch facet-count parity failed.`);
  }

  return {
    cellId,
    admitted: true,
    treatmentPreserves: {
      totalHits: treatmentPreservesTotalHits,
      topNExactOrder: treatmentPreservesResultOrder,
      facetCounts: treatmentPreservesFacets,
    },
    crossEngine: {
      totalHitsEqual: crossEngineTotalHitsEqual,
      facetCountsEqual: crossEngineFacetsEqual,
      topNExactOrder:
        JSON.stringify(optimizedSolr.resultIds) ===
        JSON.stringify(optimizedOpenSearch.resultIds),
      solrResultIds: optimizedSolr.resultIds,
      openSearchResultIds: optimizedOpenSearch.resultIds,
    },
    totalHits: optimizedOpenSearch.totalHits,
  };
}

function requestForSelectedFilter(selected) {
  const base = {
    scenario: 'FILTERING',
    query: '',
    page: 0,
    pageSize: 10,
  };
  if (selected.field === 'program') {
    return { ...base, programs: [selected.value] };
  }
  if (selected.field === 'publisher') {
    return { ...base, publisher: selected.value };
  }
  if (selected.field === 'sourceSystem') {
    return { ...base, sourceSystem: selected.value };
  }
  throw new Error(
    `C2.1 selected unsupported filter field ${selected.field}.`,
  );
}

export function buildC21SemanticCells(filterSelection) {
  const cells = C2_1_FULL_TEXT_QUERIES.map((definition) => ({
    id: definition.id,
    family: 'FULL_TEXT_RELEVANCE',
    class: definition.class,
    request: {
      scenario: 'FULL_TEXT_RELEVANCE',
      query: definition.query,
      page: 0,
      pageSize: 10,
    },
  }));

  cells.push({
    id: 'FACETS',
    family: 'FACETS',
    request: { scenario: 'FACETED_SEARCH', query: '', page: 0, pageSize: 10 },
  });

  for (const band of filterSelection.bands) {
    if (band.status !== 'SELECTED' || !band.selected) {
      continue;
    }
    cells.push({
      id: `FILTER_${band.band}`,
      family: 'FILTERING',
      band: band.band,
      selected: band.selected,
      request: requestForSelectedFilter(band.selected),
    });
  }
  return cells;
}

async function executeComparison({ fetchImpl, baseUrl, treatment, request }) {
  const endpoint =
    `${baseUrl.replace(/\/$/, '')}/search/comparison/run` +
    `?order=SOLR_FIRST&openSearchTreatment=${encodeURIComponent(treatment)}`;
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(
      `C2.1 semantic admission request failed with HTTP ${response.status}.`,
    );
  }
  return response.json();
}

export async function runC21SemanticAdmission({
  fetchImpl = globalThis.fetch,
  baseUrl = DEFAULT_BASE_URL,
  capturedAt = () => new Date(),
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('C2.1 semantic admission requires a fetch implementation.');
  }

  const discoveryResponse = await executeComparison({
    fetchImpl,
    baseUrl,
    treatment: C2_1_BASELINE_TREATMENT,
    request: {
      scenario: 'FACETED_SEARCH',
      query: '',
      page: 0,
      pageSize: 10,
    },
  });
  requireCertifiedResponse(discoveryResponse, 'filter discovery');
  const filterSelection = selectC21FilterBands(discoveryResponse);
  const cells = buildC21SemanticCells(filterSelection);
  assert.ok(cells.length >= 21, 'C2.1 semantic matrix must include Q01-Q20 plus facets.');

  const admittedCells = [];
  for (const cell of cells) {
    const baseline = await executeComparison({
      fetchImpl,
      baseUrl,
      treatment: C2_1_BASELINE_TREATMENT,
      request: cell.request,
    });
    const optimized = await executeComparison({
      fetchImpl,
      baseUrl,
      treatment: C2_1_ADMITTED_TREATMENT,
      request: cell.request,
    });
    admittedCells.push({
      ...cell,
      semantic: compareC21TreatmentSemantics({
        cellId: cell.id,
        baseline,
        optimized,
      }),
    });
  }

  const unavailableBands = filterSelection.bands
    .filter((band) => band.status !== 'SELECTED')
    .map((band) => ({
      band: band.band,
      status: band.status,
      minimumPercent: band.minimumPercent,
      maximumPercent: band.maximumPercent,
      targetPercent: band.targetPercent,
    }));

  return {
    experiment: 'C2.1_ADVERSARIAL_STANDALONE',
    kind: 'semantic-treatment-admission',
    capturedAt: capturedAt().toISOString(),
    profile: C2_1_EXPECTED.profile,
    projectionId: C2_1_EXPECTED.projectionId,
    projectionObjectCount: C2_1_EXPECTED.projectionObjectCount,
    timingDiscarded: true,
    timingEvidenceAdmitted: false,
    baselineTreatment: C2_1_BASELINE_TREATMENT,
    admittedTreatment: C2_1_ADMITTED_TREATMENT,
    methodology:
      'Correctness-only preflight. API/native timing fields returned incidentally by comparison requests are discarded and are not C2.1 performance evidence. Candidate treatment must exactly preserve baseline OpenSearch total hits, top-N IDs/order, and every facet bucket/count before timing is authorized.',
    filterSelection,
    unavailableBands,
    admitted: admittedCells.every((cell) => cell.semantic.admitted),
    cells: admittedCells,
  };
}

export async function writeC21SemanticAdmission({
  output = DEFAULT_OUTPUT,
  ...options
} = {}) {
  const evidence = await runC21SemanticAdmission(options);
  const outputPath = resolve(output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  return { evidence, outputPath };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  writeC21SemanticAdmission()
    .then(({ evidence, outputPath }) => {
      console.log(
        `C2.1 semantic treatment ${evidence.admitted ? 'ADMITTED' : 'REFUSED'}: ${outputPath}`,
      );
      console.log(
        `Treatment: ${evidence.admittedTreatment}; cells: ${evidence.cells.length}; timing discarded: ${evidence.timingDiscarded}`,
      );
    })
    .catch((error) => {
      console.error(`C2.1 semantic treatment REFUSED: ${error.message}`);
      process.exitCode = 1;
    });
}
