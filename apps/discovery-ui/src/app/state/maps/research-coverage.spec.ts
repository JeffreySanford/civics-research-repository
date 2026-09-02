import { describe, expect, it } from 'vitest';
import type {
  CensusAreaBoundary,
  SearchQuery,
  SearchResponse,
} from 'repository-api-client';
import { buildResearchCoverageSummary } from './research-coverage';

const boundaries: CensusAreaBoundary[] = [
  {
    id: 'north-dakota',
    label: 'North Dakota Census area boundary preview',
    geography: 'North Dakota',
    west: -104,
    south: 46,
    east: -96.5,
    north: 49,
    centerLatitude: 47.5,
    centerLongitude: -100.5,
    defaultZoom: 6,
  },
  {
    id: 'california',
    label: 'California Census area boundary preview',
    geography: 'California',
    west: -124.4,
    south: 32.5,
    east: -114.1,
    north: 42,
    centerLatitude: 36.8,
    centerLongitude: -119.4,
    defaultZoom: 5,
  },
];

function response(totalResults = 20): SearchResponse {
  return {
    resultSource: 'REPOSITORY',
    query: '',
    page: 0,
    pageSize: 1,
    totalResults,
    results: [],
    facets: [
      {
        field: 'geography',
        label: 'Geography',
        values: [
          {
            value: 'North Dakota',
            label: 'North Dakota',
            count: 5,
            selected: false,
          },
          {
            value: 'California',
            label: 'California',
            count: 3,
            selected: false,
          },
          {
            value: 'Laboratory location only',
            label: 'Laboratory location only',
            count: 4,
            selected: false,
          },
        ],
      },
    ],
  };
}

describe('buildResearchCoverageSummary', () => {
  it('joins only explicit geography facet values that match supported Census areas', () => {
    const query: SearchQuery = { q: 'climate', pageSize: 1 };
    const summary = buildResearchCoverageSummary(
      response(),
      boundaries,
      query,
    );

    expect(summary.areas.map(({ geography, count }) => ({ geography, count }))).toEqual([
      { geography: 'North Dakota', count: 5 },
      { geography: 'California', count: 3 },
    ]);
    expect(summary.mappedResults).toBe(8);
    expect(summary.unmappedResults).toBe(12);
    expect(summary.totalResults).toBe(20);
  });

  it('respects an effective geography filter even though the search facet is self-excluding', () => {
    const query: SearchQuery = {
      q: 'climate',
      geography: 'California',
      pageSize: 1,
    };
    const summary = buildResearchCoverageSummary(
      response(3),
      boundaries,
      query,
    );

    expect(summary.areas).toHaveLength(1);
    expect(summary.areas[0]?.geography).toBe('California');
    expect(summary.mappedResults).toBe(3);
    expect(summary.unmappedResults).toBe(0);
  });

  it('does not infer a map location for matching records without a supported explicit geography', () => {
    const query: SearchQuery = { sourceSystem: 'DATA_GOV', pageSize: 1 };
    const noGeographyResponse: SearchResponse = {
      ...response(500000),
      resultSource: 'FEDERATED',
      facets: [
        {
          field: 'geography',
          label: 'Geography',
          values: [],
        },
      ],
    };

    const summary = buildResearchCoverageSummary(
      noGeographyResponse,
      boundaries,
      query,
    );

    expect(summary.areas).toEqual([]);
    expect(summary.mappedResults).toBe(0);
    expect(summary.unmappedResults).toBe(500000);
    expect(summary.resultSource).toBe('FEDERATED');
  });
});
