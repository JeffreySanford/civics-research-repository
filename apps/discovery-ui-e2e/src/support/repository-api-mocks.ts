import type { Page } from '@playwright/test';

/**
 * Forces one repository API route to fail.
 *
 * <p>Playwright gives precedence to the most recently registered handler, so call this after
 * {@link mockRepositoryApi} to override a single happy-path route while the rest stay healthy.
 */
export async function failRepositoryApi(
  page: Page,
  urlPattern: string,
  status = 503,
): Promise<void> {
  await page.route(urlPattern, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status,
      json: { message: 'Repository API unavailable in storyboard fixture.' },
    });
  });
}

/**
 * Serves the same search payload labelled as fixture content, so the placeholder disclosure can be
 * exercised without taking DSpace down.
 */
export async function mockFixtureBackedRepositoryApi(
  page: Page,
): Promise<void> {
  await page.route(`**/api/search**`, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: searchResponse('California', 'FIXTURE'),
    });
  });

  await page.route(`**/api/datasets/*`, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/map-layers') || pathname.endsWith('/versions')) {
      await route.fallback();
      return;
    }

    await route.fulfill({
      contentType: 'application/json',
      json: {
        ...(datasetDetail(datasetIdFromUrl(route.request().url())) as object),
        source: 'FIXTURE',
      },
    });
  });
}

export async function mockRepositoryApi(page: Page): Promise<void> {
  await page.route(`**/api/search**`, async (route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get('q') ?? '';
    const geography = url.searchParams.get('geography');
    const selectedGeography =
      geography || (query === 'Texas' ? 'Texas' : 'California');

    await route.fulfill({
      contentType: 'application/json',
      json: searchResponse(
        selectedGeography,
        'REPOSITORY',
        url.searchParams.getAll('program'),
        url.searchParams.get('contentType') ?? '',
      ),
    });
  });

  // Layers are geography-specific, the way the API serves them: the maps page requests a new
  // dataset id whenever the selected Census area changes.
  await page.route(`**/api/datasets/*/map-layers`, async (route) => {
    const geography = geographyFromDatasetId(
      datasetIdFromUrl(route.request().url(), '/map-layers'),
    );

    await route.fulfill({
      contentType: 'application/json',
      json: [
        {
          id: 'tiger-line-boundary-preview',
          label: `2025 TIGER/Line Census area preview - ${geography}`,
          layerType: 'CENSUS_BOUNDARY',
          sourceUrl:
            'https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html',
          attribution: 'U.S. Census Bureau TIGER/Line',
          visibleByDefault: true,
        },
        {
          id: 'lodes-workplace-flow-sample',
          label: `2023 LODES workplace flow sample - ${geography}`,
          layerType: 'CENSUS_DATA',
          sourceUrl: 'https://lehd.ces.census.gov/data/',
          attribution:
            'U.S. Census Bureau LEHD Origin-Destination Employment Statistics',
          visibleByDefault: true,
        },
        {
          id: 'saipe-county-poverty',
          label: `2023 SAIPE county poverty - ${geography}`,
          layerType: 'CENSUS_CHOROPLETH',
          sourceUrl:
            'https://www.census.gov/data/datasets/2023/demo-saipe/2023-state-and-county.html',
          attribution:
            'U.S. Census Bureau Small Area Income and Poverty Estimates',
          visibleByDefault: true,
        },
        {
          id: 'usgs-3hp-hydrography',
          label: 'USGS 3D Hydrography Program reference',
          layerType: 'USGS_REFERENCE',
          sourceUrl:
            'https://hydro.nationalmap.gov/arcgis/rest/services/3DHP_all/MapServer',
          attribution: 'U.S. Geological Survey 3D Hydrography Program',
          visibleByDefault: false,
          rasterTileUrlTemplate:
            '/overlays/usgs/hydrography/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&f=image&transparent=true',
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

  await page.route(`**/api/overlays/census/lodes-flow**`, async (route) => {
    const geography =
      new URL(route.request().url()).searchParams.get('geography') ??
      'North Dakota';

    await route.fulfill({
      contentType: 'application/json',
      json: lodesFlowOverlay(geography),
    });
  });

  await page.route(`**/api/overlays/census/saipe-counties**`, async (route) => {
    const geography =
      new URL(route.request().url()).searchParams.get('geography') ??
      'North Dakota';

    await route.fulfill({
      contentType: 'application/json',
      json: saipeChoropleth(geography),
    });
  });

  await page.route(
    `**/api/overlays/usgs/hydrography/export**`,
    async (route) => {
      await route.fulfill({
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2ZkAAAAASUVORK5CYII=',
          'base64',
        ),
      });
    },
  );

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

    const body = route.request().postDataJSON() as
      | { mode?: string; source?: string }
      | undefined;
    const mode =
      body?.mode === 'DIFF' || body?.mode === 'APPLY' ? body.mode : 'DRY_RUN';

    await route.fulfill({
      contentType: 'application/json',
      status: 202,
      json: {
        id: '11111111-1111-4111-8111-111111111111',
        mode,
        source: 'TIGER_LINE',
        status: SYNC_STATUS_BY_MODE[mode],
        startedAt: '2026-08-11T19:00:00Z',
        completedAt: '2026-08-11T19:00:01Z',
        actions: SYNC_ACTIONS_BY_MODE[mode],
      },
    });
  });

  await page.route(`**/api/admin/reindex`, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        contentType: 'application/json',
        status: 202,
        json: {
          source: 'REPOSITORY',
          objectCount: 3,
          rebuiltAt: '2026-08-11T19:00:05Z',
        },
      });
      return;
    }

    await route.fulfill({
      contentType: 'application/json',
      json: {
        source: 'REPOSITORY',
        objectCount: 3,
        rebuiltAt: '2026-08-11T19:00:05Z',
      },
    });
  });

  await page.route(`**/api/admin/sources/inventory`, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        checkedAt: '2026-08-17T19:36:20.535Z',
        objectCount: 176,
        programCount: 3,
        distinctFileCount: 191,
        measuredFileCount: 167,
        unreachableFileCount: 8,
        totalBytes: 1848988848,
        byProgram: [
          {
            program: 'ACS',
            objectCount: 56,
            fileCount: 57,
            measuredFileCount: 52,
            unreachableFileCount: 5,
            totalBytes: 612000000,
          },
          {
            program: 'TIGER_LINE',
            objectCount: 56,
            fileCount: 58,
            measuredFileCount: 57,
            unreachableFileCount: 1,
            totalBytes: 429000000,
          },
          {
            program: 'LODES',
            objectCount: 53,
            fileCount: 54,
            measuredFileCount: 50,
            unreachableFileCount: 2,
            totalBytes: 54000000,
          },
        ],
      },
    });
  });

  await page.route(`**/api/admin/dspace/overview`, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        reachable: true,
        readEnabled: true,
        writeEnabled: false,
        baseUrl: 'http://localhost:8081/server',
        itemCount: 3,
        communityCount: 1,
        collectionCount: 1,
        storedBitstreamCount: 76,
        storedBytes: 1073739747,
        communities: [
          {
            name: 'Census Public Research Data',
            uuid: '11111111-1111-4111-8111-111111111111',
          },
        ],
        collections: [
          {
            name: 'TIGER/Line Geospatial Files',
            uuid: '22222222-2222-4222-8222-222222222222',
          },
        ],
        lastSyncStatus: 'APPLIED',
        lastSyncSource: 'TIGER_LINE',
        lastSyncStartedAt: '2026-08-11T19:00:00Z',
        storedMetadataFields: [
          'dc.title',
          'dc.description',
          'crr.program',
          'crr.geography',
          'crr.file.manifest',
        ],
        programCounts: [{ program: 'TIGER_LINE', count: 3 }],
        recentSyncActionSummary: [
          { actionType: 'UPSERT_ITEM', count: 2 },
          { actionType: 'UPSERT_FILE_MANIFEST', count: 1 },
        ],
      },
    });
  });

  await page.route(`**/api/admin/solr/overview`, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        enabled: true,
        reachable: true,
        baseUrl: 'http://localhost:8983/solr',
        core: 'discovery',
        indexedDocumentCount: 3,
        projectionSource: 'REPOSITORY',
        projectionObjectCount: 3,
        lastRebuiltAt: '2026-08-11T19:00:05Z',
        projectionBreakdown: {
          indexedCount: 3,
          projectedCount: 3,
          repositoryItemCount: 3,
          source: 'REPOSITORY',
        },
      },
    });
  });

  await page.route(`**/api/accessibility/evidence`, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: accessibilityEvidence(),
    });
  });
}

const SYNC_STATUS_BY_MODE = {
  DRY_RUN: 'DRY_RUN_COMPLETE',
  DIFF: 'DIFF_COMPLETE',
  APPLY: 'APPLIED',
} as const;

const SYNC_ACTIONS_BY_MODE = {
  DRY_RUN: [
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
  DIFF: [
    {
      actionType: 'VERIFY_COMMUNITY',
      target: 'Census Public Research Data',
      detail: 'Check whether the DSpace community exists.',
    },
    {
      actionType: 'CREATE_ITEM',
      target: '2025 TIGER/Line - Census Tracts - North Dakota',
      detail:
        'DSpace item does not exist; create item with normalized metadata.',
    },
  ],
  APPLY: [
    {
      actionType: 'UPSERT_ITEM',
      target: '2025 TIGER/Line - Census Tracts - North Dakota',
      detail: 'Reconciled Dublin Core and crr metadata for the seeded item.',
    },
    {
      actionType: 'SKIP_ITEM',
      target: '2023 LODES - North Dakota Workplace Area Characteristics',
      detail: 'DSpace item is current; no metadata changes.',
    },
  ],
} as const;

function accessibilityEvidence() {
  return [
    {
      id: 'axe-wcag-2026-08-12',
      workflow: 'axe-core scans (6 routes)',
      status: 'AUTOMATED_PASS',
      standard: 'WCAG_2_1_AA',
      capturedAt: '2026-08-12T00:00:00Z',
      notes:
        '57 checks passed. Command: pnpm run wcag:report. Artifact: documentation/accessibility-evidence/release-checklists/2026-08-12-automated-baseline.md',
    },
    {
      id: 'section508-2026-08-12',
      workflow: 'Section 508 tagged scans',
      status: 'AUTOMATED_PASS',
      standard: 'SECTION_508',
      capturedAt: '2026-08-12T00:00:00Z',
      notes: '57 checks passed. Command: pnpm run section508:report.',
    },
    {
      id: 'storyboard-2026-08-12',
      workflow: 'Demo storyboard workflows',
      status: 'AUTOMATED_PASS',
      standard: 'WCAG_2_1_AA',
      capturedAt: '2026-08-12T00:00:00Z',
      notes: '72 end-to-end workflow checks. Command: pnpm run storyboard.',
    },
    {
      id: 'keyboard-checklist',
      workflow: 'Manual keyboard-only checklist (K1–K31)',
      status: 'MANUAL_REVIEW_REQUIRED',
      standard: 'WCAG_2_1_AA',
      capturedAt: '2026-08-12T00:00:00Z',
      notes:
        'Preconditions automated; full mouse-free end-to-end run not recorded.',
    },
    {
      id: 'nvda-checklist',
      workflow: 'NVDA smoke test (N1–N20)',
      status: 'NOT_STARTED',
      standard: 'WCAG_2_1_AA',
      capturedAt: '2026-08-12T00:00:00Z',
      notes: 'Not run.',
    },
    {
      id: 'map-equivalence',
      workflow: 'Map equivalence checklist (M1–M15)',
      status: 'MANUAL_REVIEW_REQUIRED',
      standard: 'WCAG_2_1_AA',
      capturedAt: '2026-08-12T00:00:00Z',
      notes: 'M12 map-to-list focus is the priority manual check.',
    },
  ];
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

/**
 * Detail for the research package objects.
 *
 * Kept separate from the dataset shape rather than parameterised into it: a publication has
 * authors, a DOI and typed edges and no map layers, and pretending one function describes both is
 * how the UI ended up calling every object a dataset in the first place.
 */
function researchPackageDetail(datasetId: string): unknown | null {
  if (datasetId === 'ces-wp-25-23-spatial-mismatch') {
    return {
      source: 'REPOSITORY',
      id: datasetId,
      title: 'Re-assessing the Spatial Mismatch Hypothesis',
      contentType: 'PUBLICATION',
      program: 'LEHD',
      publisher: 'U.S. Census Bureau',
      abstractText:
        'Uses LEHD location information to develop new evidence on spatial mismatch and the relative earnings of Black workers in large US cities.',
      geography: 'United States',
      vintageYear: 2025,
      releasedOn: '2025-04-01',
      accessLevel: 'PUBLIC',
      license: 'Public domain. A work of the U.S. Government, 17 U.S.C. 105.',
      doi: '10.3386/w32252',
      authors: [
        { name: 'David Card' },
        { name: 'Jesse Rothstein' },
        { name: 'Moises Yi' },
      ],
      relations: [
        {
          verb: 'uses',
          targetId: 'lehd-microdata-restricted',
          targetTitle:
            'LEHD Longitudinal Employer-Household Dynamics microdata',
          targetType: 'DATASET',
          targetAccessLevel: 'RESTRICTED',
          note: 'The underlying job-level records are available only through an FSRDC.',
        },
      ],
      files: [
        {
          id: 'working-paper',
          label: 'CES-WP-25-23 (PDF)',
          format: 'PDF',
          url: 'https://www2.census.gov/library/working-papers/2025/adrm/ces/CES-WP-25-23.pdf',
        },
      ],
      citation:
        'David Card, Jesse Rothstein, Moises Yi. "Re-assessing the Spatial Mismatch Hypothesis." CES-25-23, 2025.',
      sourceUrl:
        'https://www2.census.gov/library/working-papers/2025/adrm/ces/CES-WP-25-23.pdf',
      relatedResearch: [],
      accessibilityEvidenceStatus: 'AUTOMATED_PASS',
    };
  }

  if (datasetId === 'lehd-microdata-restricted') {
    return {
      source: 'REPOSITORY',
      id: datasetId,
      title: 'LEHD Longitudinal Employer-Household Dynamics microdata',
      contentType: 'DATASET',
      program: 'LEHD',
      publisher: 'U.S. Census Bureau',
      abstractText:
        'Job-level linked employer-household records protected under Title 13. The repository holds no files for this object and can hold none.',
      geography: 'United States',
      vintageYear: 2025,
      releasedOn: '2025-01-01',
      accessLevel: 'RESTRICTED',
      accessNote:
        'Access requires an approved research proposal and Special Sworn Status through a Federal Statistical Research Data Center.',
      license: 'Restricted under Title 13, U.S. Code. Not redistributable.',
      authors: [],
      relations: [],
      files: [],
      citation:
        'U.S. Census Bureau. Longitudinal Employer-Household Dynamics microdata. Restricted use.',
      sourceUrl:
        'https://www.census.gov/programs-surveys/ces/data/restricted-use-data.html',
      relatedResearch: [],
      accessibilityEvidenceStatus: 'AUTOMATED_PASS',
    };
  }

  return null;
}

function datasetDetail(datasetId: string): unknown {
  const researchPackage = researchPackageDetail(datasetId);
  if (researchPackage) {
    return researchPackage;
  }

  const geography = datasetId.includes('california')
    ? 'California'
    : datasetId.includes('texas')
      ? 'Texas'
      : 'North Dakota';

  return {
    source: 'REPOSITORY',
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

function searchResponse(
  geography: string,
  resultSource: 'REPOSITORY' | 'FIXTURE' = 'REPOSITORY',
  selectedPrograms: readonly string[] = [],
  selectedContentType = '',
): unknown {
  // The research package is national, so it survives a geography filter the way the API's does.
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

  const results = [...datasetResults, ...packageResults];

  return {
    resultSource,
    query: geography,
    page: 0,
    pageSize: 25,
    totalResults: results.length,
    results,
    facets: [
      {
        field: 'program',
        label: 'Program',
        // Unselected options stay visible with their unfiltered counts, mirroring the excluded
        // facet the Solr client asks for.
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

/**
 * The geography a seeded dataset identifier refers to, matching the API's slug convention.
 * Longest match wins, because an area slug can contain hyphens and can contain another slug.
 */
function geographyFromDatasetId(datasetId: string): string {
  const areas: Record<string, string> = {
    'north-dakota': 'North Dakota',
    california: 'California',
    texas: 'Texas',
  };

  return (
    Object.entries(areas)
      .filter(([slug]) => datasetId.includes(slug))
      .sort(([left], [right]) => right.length - left.length)
      .map(([, geography]) => geography)[0] ?? 'United States'
  );
}

function lodesFlowOverlay(geography: string): unknown {
  return {
    source: `LEHD LODES 2023 main OD sample - ${geography}`,
    sourceUrl:
      'https://lehd.ces.census.gov/data/lodes/LODES8/nd/od/nd_od_main_JT00_2023.csv.gz',
    attribution:
      'U.S. Census Bureau LEHD Origin-Destination Employment Statistics',
    geography,
    vintage: 2023,
    fallback: false,
    geoJson: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { id: 'demo-flow', workerCount: 1240 },
          geometry: {
            type: 'LineString',
            coordinates: [
              [-100.7837, 46.8083],
              [-96.7898, 46.8772],
            ],
          },
        },
        {
          type: 'Feature',
          properties: { label: 'Bismarck area (home)' },
          geometry: { type: 'Point', coordinates: [-100.7837, 46.8083] },
        },
        {
          type: 'Feature',
          properties: { label: 'Fargo area (work)' },
          geometry: { type: 'Point', coordinates: [-96.7898, 46.8772] },
        },
      ],
    },
    flows: [
      {
        id: 'nd-burleigh-cass',
        originLabel: 'Bismarck area (home)',
        destinationLabel: 'Fargo area (work)',
        workerCount: 1240,
        originCounty: 'Burleigh County',
        destinationCounty: 'Cass County',
      },
    ],
  };
}

function saipeChoropleth(geography: string): unknown {
  return {
    source: `SAIPE 2023 county poverty - ${geography}`,
    sourceUrl:
      'https://www2.census.gov/programs-surveys/saipe/datasets/2023/2023-state-and-county/est23all.txt',
    attribution:
      'U.S. Census Bureau Small Area Income and Poverty Estimates (SAIPE)',
    geography,
    vintage: 2023,
    measureLabel: 'Poverty rate, all ages (percent)',
    geoJson: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            fips: '38015',
            name: 'Burleigh County',
            povertyRate: 7.2,
            medianHouseholdIncome: 71200,
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-101.0, 46.5],
                [-100.2, 46.5],
                [-100.2, 47.1],
                [-101.0, 47.1],
                [-101.0, 46.5],
              ],
            ],
          },
        },
        {
          type: 'Feature',
          properties: {
            fips: '38017',
            name: 'Cass County',
            povertyRate: 9.8,
            medianHouseholdIncome: 66800,
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-97.4, 46.6],
                [-96.6, 46.6],
                [-96.6, 47.2],
                [-97.4, 47.2],
                [-97.4, 46.6],
              ],
            ],
          },
        },
      ],
    },
    counties: [
      {
        fips: '38015',
        name: 'Burleigh County',
        povertyRate: 7.2,
        medianHouseholdIncome: 71200,
      },
      {
        fips: '38017',
        name: 'Cass County',
        povertyRate: 9.8,
        medianHouseholdIncome: 66800,
      },
    ],
  };
}
