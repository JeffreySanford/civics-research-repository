import { expect, test } from '@playwright/test';
import { mockRepositoryApi } from './support/repository-api-mocks';

/**
 * Covers two reported defects.
 *
 * Turning a layer off removed it from the legend but left it drawn on the map, because the LODES
 * layers had no toggle and the earthquake selection ring was missing from the visibility groups.
 * And the layer list was fetched once, for North Dakota, so selecting another Census area moved
 * the viewport while every state kept claiming North Dakota's layers.
 *
 * MapLibre layout visibility is asserted in map-layer-visibility.spec.ts via map.getLayoutProperty.
 * This file keeps legend/URL/geography regressions that do not need the MapLibre handle.
 */
test.describe('map layer controls', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);
    await page.goto('/maps');
    await expect(
      page.getByRole('heading', { name: 'MapLibre geospatial workspace' }),
    ).toBeVisible();
  });

  test('each layer toggle removes its own layer @maps', async ({ page }) => {
    const layerControls = page.getByRole('group', {
      name: 'Map layer controls',
    });
    const lodes = layerControls.getByRole('checkbox', {
      name: 'LODES workplace flow sample',
    });
    const tiger = layerControls.getByRole('checkbox', {
      name: 'TIGER/Line boundary',
    });

    await expect(page.getByText('2023 LODES workplace flow')).toBeVisible();
    await expect(page.getByText('2025 TIGER/Line Census area')).toBeVisible();

    await lodes.uncheck();
    await expect(page.getByText('2023 LODES workplace flow')).toHaveCount(0);
    // Only the LODES layer goes: a toggle must not take its neighbours with it.
    await expect(page.getByText('2025 TIGER/Line Census area')).toBeVisible();

    await tiger.uncheck();
    await expect(page.getByText('2025 TIGER/Line Census area')).toHaveCount(0);

    await lodes.check();
    await expect(page.getByText('2023 LODES workplace flow')).toBeVisible();
  });

  /** The toggle is shareable state: a copied URL has to reopen the same map. */
  test('the LODES toggle survives a reload @maps', async ({ page }) => {
    await page
      .getByRole('group', { name: 'Map layer controls' })
      .getByRole('checkbox', { name: 'LODES workplace flow sample' })
      .uncheck();

    await expect(page).toHaveURL(/lodes=off/);

    await page.reload();

    await expect(
      page
        .getByRole('group', { name: 'Map layer controls' })
        .getByRole('checkbox', { name: 'LODES workplace flow sample' }),
    ).not.toBeChecked();
    await expect(page.getByText('2023 LODES workplace flow')).toHaveCount(0);
  });

  test('selecting a Census area loads that area layers @maps', async ({
    page,
  }) => {
    await expect(
      page.getByText('2025 TIGER/Line Census area preview - North Dakota'),
    ).toBeVisible();

    await page
      .getByRole('combobox', { name: /Census area/i })
      .selectOption({ label: 'California' });

    await expect(
      page.getByText('2025 TIGER/Line Census area preview - California'),
    ).toBeVisible();
    await expect(
      page.getByText('2023 LODES workplace flow sample - California'),
    ).toBeVisible();
    await expect(
      page.getByText('2025 TIGER/Line Census area preview - North Dakota'),
    ).toHaveCount(0);
  });

  /** Opening the map from a dataset must land on that dataset's geography, not the default. */
  test('a dataset opens the map on its own geography @maps', async ({
    page,
  }) => {
    await page.goto('/maps?area=Texas');

    await expect(
      page.getByText('2025 TIGER/Line Census area preview - Texas'),
    ).toBeVisible();
  });
});
