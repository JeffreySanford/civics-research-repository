import type { Page } from '@playwright/test';

const PROJECTION_ID = 'a'.repeat(64);

const scenarios = [
  {
    id: 'FACETED_SEARCH',
    label: 'Facets vs aggregations',
    description:
      'Compare Solr field facets with OpenSearch terms aggregations over the same research objects.',
  },
  {
    id: 'FULL_TEXT_RELEVANCE',
    label: 'Full-text relevance',
    description:
      'Compare weighted title, geography, subject, author, summary, citation and publisher matching.',
  },
  {
    id: 'FILTERING',
    label: 'Filtering',
    description:
      'Compare program, geography, research-object type and vintage filters while preserving self-excluding facets.',
  },
] as const;

const northDakotaResults = [
  {
    id: 'lodes-wac-north-dakota-2023',
    title: '2023 LODES Workplace Area Characteristics - North Dakota',
    contentType: 'DATASET',
    program: 'LODES',
    publisher: 'U.S. Census Bureau',
    summary: 'Workplace employment totals for North Dakota.',
    geography: 'North Dakota',
    vintageYear: 2023,
    accessLevel: 'PUBLIC',
    sourceUrl: 'https://lehd.ces.census.gov/data/',
  },
  {
    id: 'tiger-line-north-dakota-2025',
    title: '2025 TIGER/Line - Census Tracts - North Dakota',
    contentType: 'DATASET',
    program: 'TIGER_LINE',
    publisher: 'U.S. Census Bureau',
    summary: 'Census tract geography for North Dakota.',
    geography: 'North Dakota',
    vintageYear: 2025,
    accessLevel: 'PUBLIC',
    sourceUrl:
      'https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html',
  },
] as const;

function engine(
  name: 'SOLR' | 'OPENSEARCH',
  elapsedMs: number,
  reverseResults = false,
) {
  const results = reverseResults
    ? [...northDakotaResults].reverse()
    : [...northDakotaResults];

  return {
    engine: name,
    enabled: true,
    reachable: true,
    indexName: name === 'SOLR' ? 'discovery' : 'discovery-comparison',
    indexedDocumentCount: 181,
    elapsedMs,
    totalHits: 2,
    returnedHits: 2,
    results,
    facets: [
      {
        field: 'program',
        label: name === 'SOLR' ? 'Program' : 'Program',
        values: [
          { value: 'LODES', label: 'LODES', count: 1, selected: false },
          {
            value: 'TIGER_LINE',
            label: 'TIGER LINE',
            count: 1,
            selected: false,
          },
        ],
      },
      {
        field: 'geography',
        label: 'Geography',
        values: [
          {
            value: 'North Dakota',
            label: 'North Dakota',
            count: 2,
            selected: true,
          },
        ],
      },
    ],
  };
}

export async function mockSearchComparisonApi(page: Page): Promise<void> {
  await page.route(`**/api/search/comparison/scenarios`, async (route) => {
    await route.fulfill({ contentType: 'application/json', json: scenarios });
  });

  await page.route(`**/api/search/comparison/run`, async (route) => {
    const body = route.request().postDataJSON() as
      | { scenario?: string }
      | undefined;

    await route.fulfill({
      contentType: 'application/json',
      json: {
        scenario: body?.scenario ?? 'FACETED_SEARCH',
        projection: {
          projectionId: PROJECTION_ID,
          source: 'REPOSITORY',
          objectCount: 181,
          rebuiltAt: '2026-08-29T17:00:00Z',
        },
        sameProjection: true,
        solr: engine('SOLR', 34),
        openSearch: engine('OPENSEARCH', 29, true),
      },
    });
  });
}
