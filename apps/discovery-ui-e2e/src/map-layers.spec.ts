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

  test('layer info icons appear beside each toggle @maps', async ({ page }) => {
    for (const testId of [
      'map-layer-tiger-info',
      'map-layer-lodes-info',
      'map-layer-saipe-info',
      'map-layer-hydrography-info',
      'map-layer-earthquake-info',
    ]) {
      await expect(page.getByTestId(testId)).toBeVisible();
    }

    await expect(page.locator('.maplibregl-ctrl-attrib')).toHaveCount(0);
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

    await lodes.check();
    await tiger.check();

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
      .check();

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
    const layerControls = page.getByRole('group', {
      name: 'Map layer controls',
    });

    await layerControls
      .getByRole('checkbox', { name: 'TIGER/Line boundary' })
      .check();
    await layerControls
      .getByRole('checkbox', { name: 'LODES workplace flow sample' })
      .check();

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

  /**
   * The debug panel is the tool for answering "is this layer actually drawn?", so it has to
   * account for every layer group and follow the toggles. It previously kept its own layer list
   * and had fallen two behind.
   */
  test('map debug reports every layer group and follows the toggles @maps', async ({
    page,
  }) => {
    await page.getByTestId('map-debug-toggle').click();
    const panel = page.getByTestId('map-debug-panel');
    await expect(panel).toBeVisible();

    for (const group of [
      'tiger',
      'earthquake',
      'lodes',
      'saipe',
      'hydrography',
    ]) {
      await expect(page.getByTestId(`map-debug-group-${group}`)).toBeVisible();
    }

    const earthquakeGroup = page.getByTestId('map-debug-group-earthquake');
    const earthquake = page
      .getByRole('group', { name: 'Map layer controls' })
      .getByRole('checkbox', { name: 'USGS earthquake overlay' });

    // Off: the group is listed, and says only that it is off.
    await expect(earthquakeGroup).toHaveAttribute('data-toggled', 'off');
    await expect(earthquakeGroup).toContainText('OFF');
    await expect(earthquakeGroup).not.toContainText('usgs-earthquake-points');

    // On: the details appear, including the two layers the panel used to omit entirely.
    await earthquake.check();
    await expect(earthquakeGroup).toHaveAttribute('data-toggled', 'on');
    await expect(earthquakeGroup).toContainText('usgs-earthquake-labels');
    await expect(earthquakeGroup).toContainText('usgs-earthquake-selected');
    await expect(earthquakeGroup).toContainText('usgs-earthquakes');

    await earthquake.uncheck();
    await expect(earthquakeGroup).toHaveAttribute('data-toggled', 'off');
    await expect(earthquakeGroup).not.toContainText('usgs-earthquake-labels');
    // Off in the panel means off on the map, not merely off in the store.
    await expect(earthquakeGroup).toHaveAttribute(
      'data-matches-toggle',
      'true',
    );
  });

  /** Opening the map from a dataset must land on that dataset's geography, not the default. */
  test('a dataset opens the map on its own geography @maps', async ({
    page,
  }) => {
    await page.goto('/maps?area=Texas&tiger=on&lodes=on');

    await expect(
      page.getByText('2025 TIGER/Line Census area preview - Texas'),
    ).toBeVisible();
  });
});
