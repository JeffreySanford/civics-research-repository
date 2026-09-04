import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildC21SemanticCells,
  C2_1_ADMITTED_TREATMENT,
  C2_1_BASELINE_TREATMENT,
  compareC21TreatmentSemantics,
  runC21SemanticAdmission,
} from './search-comparison-c2-1-semantic-admission.mjs';
import { C2_1_EXPECTED } from './search-comparison-c2-1-manifest.mjs';

function facet(field, values) {
  return {
    field,
    label: field,
    values: values.map(([value, count]) => ({
      value,
      label: value,
      count,
      selected: false,
    })),
  };
}

function engine({ results = [], totalHits = 3 } = {}) {
  return {
    enabled: true,
    reachable: true,
    indexedDocumentCount: C2_1_EXPECTED.projectionObjectCount,
    elapsedMs: 999,
    engineReportedMs: 888,
    totalHits,
    results,
    facets: [
      facet('program', [
        ['Broad Program', 500000],
        ['Moderate Program', 150000],
        ['Selective Program', 20000],
      ]),
      facet('publisher', [['Publisher A', 3]]),
      facet('sourceSystem', [['DATA_GOV', 3]]),
      facet('geography', []),
      facet('type', []),
      facet('vintageYear', []),
    ],
  };
}

function response(options = {}) {
  return {
    sameProjection: true,
    projection: {
      projectionId: C2_1_EXPECTED.projectionId,
      objectCount: C2_1_EXPECTED.projectionObjectCount,
    },
    solr: engine(options),
    openSearch: engine(options),
  };
}

test('treatment admission requires exact baseline OpenSearch semantic preservation', () => {
  const baseline = response({
    results: [{ id: 'A' }, { id: 'B' }],
    totalHits: 2,
  });
  const optimized = structuredClone(baseline);

  const result = compareC21TreatmentSemantics({
    cellId: 'Q11',
    baseline,
    optimized,
  });

  assert.equal(result.admitted, true);
  assert.deepEqual(result.treatmentPreserves, {
    totalHits: true,
    topNExactOrder: true,
    facetCounts: true,
  });
  assert.equal(result.crossEngine.totalHitsEqual, true);
  assert.equal(result.crossEngine.facetCountsEqual, true);
});

test('treatment admission refuses optimized facet or rank drift', () => {
  const baseline = response({ results: [{ id: 'A' }, { id: 'B' }] });
  const facetDrift = structuredClone(baseline);
  facetDrift.openSearch.facets[0].values[0].count += 1;
  assert.throws(
    () =>
      compareC21TreatmentSemantics({
        cellId: 'FACETS',
        baseline,
        optimized: facetDrift,
      }),
    /changed OpenSearch facet bucket counts/,
  );

  const rankDrift = structuredClone(baseline);
  rankDrift.openSearch.results.reverse();
  assert.throws(
    () =>
      compareC21TreatmentSemantics({
        cellId: 'Q01',
        baseline,
        optimized: rankDrift,
      }),
    /changed OpenSearch top-N result order/,
  );
});

test('semantic cells freeze Q01-Q20 plus facets and selected filter bands', () => {
  const cells = buildC21SemanticCells({
    bands: [
      {
        band: 'BROAD',
        status: 'SELECTED',
        selected: { field: 'program', value: 'Broad Program' },
      },
      {
        band: 'MODERATE',
        status: 'SELECTED',
        selected: { field: 'publisher', value: 'Publisher A' },
      },
      {
        band: 'SELECTIVE',
        status: 'NO_VALID_CANDIDATE',
        selected: null,
      },
    ],
  });

  assert.equal(cells.length, 23);
  assert.equal(cells[0].id, 'Q01');
  assert.equal(cells[19].id, 'Q20');
  assert.equal(cells[20].id, 'FACETS');
  assert.deepEqual(cells[21].request.programs, ['Broad Program']);
  assert.equal(cells[22].request.publisher, 'Publisher A');
});

test('full semantic admission discards timing and names the treatment on every request', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      json: async () => response(),
    };
  };

  const evidence = await runC21SemanticAdmission({
    fetchImpl,
    baseUrl: 'http://repository.test/api',
    capturedAt: () => new Date('2026-09-04T00:30:00.000Z'),
  });

  assert.equal(evidence.admitted, true);
  assert.equal(evidence.timingDiscarded, true);
  assert.equal(evidence.timingEvidenceAdmitted, false);
  assert.equal(evidence.baselineTreatment, C2_1_BASELINE_TREATMENT);
  assert.equal(evidence.admittedTreatment, C2_1_ADMITTED_TREATMENT);
  assert.equal(evidence.cells.length, 24);
  assert.equal(calls.length, 49);
  assert.ok(
    calls.some((call) =>
      call.url.includes(`openSearchTreatment=${C2_1_ADMITTED_TREATMENT}`),
    ),
  );
  assert.ok(
    calls.some((call) =>
      call.url.includes(`openSearchTreatment=${C2_1_BASELINE_TREATMENT}`),
    ),
  );
  assert.equal('elapsedMs' in evidence.cells[0].semantic, false);
  assert.equal('engineReportedMs' in evidence.cells[0].semantic, false);
});
