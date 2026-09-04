import './search-comparison-c2-1-report.test.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildC21RestartExecutionPlan,
  C2_1_FULL_TEXT_QUERIES,
  C2_1_SELECTIVITY_BANDS,
  collectC21ParityFilterCandidates,
  selectC21FilterBands,
  summarizeC21TimingSamples,
} from './search-comparison-c2-1-foundation.mjs';

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

function parityResponse() {
  return {
    sameProjection: true,
    projection: {
      projectionId: 'a'.repeat(64),
      objectCount: 1000,
    },
    solr: {
      reachable: true,
      facets: [
        facet('program', [
          ['Alpha Broad', 500],
          ['Moderate Program', 150],
          ['Selective Program', 20],
          ['Drifted Program', 10],
        ]),
        facet('publisher', [['Beta Broad', 500]]),
        facet('sourceSystem', [['DATA_GOV', 400]]),
      ],
    },
    openSearch: {
      reachable: true,
      facets: [
        facet('program', [
          ['Alpha Broad', 500],
          ['Moderate Program', 150],
          ['Selective Program', 20],
          ['Drifted Program', 9],
        ]),
        facet('publisher', [['Beta Broad', 500]]),
        facet('sourceSystem', [['DATA_GOV', 400]]),
      ],
    },
  };
}

test('C2.1 full-text matrix is frozen to Q01-Q20 including rare, phrase, prior query and no-result controls', () => {
  assert.equal(C2_1_FULL_TEXT_QUERIES.length, 20);
  assert.deepEqual(
    C2_1_FULL_TEXT_QUERIES.map(({ id }) => id),
    Array.from(
      { length: 20 },
      (_, index) => `Q${String(index + 1).padStart(2, '0')}`,
    ),
  );
  assert.equal(C2_1_FULL_TEXT_QUERIES[4].class, 'single/rare candidate');
  assert.equal(C2_1_FULL_TEXT_QUERIES[4].query, 'hydrogeology');
  assert.equal(C2_1_FULL_TEXT_QUERIES[5].class, 'exact-phrase');
  assert.equal(C2_1_FULL_TEXT_QUERIES[5].query, '"North Dakota"');
  assert.equal(C2_1_FULL_TEXT_QUERIES[10].query, 'North Dakota workforce');
  assert.equal(
    C2_1_FULL_TEXT_QUERIES[19].query,
    'zzzxqv_nonexistent_research_term_20260903',
  );
  assert.equal(
    C2_1_FULL_TEXT_QUERIES.filter(
      ({ class: queryClass }) => queryClass === 'exact-phrase',
    ).length,
    1,
  );
});

test('C2.1 selectivity bands retain preregistered bounds and midpoints', () => {
  assert.deepEqual(C2_1_SELECTIVITY_BANDS, [
    {
      id: 'BROAD',
      minimumPercent: 25,
      maximumPercent: 75,
      targetPercent: 50,
    },
    {
      id: 'MODERATE',
      minimumPercent: 5,
      maximumPercent: 25,
      targetPercent: 15,
    },
    {
      id: 'SELECTIVE',
      minimumPercent: 0.5,
      maximumPercent: 5,
      targetPercent: 2,
    },
  ]);
});

test('C2.1 filter candidates require exact Solr/OpenSearch facet-count parity', () => {
  const candidates = collectC21ParityFilterCandidates(parityResponse());
  assert.equal(
    candidates.some(({ value }) => value === 'Drifted Program'),
    false,
  );
  assert.equal(candidates.length, 5);
});

test('C2.1 parity lookup trims facet identities consistently across engines', () => {
  const response = parityResponse();
  response.solr.facets[0].values.push({
    value: '  Whitespace Program  ',
    label: 'Whitespace Program',
    count: 30,
    selected: false,
  });
  response.openSearch.facets[0].values.push({
    value: 'Whitespace Program',
    label: 'Whitespace Program',
    count: 30,
    selected: false,
  });

  const candidates = collectC21ParityFilterCandidates(response);
  assert.deepEqual(
    candidates.find(({ value }) => value === 'Whitespace Program'),
    {
      field: 'program',
      value: 'Whitespace Program',
      count: 30,
      selectivityPercent: 3,
      normalizedIdentity: 'program=Whitespace Program',
    },
  );
});

test('C2.1 band selection uses midpoint distance then lexical field=value tie break', () => {
  const result = selectC21FilterBands(parityResponse());
  const byBand = new Map(result.bands.map((band) => [band.band, band]));

  assert.equal(
    byBand.get('BROAD').selected.normalizedIdentity,
    'program=Alpha Broad',
  );
  assert.equal(
    byBand.get('MODERATE').selected.normalizedIdentity,
    'program=Moderate Program',
  );
  assert.equal(
    byBand.get('SELECTIVE').selected.normalizedIdentity,
    'program=Selective Program',
  );
});

test('C2.1 band selection records NO_VALID_CANDIDATE without widening a band', () => {
  const result = selectC21FilterBands(parityResponse(), {
    fields: ['publisher'],
  });
  const selective = result.bands.find((band) => band.band === 'SELECTIVE');
  assert.equal(selective.status, 'NO_VALID_CANDIDATE');
  assert.equal(selective.selected, null);
  assert.deepEqual(selective.eligibleCandidates, []);
});

test('C2.1 filter selection refuses projection mismatch and unavailable engines', () => {
  const mismatch = parityResponse();
  mismatch.sameProjection = false;
  assert.throws(() => selectC21FilterBands(mismatch), /projection parity/);

  const unavailable = parityResponse();
  unavailable.openSearch.reachable = false;
  assert.throws(
    () => selectC21FilterBands(unavailable),
    /both engines to be reachable/,
  );
});

test('C2.1 timing summary adds nearest-rank p90 without changing p50/p95/p99', () => {
  assert.deepEqual(
    summarizeC21TimingSamples([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]),
    {
      sampleCount: 10,
      minMs: 10,
      p50Ms: 50,
      p90Ms: 90,
      p95Ms: 100,
      p99Ms: 100,
      maxMs: 100,
      meanMs: 55,
    },
  );
});

test('C2.1 restart plan is deterministic and exactly balanced in every block and overall', () => {
  const first = buildC21RestartExecutionPlan();
  const second = buildC21RestartExecutionPlan();
  assert.deepEqual(first, second);
  assert.equal(first.orderStrategy, 'BALANCED_SEEDED_RANDOMIZED');
  assert.equal(first.restartBlocks, 4);
  assert.equal(first.batchesPerBlock, 4);
  assert.equal(first.totalBatches, 16);
  assert.equal(first.solrFirstBatches, 8);
  assert.equal(first.openSearchFirstBatches, 8);

  for (const block of first.blocks) {
    assert.equal(block.batchExecutionOrders.length, 4);
    assert.equal(
      block.batchExecutionOrders.filter((order) => order === 'SOLR_FIRST')
        .length,
      2,
    );
    assert.equal(
      block.batchExecutionOrders.filter((order) => order === 'OPENSEARCH_FIRST')
        .length,
      2,
    );
    assert.equal(block.realizedFirstBatchOrder, block.batchExecutionOrders[0]);
  }
});

test('C2.1 restart plan refuses an odd batch count that cannot be balanced per block', () => {
  assert.throws(
    () => buildC21RestartExecutionPlan({ batchesPerBlock: 3 }),
    /positive even integer/,
  );
});
