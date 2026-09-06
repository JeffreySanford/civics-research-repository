import { expect, test } from '@playwright/test';
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

test.describe('2023 County Business Patterns', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);
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
      'Employment for Professional, Scientific, and Technical Services in North Dakota, 2023',
    );

    const table = page.getByRole('table', {
      name: /Employment for Professional, Scientific, and Technical Services in North Dakota, 2023/,
    });
    await expect(table).toBeVisible();

    const cassRow = table.getByRole('row', { name: /Cass County/ });
    await expect(cassRow).toContainText('0 employees');
    await expect(cassRow).toContainText('Published');
    await expect(cassRow).toContainText('G');

    const grandForksRow = table.getByRole('row', {
      name: /Grand Forks County/,
    });
    await expect(grandForksRow).toContainText('Unavailable');

    const legend = page.getByLabel('Visible map layer legend');
    await expect(legend).toContainText(
      'County Business Patterns — Employment',
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

    await expect(page.getByTestId('map-layer-county-business-patterns')).toBeChecked();
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
        name: /Employment for Professional, Scientific, and Technical Services in North Dakota, 2023/,
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
