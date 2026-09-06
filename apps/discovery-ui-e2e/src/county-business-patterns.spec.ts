import { expect, test, type Page } from '@playwright/test';
import {
  expectMapLayersVisibility,
  openLayerCategoryForToggle,
  waitForRegisteredMapLayers,
} from './support/map-layer-visibility';
import { mockRepositoryApi } from './support/repository-api-mocks';

const cbpLayers = [
  'county-business-patterns-county-fill',
  'county-business-patterns-county-outline',
] as const;

async function installCountyBusinessPatternsCapability(
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

test.describe('2023 County Business Patterns', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);
    await installCountyBusinessPatternsCapability(page);
  });

  test('measure and industry keep controls, URL, legend, and semantic publication states aligned @wcag @section508', async ({
    page,
  }) => {
    await page.goto('/maps');

    await openLayerCategoryForToggle(
      page,
      'map-layer-county-business-patterns',
    );

    const toggle = page.getByTestId('map-layer-county-business-patterns');
    await expect(toggle).not.toBeChecked();
    await toggle.check();
    await expect(toggle).toBeChecked();

    const measure = page.getByTestId('county-business-patterns-measure');
    const industry = page.getByTestId('county-business-patterns-industry');
    const year = page.getByTestId('county-business-patterns-year');

    await expect(measure).toHaveValue('ESTABLISHMENTS');
    await expect(industry).toHaveValue('TOTAL');
    await expect(year).toHaveValue('2023');

    await expect(
      page.getByRole('status', {
        name: 'County business activity context',
      }),
    ).toContainText('Establishments for All sectors in North Dakota, 2023');

    await measure.selectOption('EMPLOYMENT');
    await industry.selectOption('54');

    await expect(page).toHaveURL(/countyBusinessPatterns=on/);
    await expect(page).toHaveURL(/countyBusinessPatternsMeasure=EMPLOYMENT/);
    await expect(page).toHaveURL(/countyBusinessPatternsIndustry=54/);
    await expect(page).toHaveURL(/countyBusinessPatternsYear=2023/);

    await expect(
      page.getByRole('status', {
        name: 'County business activity context',
      }),
    ).toContainText(
      'Mid-March employment for Professional, Scientific, and Technical Services in North Dakota, 2023',
    );

    const table = page.getByRole('table', {
      name: /Mid-March employment for Professional, Scientific, and Technical Services in North Dakota, 2023/,
    });
    await expect(table).toBeVisible();

    const cassRow = table.getByRole('row', { name: /Cass County/ });
    await expect(cassRow).toContainText('0 people');
    await expect(cassRow).toContainText('Published');
    await expect(cassRow).toContainText('G');

    const grandForksRow = table.getByRole('row', {
      name: /Grand Forks County/,
    });
    await expect(grandForksRow).toContainText('Unavailable');

    const legend = page.getByLabel('Visible map layer legend');
    await expect(legend).toContainText(
      'County Business Patterns — Mid-March employment',
    );
    await expect(legend).toContainText('unavailable, not zero');
  });

  test('URL restores County Business Patterns configuration reproducibly @wcag @section508', async ({
    page,
  }) => {
    await page.goto(
      '/maps?countyBusinessPatterns=on&countyBusinessPatternsMeasure=EMPLOYMENT&countyBusinessPatternsIndustry=54&countyBusinessPatternsYear=2023',
    );

    await openLayerCategoryForToggle(
      page,
      'map-layer-county-business-patterns',
    );

    await expect(
      page.getByTestId('map-layer-county-business-patterns'),
    ).toBeChecked();
    await expect(
      page.getByTestId('county-business-patterns-measure'),
    ).toHaveValue('EMPLOYMENT');
    await expect(
      page.getByTestId('county-business-patterns-industry'),
    ).toHaveValue('54');
    await expect(page.getByTestId('county-business-patterns-year')).toHaveValue(
      '2023',
    );

    await expect(
      page.getByRole('table', {
        name: /Mid-March employment for Professional, Scientific, and Technical Services in North Dakota, 2023/,
      }),
    ).toBeVisible();
  });

  test('County Business Patterns uses real MapLibre layers and starts hidden @maps', async ({
    page,
  }) => {
    await page.goto('/maps');

    await waitForRegisteredMapLayers(page);
    await expectMapLayersVisibility(page, cbpLayers, 'none');

    await openLayerCategoryForToggle(
      page,
      'map-layer-county-business-patterns',
    );
    await page.getByTestId('map-layer-county-business-patterns').check();

    await expectMapLayersVisibility(page, cbpLayers, 'visible');

    await page
      .getByTestId('county-business-patterns-industry')
      .selectOption('54');
    await page
      .getByTestId('county-business-patterns-measure')
      .selectOption('ANNUAL_PAYROLL');

    await expectMapLayersVisibility(page, cbpLayers, 'visible');
    await expect(page.getByLabel('Visible map layer legend')).toContainText(
      'Gray means the selected county/industry row is unavailable, not zero.',
    );
  });
});
