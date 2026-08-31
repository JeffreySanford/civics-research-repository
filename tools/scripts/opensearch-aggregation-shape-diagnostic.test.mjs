import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canonicalFacetCounts,
  currentSelectiveAggregations,
  currentUnfilteredAggregations,
  directUnfilteredAggregations,
  groupedSelectiveAggregations,
} from './opensearch-aggregation-shape-diagnostic.mjs';

const PROGRAM =
  'U.S. Department of Commerce, U.S. Census Bureau, Geography Division';

function currentResponse() {
  return {
    aggregations: {
      program_scope: {
        values: { buckets: [{ key: PROGRAM, doc_count: 1419 }] },
      },
      publisher_scope: {
        values: { buckets: [{ key: 'U.S. Census Bureau', doc_count: 1419 }] },
      },
      sourceSystem_scope: {
        values: { buckets: [{ key: 'DATA_GOV', doc_count: 1419 }] },
      },
      geography_scope: {
        values: { buckets: [{ key: 'United States', doc_count: 1200 }] },
      },
      contentType_scope: {
        values: { buckets: [{ key: 'DATASET', doc_count: 1419 }] },
      },
      vintageYear_scope: {
        values: { buckets: [{ key: 2025, doc_count: 900 }] },
      },
    },
  };
}

function directResponse() {
  return {
    aggregations: Object.fromEntries(
      Object.entries(currentResponse().aggregations).map(([name, scope]) => [
        name,
        scope.values,
      ]),
    ),
  };
}

function groupedResponse() {
  const current = currentResponse().aggregations;
  return {
    aggregations: {
      program_scope: current.program_scope.values,
      shared_program_scope: {
        publisher_scope: current.publisher_scope.values,
        sourceSystem_scope: current.sourceSystem_scope.values,
        geography_scope: current.geography_scope.values,
        contentType_scope: current.contentType_scope.values,
        vintageYear_scope: current.vintageYear_scope.values,
      },
    },
  };
}

test('unfiltered candidate removes six redundant match-all filter scopes', () => {
  const current = currentUnfilteredAggregations();
  const direct = directUnfilteredAggregations();

  assert.equal(Object.keys(current).length, 6);
  assert.equal(Object.keys(direct).length, 6);
  for (const name of Object.keys(current)) {
    assert.deepEqual(current[name].filter, { match_all: {} });
    assert.ok(current[name].aggs.values.terms);
    assert.equal(direct[name].filter, undefined);
    assert.ok(direct[name].terms);
  }
});

test('selective candidate replaces five duplicate program filter scopes with one shared scope', () => {
  const current = currentSelectiveAggregations(PROGRAM);
  const grouped = groupedSelectiveAggregations(PROGRAM);

  assert.deepEqual(current.program_scope.filter, { match_all: {} });
  const duplicated = Object.entries(current).filter(
    ([name, scope]) => name !== 'program_scope' && scope.filter?.bool,
  );
  assert.equal(duplicated.length, 5);
  assert.ok(
    duplicated.every(
      ([, scope]) =>
        scope.filter.bool.filter[0].terms.programName[0] === PROGRAM,
    ),
  );

  assert.ok(grouped.program_scope.terms);
  assert.equal(
    grouped.shared_program_scope.filter.bool.filter[0].terms.programName[0],
    PROGRAM,
  );
  assert.equal(
    Object.keys(grouped.shared_program_scope.aggs).length,
    5,
  );
});

test('canonical facet comparison treats current, direct, and grouped response shapes identically', () => {
  const current = canonicalFacetCounts(currentResponse(), 'current');
  const direct = canonicalFacetCounts(directResponse(), 'direct');
  const grouped = canonicalFacetCounts(groupedResponse(), 'grouped');

  assert.deepEqual(direct, current);
  assert.deepEqual(grouped, current);
});
