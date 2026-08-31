import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adaptiveScenarios,
  chooseSelectiveProgram,
  discoverSelectiveProgram,
  parseArguments,
} from './search-comparison-100k-adaptive.mjs';

const PROJECTION_ID = 'a'.repeat(64);

function facetValue(value, count) {
  return { value, label: value, count, selected: false };
}

function comparisonResponse() {
  return {
    scenario: 'FACETED_SEARCH',
    projection: {
      projectionId: PROJECTION_ID,
      source: 'REPOSITORY',
      objectCount: 100181,
    },
    sameProjection: true,
    solr: {
      reachable: true,
      facets: [
        {
          field: 'program',
          label: 'Program',
          values: [
            facetValue('Too Broad', 70000),
            facetValue('Program B', 21000),
            facetValue('Program A', 12000),
            facetValue('Tiny', 5),
          ],
        },
      ],
    },
    openSearch: {
      reachable: true,
      facets: [
        {
          field: 'program',
          label: 'Program',
          values: [
            facetValue('Program A', 12000),
            facetValue('Program B', 21000),
            facetValue('Too Broad', 70000),
            facetValue('Tiny', 5),
          ],
        },
      ],
    },
  };
}

test('adaptive filter chooses the largest selective program with engine facet parity', () => {
  assert.deepEqual(chooseSelectiveProgram(comparisonResponse()), {
    value: 'Program B',
    count: 21000,
    openSearchCount: 21000,
  });
});

test('adaptive filter refuses facet-count drift between engines', () => {
  const response = comparisonResponse();
  response.openSearch.facets[0].values = [
    facetValue('Program B', 20999),
    facetValue('Program A', 11999),
  ];

  assert.throws(
    () => chooseSelectiveProgram(response),
    /No program facet has matching Solr\/OpenSearch counts/,
  );
});

test('adaptive filtering scenario uses discovered program instead of DATASET type', () => {
  const scenarios = adaptiveScenarios({ value: '006:070', count: 12345 });
  assert.equal(scenarios.length, 3);
  assert.equal(scenarios[2].id, 'FILTERING_SELECTIVE_PROGRAM');
  assert.deepEqual(scenarios[2].request.programs, ['006:070']);
  assert.equal(scenarios[2].request.contentType, undefined);
});

test('facet discovery calls the comparison endpoint and returns a selective program', async () => {
  const calls = [];
  const selected = await discoverSelectiveProgram({
    baseUrl: 'http://repository.test/api/',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        async json() {
          return comparisonResponse();
        },
      };
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    'http://repository.test/api/search/comparison/run',
  );
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(JSON.parse(calls[0].init.body).scenario, 'FACETED_SEARCH');
  assert.equal(selected.value, 'Program B');
});

test('adaptive CLI parser supports sample and output controls', () => {
  const options = parseArguments([
    '--',
    '--warmups',
    '3',
    '--samples',
    '50',
    '--output',
    'evidence/adaptive.json',
  ]);
  assert.equal(options.warmupRuns, 3);
  assert.equal(options.measuredRuns, 50);
  assert.equal(options.output, 'evidence/adaptive.json');
});
