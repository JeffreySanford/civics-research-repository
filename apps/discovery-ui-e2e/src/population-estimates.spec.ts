import { expect, test } from '@playwright/test';
import {
  expectMapLayersVisibility,
  openLayerCategoryForToggle,
  waitForRegisteredMapLayers,
} from './support/map-layer-visibility';
import { mockRepositoryApi } from './support/repository-api-mocks';

const populationLayers = [
  'population-estimates-county-fill',
  'population-estimates-county-outline',
] as const;

test.describe('Vintage 2025 County population', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);
  });

  test('measure and year keep controls, URL, legend, and semantic table aligned @wcag @section508', async ({
    page,
  }) => {
    await page.goto('/maps');

    await expect(
      page.getByRole('heading', {
        name: 'Geospatial research explorer',
      }),
    ).toBeVisible();

    await openLayerCategoryForToggle(page, 'map-layer-population');

    const toggle = page.getByTestId('map-layer-population');

    await expect(toggle).not.toBeChecked();
    await toggle.check();

    await expect(toggle).toBeChecked();

    const measure = page.getByTestId('population-measure');
    const year = page.getByTestId('population-year');

    await expect(measure).toHaveValue('ANNUAL_GROWTH_RATE');
    await expect(year).toHaveValue('2025');

    await expect(
      page.getByRole('status', {
        name: 'County population context',
      }),
    ).toContainText(
      'Annual population growth rate for North Dakota, 2024–2025',
    );

    await expect(page.getByLabel('Visible map layer legend')).toContainText(
      'County population — Annual population growth rate',
    );

    const growthTable = page.getByRole('table', {
      name: /Annual population growth rate for North Dakota, 2024–2025/,
    });

    await expect(growthTable).toBeVisible();

    await measure.selectOption('POPULATION');
    await year.selectOption('2024');

    await expect(page).toHaveURL(/population=on/);
    await expect(page).toHaveURL(/populationMeasure=POPULATION/);
    await expect(page).toHaveURL(/populationYear=2024/);

    await expect(
      page.getByRole('status', {
        name: 'County population context',
      }),
    ).toContainText('Resident population estimate for North Dakota, 2024');

    const populationTable = page.getByRole('table', {
      name: /Resident population estimate for North Dakota, 2024/,
    });

    const cassRow = populationTable.getByRole('row', {
      name: /Cass County/,
    });

    await expect(cassRow).toContainText('190,000');
    await expect(page.getByLabel('Visible map layer legend')).toContainText(
      'Sequential quantile thresholds',
    );
  });

  test('URL restores the Population Estimates configuration reproducibly @wcag @section508', async ({
    page,
  }) => {
    await page.goto(
      '/maps?population=on&populationMeasure=POPULATION&populationYear=2024',
    );

    await openLayerCategoryForToggle(page, 'map-layer-population');

    await expect(page.getByTestId('map-layer-population')).toBeChecked();

    await expect(page.getByTestId('population-measure')).toHaveValue(
      'POPULATION',
    );

    await expect(page.getByTestId('population-year')).toHaveValue('2024');

    await expect(
      page.getByRole('table', {
        name: /Resident population estimate for North Dakota, 2024/,
      }),
    ).toBeVisible();
  });

  test('Population Estimates uses real MapLibre layers and starts hidden @maps', async ({
    page,
  }) => {
    await page.goto('/maps');

    await waitForRegisteredMapLayers(page);

    await expectMapLayersVisibility(page, populationLayers, 'none');

    await openLayerCategoryForToggle(page, 'map-layer-population');

    await page.getByTestId('map-layer-population').check();

    await expectMapLayersVisibility(page, populationLayers, 'visible');

    await page.getByTestId('population-measure').selectOption('ANNUAL_CHANGE');

    await expect(page.getByLabel('Visible map layer legend')).toContainText(
      'centered at zero',
    );

    await expectMapLayersVisibility(page, populationLayers, 'visible');
  });
});
