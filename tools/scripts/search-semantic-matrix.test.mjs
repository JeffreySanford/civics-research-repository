import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canonicalEngineSignature,
  loadSemanticMatrix,
  parseArguments,
  renderSemanticMatrixMarkdown,
  summarizeFacetDifferences,
  summarizeRankMovement,
  summarizeReturnedResultOverlap,
  summarizeSemanticComparison,
} from './search-semantic-matrix.mjs';

function engine({ ids, totalHits = ids.length, facets = [] }) {
  return {
    enabled: true,
    reachable: true,
    totalHits,
    results: ids.map((id) => ({ id, title: id })),
    facets,
  };
}

function facet(field, values) {
  return {
    field,
    label: field,
    values: Object.entries(values).map(([value, count]) => ({
      value,
      label: value,
      count,
      selected: false,
    })),
  };
}

test('returned-result overlap records exact order and bounded Jaccard', () => {
  const exact = summarizeReturnedResultOverlap(
    engine({ ids: ['a', 'b', 'c'] }),
    engine({ ids: ['a', 'b', 'c'] }),
  );
  assert.equal(exact.exactOrder, true);
  assert.equal(exact.jaccard, 1);
  assert.equal(exact.sharedCount, 3);

  const drift = summarizeReturnedResultOverlap(
    engine({ ids: ['a', 'b', 'c'] }),
    engine({ ids: ['b', 'c', 'd'] }),
  );
  assert.equal(drift.exactOrder, false);
  assert.equal(drift.sharedCount, 2);
  assert.equal(drift.unionCount, 4);
  assert.equal(drift.jaccard, 0.5);
  assert.deepEqual(drift.solrOnly, ['a']);
  assert.deepEqual(drift.openSearchOnly, ['d']);
});

test('rank movement is computed only for shared returned results', () => {
  const summary = summarizeRankMovement(
    engine({ ids: ['a', 'b', 'c', 'd'] }),
    engine({ ids: ['b', 'd', 'a', 'x'] }),
  );

  assert.equal(summary.sharedCount, 3);
  assert.equal(summary.maxAbsoluteDelta, 2);
  assert.equal(summary.meanAbsoluteDelta, 5 / 3);
  assert.equal(summary.largestMovements[0].id, 'a');
});

test('facet differences report missing and count-drifted buckets', () => {
  const summary = summarizeFacetDifferences(
    engine({
      ids: [],
      facets: [facet('sourceSystem', { DATA_GOV: 500000, DOE_OSTI: 500000 })],
    }),
    engine({
      ids: [],
      facets: [
        facet('sourceSystem', { DATA_GOV: 499999, DOE_OSTI: 500000, OTHER: 1 }),
      ],
    }),
  );

  assert.equal(summary.exact, false);
  assert.equal(summary.differingBucketCount, 2);
  assert.equal(summary.fields[0].field, 'sourceSystem');
  assert.deepEqual(summary.fields[0].differences, [
    {
      value: 'DATA_GOV',
      solrCount: 500000,
      openSearchCount: 499999,
      delta: -1,
    },
    { value: 'OTHER', solrCount: 0, openSearchCount: 1, delta: 1 },
  ]);
});

test('semantic summary distinguishes total-hit, rank, and facet parity', () => {
  const sharedFacets = [facet('type', { DATASET: 12 })];
  const parity = summarizeSemanticComparison({
    solr: engine({ ids: ['a', 'b'], totalHits: 12, facets: sharedFacets }),
    openSearch: engine({
      ids: ['a', 'b'],
      totalHits: 12,
      facets: sharedFacets,
    }),
  });
  assert.equal(parity.semanticParity, true);

  const drift = summarizeSemanticComparison({
    solr: engine({ ids: ['a', 'b'], totalHits: 12, facets: sharedFacets }),
    openSearch: engine({
      ids: ['b', 'a'],
      totalHits: 13,
      facets: [facet('type', { DATASET: 13 })],
    }),
  });
  assert.equal(drift.semanticParity, false);
  assert.equal(drift.totalHits.delta, 1);
  assert.equal(drift.returnedResultOverlap.jaccard, 1);
  assert.equal(drift.returnedResultOverlap.exactOrder, false);
  assert.equal(drift.facetDifferences.differingBucketCount, 1);
});

test('versioned v2 matrix closes identifier and structured-filter gaps', async () => {
  const loaded = await loadSemanticMatrix();
  assert.equal(loaded.matrix.matrixId, 'c2-search-semantic-v2');
  assert.equal(loaded.matrix.profile, 'FEDERATED_1M');
  assert.equal(loaded.matrix.queries.length, 13);
  assert.match(loaded.sha256, /^[0-9a-f]{64}$/u);

  const broad = loaded.matrix.queries.find(
    (entry) => entry.id === 'broad-corpus-facets',
  );
  assert.equal(broad.expectedTotalHits, 1000181);
  assert.deepEqual(broad.expectedFacetBuckets.sourceSystem, {
    DATA_GOV: 500000,
    DOE_OSTI: 500000,
  });
  assert.deepEqual(loaded.matrix.unsupportedCapabilities, []);
  assert.deepEqual(
    loaded.matrix.queries.find((entry) => entry.id === 'local-id-exact')
      .request,
    {
      scenario: 'FILTERING',
      query: '',
      localId: 'ces-wp-25-23-spatial-mismatch',
      page: 0,
      pageSize: 25,
    },
  );
  assert.equal(
    loaded.matrix.queries.find((entry) => entry.id === 'doi-exact').request
      .doi,
    '10.3386/w32252',
  );
});

test('historical v1 matrix remains runnable by explicit path', async () => {
  const loaded = await loadSemanticMatrix(
    'planning/evidence/SEARCH_SEMANTIC_MATRIX_V1.json',
  );

  assert.equal(loaded.matrix.schemaVersion, '1.0.0');
  assert.equal(loaded.matrix.matrixId, 'c2-search-semantic-v1');
  assert.equal(loaded.matrix.queries.length, 9);
});

test('canonical engine signatures ignore facet and bucket response ordering', () => {
  const left = engine({
    ids: ['a'],
    facets: [
      facet('sourceSystem', { DOE_OSTI: 2, DATA_GOV: 3 }),
      facet('publisher', { Census: 1 }),
    ],
  });
  const right = engine({
    ids: ['a'],
    facets: [
      facet('publisher', { Census: 1 }),
      facet('sourceSystem', { DATA_GOV: 3, DOE_OSTI: 2 }),
    ],
  });

  assert.equal(
    canonicalEngineSignature(left),
    canonicalEngineSignature(right),
  );
});

test('CLI parser supports bounded timing controls and alternate paths', () => {
  assert.deepEqual(
    parseArguments([
      '--',
      '--base-url',
      'http://example.test/api',
      '--matrix',
      'matrix.json',
      '--output',
      'result.json',
      '--warmups',
      '3',
      '--samples',
      '40',
    ]),
    {
      baseUrl: 'http://example.test/api',
      matrixPath: 'matrix.json',
      output: 'result.json',
      warmupRuns: 3,
      measuredRuns: 40,
    },
  );
});

test('CLI stops parsing at an in-band end-of-options marker', () => {
  assert.deepEqual(
    parseArguments(['--warmups', '3', '--', 'ignored']),
    {
      baseUrl: 'http://localhost:8080/api',
      matrixPath: 'planning/evidence/SEARCH_SEMANTIC_MATRIX_V2.json',
      output:
        'browser-evidence-artifacts/search-semantic/c2-search-semantic-v2.json',
      warmupRuns: 3,
      measuredRuns: 20,
    },
  );
});

test('Markdown keeps semantic and timing evidence visibly separate', () => {
  const markdown = renderSemanticMatrixMarkdown({
    matrix: {
      id: 'c2-search-semantic-v2',
      sha256: 'a'.repeat(64),
      unsupportedCapabilities: ['identifier lookup gap'],
    },
    capturedAt: '2026-09-01T00:00:00.000Z',
    profile: 'FEDERATED_1M',
    retainedFederatedRecordCount: 1000000,
    projectionObjectCount: 1000181,
    compositionSha256: 'b'.repeat(64),
    projectionId: 'c'.repeat(64),
    warmupRuns: 2,
    measuredRuns: 20,
    methodology: 'Bounded semantic evidence.',
    cases: [
      {
        id: 'example',
        orderInvariant: { both: true },
        orders: {
          SOLR_FIRST: {
            semantic: {
              totalHits: { solr: 10, openSearch: 10 },
              returnedResultOverlap: { jaccard: 0.8 },
              rankMovement: { maxAbsoluteDelta: 2 },
              facetDifferences: { differingBucketCount: 1 },
            },
            timing: {
              solr: { elapsed: { p50Ms: 1, p95Ms: 2, p99Ms: 3 } },
              openSearch: { elapsed: { p50Ms: 4, p95Ms: 5, p99Ms: 6 } },
            },
          },
        },
      },
    ],
  });

  assert.match(markdown, /top-window Jaccard/u);
  assert.match(markdown, /Solr API p50\/p95\/p99/u);
  assert.match(markdown, /identifier lookup gap/u);
  assert.match(markdown, /Bounded semantic evidence\./u);
});
