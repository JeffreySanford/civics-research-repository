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
  await mockResearchSpatialCoverage(page);
  await mockCountyBusinessPatterns(page);
  await mockMapLayersWithCountyBusinessPatterns(page);
}

/** Fixture-backed discovery uses the same cursor envelope while retaining its source disclosure. */
export async function mockFixtureBackedRepositoryApi(
  page: Page,
): Promise<void> {
  await mockFixtureBackedRepositoryApiBase(page);
  await mockCursorSearch(page, 'FIXTURE');
  await mockResearchSpatialCoverage(page);
  await mockCountyBusinessPatterns(page);
  await mockMapLayersWithCountyBusinessPatterns(page);
}

async function mockMapLayersWithCountyBusinessPatterns(
  page: Page,
): Promise<void> {
  await page.route('**/api/datasets/*/map-layers', async (route) => {
    const pathname = new URL(route.request().url()).pathname.toLowerCase();
    const geography = pathname.includes('california')
      ? 'California'
      : pathname.includes('texas')
        ? 'Texas'
        : 'North Dakota';
    const slug = geography.toLowerCase().replaceAll(' ', '-');

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
          label: `2023 LODES commuting flows - ${geography}`,
          layerType: 'CENSUS_DATA',
          sourceUrl: 'https://lehd.ces.census.gov/data/',
          attribution:
            'U.S. Census Bureau LEHD Origin-Destination Employment Statistics',
          visibleByDefault: true,
        },
        {
          id: `saipe-county-poverty-${slug}`,
          label: `2023 SAIPE county poverty - ${geography}`,
          layerType: 'CENSUS_CHOROPLETH',
          sourceUrl:
            'https://www.census.gov/data/datasets/2023/demo-saipe/2023-state-and-county.html',
          attribution:
            'U.S. Census Bureau Small Area Income and Poverty Estimates',
          visibleByDefault: false,
        },
        {
          id: `population-estimates-county-${slug}`,
          label: `Vintage 2025 county Population Estimates - ${geography}`,
          layerType: 'CENSUS_CHOROPLETH',
          sourceUrl:
            'https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/counties/totals/co-est2025-alldata.csv',
          attribution: 'U.S. Census Bureau Population Estimates Program',
          visibleByDefault: false,
        },
        {
          id: `county-business-patterns-${slug}`,
          label: `2023 County Business Patterns - ${geography}`,
          layerType: 'CENSUS_CHOROPLETH',
          sourceUrl:
            'https://www2.census.gov/programs-surveys/cbp/datasets/2023/cbp23co.zip',
          attribution: 'U.S. Census Bureau County Business Patterns',
          visibleByDefault: false,
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
          id: 'usgs-3dep-terrain',
          label: 'USGS 3DEP terrain',
          layerType: 'USGS_REFERENCE',
          sourceUrl:
            'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer',
          attribution: 'USGS National Map 3D Elevation Program (3DEP)',
          visibleByDefault: false,
          rasterTileUrlTemplate:
            '/overlays/usgs/terrain/export?bbox={bbox-epsg-3857}&mode=hillshade',
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
}

async function mockCountyBusinessPatterns(page: Page): Promise<void> {
  await page.route(
    '**/api/overlays/census/county-business-patterns**',
    async (route) => {
      const url = new URL(route.request().url());
      const geography = url.searchParams.get('geography') ?? 'North Dakota';
      const measure = url.searchParams.get('measure') ?? 'ESTABLISHMENTS';
      const industryCode = url.searchParams.get('industry') ?? 'TOTAL';
      const year = Number(url.searchParams.get('year') ?? 2023);

      const measureLabel =
        measure === 'EMPLOYMENT'
          ? 'Mid-March employment'
          : measure === 'FIRST_QUARTER_PAYROLL'
            ? 'First-quarter payroll'
            : measure === 'ANNUAL_PAYROLL'
              ? 'Annual payroll'
              : 'Establishments';
      const units =
        measure === 'EMPLOYMENT'
          ? 'people'
          : measure === 'FIRST_QUARTER_PAYROLL' ||
              measure === 'ANNUAL_PAYROLL'
            ? 'thousand dollars'
            : 'establishments';
      const industryLabel =
        industryCode === '54'
          ? 'Professional, Scientific, and Technical Services'
          : 'All sectors';

      const countyFixtures = [
        {
          fips: '38001',
          name: 'Adams County',
          available: true,
          values: {
            ESTABLISHMENTS: industryCode === '54' ? 4 : 113,
            EMPLOYMENT: industryCode === '54' ? 14 : 890,
            FIRST_QUARTER_PAYROLL: industryCode === '54' ? 210 : 10400,
            ANNUAL_PAYROLL: industryCode === '54' ? 860 : 42800,
          },
          noiseFlag: industryCode === '54' ? 'H' : 'G',
          geometry: [
            [-102.7, 45.9],
            [-102.0, 45.9],
            [-102.0, 46.4],
            [-102.7, 46.4],
            [-102.7, 45.9],
          ],
        },
        {
          fips: '38017',
          name: 'Cass County',
          available: true,
          values: {
            ESTABLISHMENTS: industryCode === '54' ? 3 : 6200,
            EMPLOYMENT: industryCode === '54' ? 0 : 105000,
            FIRST_QUARTER_PAYROLL: industryCode === '54' ? 0 : 1450000,
            ANNUAL_PAYROLL: industryCode === '54' ? 0 : 5900000,
          },
          noiseFlag: 'G',
          geometry: [
            [-97.8, 46.6],
            [-96.8, 46.6],
            [-96.8, 47.2],
            [-97.8, 47.2],
            [-97.8, 46.6],
          ],
        },
        {
          fips: '38035',
          name: 'Grand Forks County',
          available: industryCode !== '54',
          values: {
            ESTABLISHMENTS: 2600,
            EMPLOYMENT: 42000,
            FIRST_QUARTER_PAYROLL: 525000,
            ANNUAL_PAYROLL: 2140000,
          },
          noiseFlag: 'G',
          geometry: [
            [-98.1, 47.7],
            [-97.0, 47.7],
            [-97.0, 48.4],
            [-98.1, 48.4],
            [-98.1, 47.7],
          ],
        },
      ] as const;

      const counties = countyFixtures.map((county) => ({
        fips: county.fips,
        name: county.name,
        available: county.available,
        value: county.available
          ? county.values[measure as keyof typeof county.values]
          : null,
        noiseFlag:
          county.available && measure !== 'ESTABLISHMENTS'
            ? county.noiseFlag
            : null,
      }));

      await route.fulfill({
        contentType: 'application/json',
        json: {
          layerId: `county-business-patterns-${geography
            .toLowerCase()
            .replaceAll(' ', '-')}`,
          source: 'U.S. Census Bureau County Business Patterns',
          sourceUrl:
            'https://www2.census.gov/programs-surveys/cbp/datasets/2023/cbp23co.zip',
          attribution: 'U.S. Census Bureau County Business Patterns',
          geography,
          geographyLevel: 'COUNTY',
          sourceReferenceYear: 2023,
          sourceSha256: 'b'.repeat(64),
          capturedAt: '2026-09-06',
          geometryVintage: 2023,
          geometrySourceUrl: 'https://tigerweb.geo.census.gov/',
          geometryAttribution: 'U.S. Census Bureau TIGERweb',
          measure,
          measureLabel,
          units,
          industryCode,
          industryLabel,
          year,
          availableCountyCount: counties.filter((county) => county.available)
            .length,
          unavailableCountyCount: counties.filter(
            (county) => !county.available,
          ).length,
          excludedStatewideRows: 753,
          missingRowSemantics:
            'A missing county/industry row is unavailable in the published source and must not be interpreted as zero.',
          counties,
          geoJson: {
            type: 'FeatureCollection',
            sourceReferenceYear: 2023,
            geometryVintage: 2023,
            measure,
            industryCode,
            year,
            features: countyFixtures.map((county, index) => ({
              type: 'Feature',
              properties: {
                GEOID: county.fips,
                fips: county.fips,
                name: county.name,
                available: counties[index].available,
                value: counties[index].value,
                noiseFlag: counties[index].noiseFlag,
                measure,
                industryCode,
                year,
              },
              geometry: {
                type: 'Polygon',
                coordinates: [county.geometry],
              },
            })),
          },
        },
      });
    },
  );
}

async function mockResearchSpatialCoverage(page: Page): Promise<void> {
  await page.route('**/api/maps/research-coverage**', async (route) => {
    const url = new URL(route.request().url());
    const viewport = {
      west: Number(url.searchParams.get('west') ?? -125),
      south: Number(url.searchParams.get('south') ?? 30),
      east: Number(url.searchParams.get('east') ?? -110),
      north: Number(url.searchParams.get('north') ?? 45),
    };
    const featureLimit = positiveInteger(url.searchParams.get('limit'), 200);

    await route.fulfill({
      contentType: 'application/json',
      json: {
        buildId: 'data-gov-spatial-e2e',
        sourceSystem: 'DATA_GOV',
        schemaVersion: 1,
        sourceSnapshotAt: '2026-09-02T12:00:00Z',
        capturedAt: '2026-09-02T12:05:00Z',
        compositionSha256: 'a'.repeat(64),
        projectionId: 'projection-e2e',
        criteriaFingerprint: 'criteria-e2e',
        viewport,
        summary: {
          matchingRecords: 33,
          mappedRecords: 30,
          unmappedRecords: 3,
          quarantinedRecords: 1,
          unanchoredAntimeridianRecords: 0,
          viewportMappedRecords: 3,
          returnedFeatures: 2,
          omittedFeatures: 1,
          featureLimit,
          truncated: true,
        },
        features: [
          {
            sourceSystem: 'DATA_GOV',
            sourceIdentifier: 'publisher-climate-polygon',
            title: 'California Climate Resilience Study',
            publisher: 'U.S. Census Bureau',
            program: 'TIGER_LINE',
            contentType: 'DATASET',
            sourceUrl:
              'https://catalog.data.gov/dataset/california-climate-resilience',
            geometryStatus: 'VALID',
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [-122.6, 37.1],
                  [-121.8, 37.1],
                  [-121.8, 37.8],
                  [-122.6, 37.1],
                ],
              ],
            },
            renderLon: -122.2,
            renderLat: 37.45,
            renderPointMethod: 'SHAPE_BOUNDS_CENTER',
          },
          {
            sourceSystem: 'DATA_GOV',
            sourceIdentifier: 'publisher-water-point',
            title: 'Western Water Research Observatory',
            publisher: 'U.S. Census Bureau',
            program: 'LODES',
            contentType: 'DATASET',
            sourceUrl:
              'https://catalog.data.gov/dataset/western-water-research',
            geometryStatus: 'VALID',
            geometry: { type: 'Point', coordinates: [-118.25, 34.05] },
            renderLon: -118.25,
            renderLat: 34.05,
            renderPointMethod: 'SHAPE_BOUNDS_CENTER',
          },
        ],
      },
    });
  });
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
