import assert from 'node:assert/strict';
import test from 'node:test';
import {
  C2_1_BATCHES_PER_BLOCK,
  C2_1_RESTART_BLOCKS,
  C2_1_SELECTIVITY_BANDS,
} from './search-comparison-c2-1-foundation.mjs';
import { C2_1_EXPECTED } from './search-comparison-c2-1-manifest.mjs';
import {
  renderC21Markdown,
  synthesizeC21Report,
} from './search-comparison-c2-1-report.mjs';
import { C2_1_ADMITTED_TREATMENT } from './search-comparison-c2-1-semantic-admission.mjs';

function matrix() {
  return [
    ...Array.from({ length: 20 }, (_, index) => ({
      id: `Q${String(index + 1).padStart(2, '0')}`,
      family: 'FULL_TEXT_RELEVANCE',
      class: index === 19 ? 'no-result control' : 'test',
      band: null,
      selected: null,
      request: {
        scenario: 'FULL_TEXT_RELEVANCE',
        query: index === 19 ? 'no-result' : `query-${index + 1}`,
        page: 0,
        pageSize: 10,
      },
    })),
    {
      id: 'FACETS',
      family: 'FACETS',
      class: null,
      band: null,
      selected: null,
      request: {
        scenario: 'FACETED_SEARCH',
        query: '',
        page: 0,
        pageSize: 10,
      },
    },
  ];
}

function benchmark({ openSearchWins = false } = {}) {
  const solrValue = openSearchWins ? 12 : 10;
  const openSearchValue = openSearchWins ? 10 : 12;
  const solrNative = openSearchWins ? 6 : 5;
  const openSearchNative = openSearchWins ? 5 : 6;
  const sampleCount = C2_1_BATCHES_PER_BLOCK * 2;
  return {
    projection: {
      projectionId: C2_1_EXPECTED.projectionId,
      objectCount: C2_1_EXPECTED.projectionObjectCount,
    },
    openSearchTreatment: C2_1_ADMITTED_TREATMENT,
    batchEvidence: Array.from(
      { length: C2_1_BATCHES_PER_BLOCK },
      (_, index) => ({
        batchId: index + 1,
        executionOrder: index % 2 === 0 ? 'SOLR_FIRST' : 'OPENSEARCH_FIRST',
        warmupRuns: 1,
        measuredRuns: 2,
        sampleIndexes: [index * 2, index * 2 + 1],
      }),
    ),
    rawSamples: {
      apiElapsed: {
        solrMs: Array(sampleCount).fill(solrValue),
        openSearchMs: Array(sampleCount).fill(openSearchValue),
      },
      engineReported: {
        solrMs: Array(sampleCount).fill(solrNative),
        openSearchMs: Array(sampleCount).fill(openSearchNative),
      },
    },
  };
}

function suite() {
  const workloadMatrix = matrix();
  return {
    experiment: 'C2.1_ADVERSARIAL_STANDALONE',
    kind: 'measurement-suite',
    acceptedC21Evidence: true,
    comparativeClaimAllowed: false,
    semanticAdmissionTimingExcluded: true,
    projectionId: C2_1_EXPECTED.projectionId,
    projectionObjectCount: C2_1_EXPECTED.projectionObjectCount,
    openSearchTreatment: C2_1_ADMITTED_TREATMENT,
    workloadMatrix,
    restartBlocks: Array.from({ length: C2_1_RESTART_BLOCKS }, (_, blockIndex) => ({
      blockId: blockIndex + 1,
      workloads: workloadMatrix.map((cell) => ({
        ...cell,
        benchmark: benchmark({ openSearchWins: cell.id === 'Q20' }),
      })),
    })),
  };
}

function semantic() {
  const workloadMatrix = matrix();
  return {
    experiment: 'C2.1_ADVERSARIAL_STANDALONE',
    admitted: true,
    timingDiscarded: true,
    timingEvidenceAdmitted: false,
    projectionId: C2_1_EXPECTED.projectionId,
    projectionObjectCount: C2_1_EXPECTED.projectionObjectCount,
    admittedTreatment: C2_1_ADMITTED_TREATMENT,
    filterSelection: {
      bands: C2_1_SELECTIVITY_BANDS.map((band) => ({
        band: band.id,
        status: 'NO_VALID_CANDIDATE',
        selected: null,
      })),
    },
    unavailableBands: C2_1_SELECTIVITY_BANDS.map((band) => ({
      band: band.id,
      status: 'NO_VALID_CANDIDATE',
    })),
    cells: workloadMatrix.map((cell, index) => ({
      ...cell,
      semantic: {
        admitted: true,
        totalHits: cell.id === 'Q20' ? 0 : index + 1,
        crossEngine: {
          totalHitsEqual: true,
          facetCountsEqual: true,
          topNExactOrder: true,
        },
      },
    })),
  };
}

test('C2.1 report uses 16 independent batch medians per cell and retains OpenSearch wins', () => {
  const report = synthesizeC21Report({
    suite: suite(),
    semantic: semantic(),
    now: () => new Date('2026-09-04T15:00:00Z'),
  });

  assert.equal(report.cells.length, 21);
  assert.equal(
    report.cells[0].batchLevelInference.apiElapsed.batchCount,
    C2_1_RESTART_BLOCKS * C2_1_BATCHES_PER_BLOCK,
  );
  assert.equal(
    report.cells[0].batchLevelInference.apiElapsed.statistics.medianDifferenceMs,
    2,
  );
  assert.equal(
    report.cells[0].batchLevelInference.apiElapsed.direction,
    'SOLR_LOWER_LATENCY',
  );
  assert.equal(
    report.cells[19].batchLevelInference.apiElapsed.statistics.medianDifferenceMs,
    -2,
  );
  assert.equal(
    report.cells[19].batchLevelInference.apiElapsed.direction,
    'OPENSEARCH_LOWER_LATENCY',
  );
  assert.deepEqual(report.summary.openSearchLeadingApiCellIds, ['Q20']);
  assert.equal(report.cells[19].totalHits, 0);
  assert.equal(report.requestLevelDescriptive, undefined);
});

test('C2.1 report keeps request samples descriptive and batch bootstrap inferential', () => {
  const report = synthesizeC21Report({ suite: suite(), semantic: semantic() });
  const cell = report.cells[0];

  assert.equal(cell.requestLevelDescriptive.apiElapsed.inferenceAllowed, false);
  assert.equal(cell.requestLevelDescriptive.apiElapsed.pairCount, 32);
  assert.equal(cell.batchLevelInference.apiElapsed.statistics.sampleCount, 16);
  assert.equal(
    cell.batchLevelInference.apiElapsed.statistics.bootstrap.method,
    'paired percentile bootstrap of median latency difference',
  );
});

test('C2.1 markdown reports every cell and explicitly surfaces OpenSearch-leading cells', () => {
  const markdown = renderC21Markdown(
    synthesizeC21Report({ suite: suite(), semantic: semantic() }),
  );

  assert.match(markdown, /Q01/);
  assert.match(markdown, /Q20/);
  assert.match(markdown, /OpenSearch-leading API cells: `Q20`/);
  assert.match(markdown, /Request timings below are descriptive/);
  assert.match(markdown, /does not overwrite or pool its samples with C2/);
});

test('C2.1 report refuses a non-accepted timing suite', () => {
  assert.throws(
    () =>
      synthesizeC21Report({
        suite: { ...suite(), acceptedC21Evidence: false },
        semantic: semantic(),
      }),
    /accepted measurement-suite artifact/,
  );
});
