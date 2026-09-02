import type { Page } from '@playwright/test';
import {
  failRepositoryApi,
  mockFixtureBackedRepositoryApi as mockFixtureBackedRepositoryApiBase,
  mockRepositoryApi as mockRepositoryApiBase,
} from './repository-api-mocks-base';

export { failRepositoryApi };

/**
 * Adds the cursor transport contract on top of the shared repository fixture.
 *
 * The base module intentionally keeps the offset `/search` fixture because shared `?page=N` URLs
 * remain a supported compatibility surface. This facade registers `/search/cursor` afterwards so
 * Playwright gives the more-specific route precedence without duplicating the rest of the API mock.
 */
export async function mockRepositoryApi(page: Page): Promise<void> {
  await mockRepositoryApiBase(page);
  await mockCursorSearch(page, 'REPOSITORY');
}

/** Fixture-backed discovery uses the same cursor envelope while retaining its source disclosure. */
export async function mockFixtureBackedRepositoryApi(
  page: Page,
): Promise<void> {
  await mockFixtureBackedRepositoryApiBase(page);
  await mockCursorSearch(page, 'FIXTURE');
}

async function mockCursorSearch(
  page: Page,
  resultSource: 'REPOSITORY' | 'FIXTURE',
): Promise<void> {
  await page.route('**/api/search/cursor**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      contentType: 'application/json',
      json: cursorSearchResponse(url, resultSource),
    });
  });
}

function cursorSearchResponse(
  url: URL,
  resultSource: 'REPOSITORY' | 'FIXTURE',
): unknown {
  const query = url.searchParams.get('q') ?? '';
  const geography = url.searchParams.get('geography');
  const selectedGeography =
    geography || (query === 'Texas' ? 'Texas' : 'California');
  const pageSize = positiveInteger(url.searchParams.get('pageSize'), 25);
  const page = cursorPage(url.searchParams.get('cursor'));
  const search = searchResponse(
    selectedGeography,
    resultSource,
    url.searchParams.getAll('program'),
    url.searchParams.get('contentType') ?? '',
    page,
    pageSize,
    url.searchParams.get('vintageYear') ?? '',
  );
  const nextPage = page + 1;

  return {
    search,
    nextCursor:
      nextPage * pageSize < search.totalResults
        ? `mock-cursor-${nextPage}`
        : null,
  };
}

function cursorPage(cursor: string | null): number {
  if (!cursor?.startsWith('mock-cursor-')) {
    return 0;
  }

  return positiveInteger(cursor.slice('mock-cursor-'.length), 0);
}

function positiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function searchResponse(
  geography: string,
  resultSource: 'REPOSITORY' | 'FIXTURE',
  selectedPrograms: readonly string[],
  selectedContentType: string,
  page: number,
  pageSize: number,
  selectedVintageYear: string,
) {
  const packageResults = [
    {
      id: 'ces-wp-25-23-spatial-mismatch',
      title: 'Re-assessing the Spatial Mismatch Hypothesis',
      contentType: 'PUBLICATION',
      program: 'LEHD',
      publisher: 'U.S. Census Bureau',
      summary: 'Working paper on spatial mismatch and workplace pay premiums.',
      geography: 'United States',
      vintageYear: 2025,
      sourceUrl: 'https://www2.census.gov/',
      accessLevel: 'PUBLIC',
    },
    {
      id: 'lehd-microdata-restricted',
      title: 'LEHD Longitudinal Employer-Household Dynamics microdata',
      contentType: 'DATASET',
      program: 'LEHD',
      publisher: 'U.S. Census Bureau',
      summary: 'Title 13 protected records behind the public LODES product.',
      geography: 'United States',
      vintageYear: 2025,
      sourceUrl: 'https://www.census.gov/',
      accessLevel: 'RESTRICTED',
    },
  ].filter(
    (result) =>
      !selectedContentType || result.contentType === selectedContentType,
  );

  const datasetResults = (
    selectedContentType && selectedContentType !== 'DATASET'
      ? []
      : ['TIGER_LINE', 'LODES', 'ACS']
  ).map((program) => ({
    id: `${program.toLowerCase()}-${geography.toLowerCase().replaceAll(' ', '-')}`,
    title:
      program === 'TIGER_LINE'
        ? `2025 TIGER/Line - Census Tracts - ${geography}`
        : `${program} public data - ${geography}`,
    contentType: 'DATASET',
    program,
    publisher: 'U.S. Census Bureau',
    summary: `${program} metadata for ${geography}.`,
    geography,
    vintageYear: program === 'LODES' ? 2023 : 2025,
    sourceUrl: 'https://www.census.gov/',
    accessLevel: 'PUBLIC',
  }));

  const filler = Array.from({ length: 30 }, (_, index) => ({
    id: `filler-${index}`,
    title: `Additional research object ${index + 1} - ${geography}`,
    contentType: 'DATASET',
    program: 'TIGER_LINE',
    publisher: 'U.S. Census Bureau',
    summary: `Placeholder record ${index + 1} for pagination coverage.`,
    geography,
    vintageYear: 2025,
    sourceUrl: 'https://www.census.gov/',
    accessLevel: 'PUBLIC',
  })).filter(() => !selectedContentType || selectedContentType === 'DATASET');

  const combined = [...datasetResults, ...packageResults, ...filler].filter(
    (result) =>
      !selectedVintageYear ||
      String(result.vintageYear) === selectedVintageYear,
  );
  const start = page * pageSize;

  return {
    resultSource,
    query: geography,
    page,
    pageSize,
    totalResults: combined.length,
    results: combined.slice(start, start + pageSize),
    facets: [
      {
        field: 'program',
        label: 'Program',
        values: [
          {
            value: 'TIGER_LINE',
            label: 'TIGER LINE',
            count: 1,
            selected: selectedPrograms.includes('TIGER_LINE'),
          },
          {
            value: 'LODES',
            label: 'LODES',
            count: 1,
            selected: selectedPrograms.includes('LODES'),
          },
          {
            value: 'ACS',
            label: 'ACS',
            count: 1,
            selected: selectedPrograms.includes('ACS'),
          },
          {
            value: 'SAIPE',
            label: 'SAIPE',
            count: 1,
            selected: selectedPrograms.includes('SAIPE'),
          },
        ],
      },
      {
        field: 'type',
        label: 'Type',
        values: [
          {
            value: 'DATASET',
            label: 'DATASET',
            count: 4,
            selected: selectedContentType === 'DATASET',
          },
          {
            value: 'PUBLICATION',
            label: 'PUBLICATION',
            count: 1,
            selected: selectedContentType === 'PUBLICATION',
          },
          {
            value: 'METHODOLOGY',
            label: 'METHODOLOGY',
            count: 1,
            selected: selectedContentType === 'METHODOLOGY',
          },
          {
            value: 'PROJECT',
            label: 'PROJECT',
            count: 1,
            selected: selectedContentType === 'PROJECT',
          },
        ],
      },
      {
        field: 'vintageYear',
        label: 'Year',
        values: [
          {
            value: '2025',
            label: '2025',
            count: 32,
            selected: selectedVintageYear === '2025',
          },
          {
            value: '2023',
            label: '2023',
            count: 3,
            selected: selectedVintageYear === '2023',
          },
        ],
      },
      {
        field: 'geography',
        label: 'Geography',
        values: [
          {
            value: 'California',
            label: 'California',
            count: 3,
            selected: geography === 'California',
          },
          {
            value: 'Texas',
            label: 'Texas',
            count: 3,
            selected: geography === 'Texas',
          },
        ],
      },
    ],
  };
}
