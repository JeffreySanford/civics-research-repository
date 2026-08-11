import { expect, type Page, test } from '@playwright/test';

test.describe('demo storyboard checks', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);
  });

  test('primary navigation tells the demo story @storyboard', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', {
        name: 'Census geospatial discovery with repository sync',
      }),
    ).toBeVisible();

    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Discovery' })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Find research objects' }),
    ).toBeVisible();

    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Maps' })
      .click();
    await expect(
      page.getByRole('heading', { name: 'MapLibre geospatial workspace' }),
    ).toBeVisible();

    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Admin Sync' })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Repository sync' }),
    ).toBeVisible();

    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Evidence' })
      .click();
    await expect(
      page.getByRole('heading', { name: 'WCAG and Section 508 status' }),
    ).toBeVisible();
  });

  test('discovery search supports non-North Dakota Census areas @storyboard', async ({
    page,
  }) => {
    await page.goto('/discovery');
    await expect(
      page.getByRole('heading', { name: 'Find research objects' }),
    ).toBeVisible();

    await expect(
      page.getByRole('heading', {
        name: '2025 TIGER/Line - Census Tracts - California',
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'California (3)' }),
    ).toBeEnabled();

    await page.getByRole('button', { name: 'Texas (3)' }).click();

    await expect(
      page.getByRole('heading', {
        name: '2025 TIGER/Line - Census Tracts - Texas',
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: '2025 TIGER/Line - Census Tracts - California',
      }),
    ).toHaveCount(0);
  });

  test('map storyboard can switch Census area while retaining USGS overlay @storyboard', async ({
    page,
  }) => {
    await page.goto('/maps');

    await page.locator('select option').first().waitFor({ state: 'attached' });
    await expect(page.locator('select option')).toHaveCount(3);
    await expect(
      page.getByText('North Dakota TIGER/Line preview'),
    ).toBeVisible();
    await expect(page.getByText('3 loaded')).toBeVisible();

    await page.getByLabel('Census area').selectOption('California');

    await expect(page.getByLabel('Census area')).toHaveValue('California');
    await expect(page.getByText('California TIGER/Line preview')).toBeVisible();
    await expect(page.locator('.maplibregl-canvas')).toHaveCount(1);
  });

  test('admin sync storyboard shows planned repository actions @storyboard', async ({
    page,
  }) => {
    await page.goto('/admin/sync');

    await expect(page.getByText('No sync job selected')).toBeVisible();
    await page.getByRole('button', { name: 'Dry run sync' }).click();

    await expect(
      page.locator('dd').filter({ hasText: 'DRY_RUN_COMPLETE' }),
    ).toBeVisible();
    await expect(
      page.locator('strong').filter({ hasText: 'UPSERT_COMMUNITY' }),
    ).toBeVisible();
    await expect(
      page.locator('strong').filter({ hasText: 'VERIFY_INDEX' }),
    ).toBeVisible();
  });
});

async function mockRepositoryApi(page: Page): Promise<void> {
  await page.route(`**/api/search**`, async (route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get('q') ?? '';
    const geography = url.searchParams.get('geography');
    const selectedGeography =
      geography || (query === 'Texas' ? 'Texas' : 'California');

    await route.fulfill({
      contentType: 'application/json',
      json: searchResponse(selectedGeography),
    });
  });

  await page.route(`**/api/datasets/*/map-layers`, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: [
        {
          id: 'tiger-line-boundary-preview',
          label: '2025 TIGER/Line Census area preview',
          layerType: 'CENSUS_BOUNDARY',
          sourceUrl:
            'https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html',
          attribution: 'U.S. Census Bureau TIGER/Line',
          visibleByDefault: true,
        },
      ],
    });
  });

  await page.route(`**/api/maps/census-areas`, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: [
        censusArea(
          'north-dakota',
          'North Dakota',
          -104.0489,
          45.9351,
          -96.5545,
          49.0007,
        ),
        censusArea(
          'california',
          'California',
          -124.4096,
          32.5343,
          -114.1312,
          42.0095,
        ),
        censusArea('texas', 'Texas', -106.6456, 25.8371, -93.5083, 36.5007),
      ],
    });
  });

  await page.route(`**/api/overlays/usgs/earthquakes**`, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        source: 'USGS Earthquake Catalog GeoJSON fallback fixture',
        updatedAt: '2026-08-11T19:00:00Z',
        features: [
          earthquake(
            'demo-western-nd',
            'Western North Dakota',
            2.4,
            47.35,
            -103.21,
          ),
          earthquake(
            'demo-central-nd',
            'Central North Dakota',
            1.8,
            47.02,
            -100.78,
          ),
          earthquake(
            'demo-eastern-nd',
            'Eastern North Dakota',
            2.1,
            48.1,
            -97.73,
          ),
        ],
      },
    });
  });

  await page.route(`**/api/admin/sync`, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ contentType: 'application/json', json: [] });
      return;
    }

    await route.fulfill({
      contentType: 'application/json',
      status: 202,
      json: {
        id: '11111111-1111-4111-8111-111111111111',
        mode: 'DRY_RUN',
        source: 'TIGER_LINE',
        status: 'DRY_RUN_COMPLETE',
        startedAt: '2026-08-11T19:00:00Z',
        completedAt: '2026-08-11T19:00:01Z',
        actions: [
          {
            actionType: 'UPSERT_COMMUNITY',
            target: 'Census Public Research Data',
            detail: 'Ensure the DSpace community exists.',
          },
          {
            actionType: 'VERIFY_INDEX',
            target: 'Solr discovery',
            detail: 'Confirm repository metadata is searchable.',
          },
        ],
      },
    });
  });
}

function searchResponse(geography: string): unknown {
  return {
    query: geography,
    page: 0,
    pageSize: 25,
    totalResults: 3,
    results: ['TIGER_LINE', 'LODES', 'ACS'].map((program) => ({
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
    })),
    facets: [
      {
        field: 'program',
        label: 'Program',
        values: [
          {
            value: 'TIGER_LINE',
            label: 'TIGER LINE',
            count: 1,
            selected: false,
          },
          { value: 'LODES', label: 'LODES', count: 1, selected: false },
          { value: 'ACS', label: 'ACS', count: 1, selected: false },
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

function censusArea(
  id: string,
  geography: string,
  west: number,
  south: number,
  east: number,
  north: number,
): unknown {
  return {
    id,
    label: `${geography} Census area boundary preview`,
    geography,
    west,
    south,
    east,
    north,
    centerLatitude: (south + north) / 2,
    centerLongitude: (west + east) / 2,
    defaultZoom: 6,
  };
}

function earthquake(
  id: string,
  place: string,
  magnitude: number,
  latitude: number,
  longitude: number,
): unknown {
  return {
    id,
    place,
    magnitude,
    occurredAt: '2026-08-11T18:00:00Z',
    latitude,
    longitude,
  };
}
