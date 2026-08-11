import type { Page } from '@playwright/test';

export async function mockRepositoryApi(page: Page): Promise<void> {
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
        {
          id: 'lodes-workplace-flow-sample',
          label: '2023 LODES workplace flow sample',
          layerType: 'CENSUS_DATA',
          sourceUrl: 'https://lehd.ces.census.gov/data/',
          attribution:
            'U.S. Census Bureau LEHD Origin-Destination Employment Statistics',
          visibleByDefault: true,
        },
        {
          id: 'usgs-earthquakes-preview',
          label: 'USGS earthquake overlay',
          layerType: 'USGS_EARTHQUAKE',
          sourceUrl:
            'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson',
          attribution: 'U.S. Geological Survey Earthquake Hazards Program',
          visibleByDefault: true,
        },
      ],
    });
  });

  await page.route(`**/api/datasets/*/versions`, async (route) => {
    const datasetId = datasetIdFromUrl(route.request().url(), '/versions');

    await route.fulfill({
      contentType: 'application/json',
      json: [
        {
          id: `${datasetId}-current`,
          label: datasetTitle(datasetId),
          releasedOn: '2025-08-01',
          current: true,
        },
        {
          id: `${datasetId}-previous`,
          label: 'TIGER_LINE 2024',
          releasedOn: '2024-08-01',
          current: false,
        },
      ],
    });
  });

  await page.route(`**/api/datasets/*`, async (route) => {
    const pathname = new URL(route.request().url()).pathname;

    if (pathname.endsWith('/map-layers') || pathname.endsWith('/versions')) {
      await route.fallback();
      return;
    }

    const datasetId = datasetIdFromUrl(route.request().url());

    await route.fulfill({
      contentType: 'application/json',
      json: datasetDetail(datasetId),
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
    const overlayState = new URL(page.url()).searchParams.get('overlay');

    if (overlayState === 'error') {
      await route.fulfill({
        contentType: 'application/json',
        status: 503,
        json: {
          message: 'USGS overlay unavailable in storyboard fixture.',
        },
      });
      return;
    }

    await route.fulfill({
      contentType: 'application/json',
      json: {
        source: 'USGS Earthquake Catalog GeoJSON fallback fixture',
        sourceUrl:
          'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson',
        attribution: 'U.S. Geological Survey Earthquake Hazards Program',
        updatedAt:
          overlayState === 'stale'
            ? '2020-01-01T00:00:00Z'
            : '2026-08-11T19:00:00Z',
        staleAfter:
          overlayState === 'stale'
            ? '2020-01-02T00:00:00Z'
            : '2026-08-12T19:00:00Z',
        fallback: true,
        query: {
          minMagnitude: 0,
          days: 7,
          minLatitude: 45.8,
          maxLatitude: 49.1,
          minLongitude: -104.2,
          maxLongitude: -96.4,
        },
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

function datasetIdFromUrl(url: string, suffix = ''): string {
  const pathname = new URL(url).pathname;
  const datasetId = pathname.split('/datasets/')[1]?.replace(suffix, '');

  return datasetId || 'tiger-line-north-dakota-2025';
}

function datasetTitle(datasetId: string): string {
  if (datasetId.includes('california')) {
    return '2025 TIGER/Line - Census Tracts - California';
  }

  if (datasetId.includes('texas')) {
    return '2025 TIGER/Line - Census Tracts - Texas';
  }

  return '2025 TIGER/Line - Census Tracts - North Dakota';
}

function datasetDetail(datasetId: string): unknown {
  const geography = datasetId.includes('california')
    ? 'California'
    : datasetId.includes('texas')
      ? 'Texas'
      : 'North Dakota';

  return {
    id: datasetId,
    title: datasetTitle(datasetId),
    program: 'TIGER_LINE',
    publisher: 'U.S. Census Bureau',
    abstractText: `${geography} Census tract boundary metadata represented as a repository research object with source links, file manifests, and map-layer evidence.`,
    geography,
    vintageYear: 2025,
    releasedOn: '2025-08-01',
    files: [
      {
        id: 'source-zip',
        label: 'TIGER/Line source archive',
        format: 'ZIP',
        url: 'https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html',
      },
      {
        id: 'metadata-html',
        label: 'TIGER/Line technical documentation',
        format: 'OTHER',
        url: 'https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html',
      },
    ],
    citation: `U.S. Census Bureau. 2025 TIGER/Line Shapefiles: Census Tracts, ${geography}.`,
    sourceUrl:
      'https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html',
    accessibilityEvidenceStatus: 'AUTOMATED_PASS',
    relatedResearch: [
      {
        id: `lodes-wac-${geography.toLowerCase().replaceAll(' ', '-')}-2023`,
        title: `2023 LODES Workplace Area Characteristics - ${geography}`,
        contentType: 'DATASET',
        program: 'LODES',
        publisher: 'U.S. Census Bureau',
        summary: `LEHD Origin-Destination Employment Statistics metadata for ${geography} workforce geography.`,
        geography,
        vintageYear: 2023,
        sourceUrl: 'https://lehd.ces.census.gov/data/',
      },
      {
        id: 'usgs-earthquakes-overlay',
        title: 'USGS Earthquake Overlay',
        contentType: 'DATASET',
        program: 'USGS',
        publisher: 'U.S. Geological Survey',
        summary:
          'Earthquake Hazards Program GeoJSON overlay metadata for map context and event lists.',
        geography: 'United States',
        vintageYear: 2026,
        sourceUrl:
          'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson',
      },
    ],
  };
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
