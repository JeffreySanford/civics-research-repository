import { expect, test } from '@playwright/test';
import {
  MAP_LAYER_VISIBILITY_GROUPS,
  expectLayerEvidenceHidden,
  expectLayerEvidenceVisible,
  waitForRegisteredMapLayers,
} from './support/map-layer-visibility';
import { mockRepositoryApi } from './support/repository-api-mocks';

/**
 * Verifies that each registered demo layer stays in sync across four surfaces:
 * the toggle, the legend, the accessible layer list, and MapLibre layout visibility.
 *
 * Pixel diffs are intentionally avoided: MapLibre renders to a canvas and OSM basemap tiles
 * vary by network timing. Layout visibility is the stable signal for "drawn vs hidden".
 */
test.describe('map layer MapLibre visibility', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);
    await page.goto('/maps');
    await expect(
      page.getByRole('heading', { name: 'MapLibre geospatial workspace' }),
    ).toBeVisible();
    await expect(page.getByText('Loading map data from the API')).toHaveCount(
      0,
    );
    await waitForRegisteredMapLayers(page);
  });

  for (const group of MAP_LAYER_VISIBILITY_GROUPS) {
    test(`${group.name} toggle syncs legend, URL, and MapLibre visibility @maps`, async ({
      page,
    }) => {
      const toggle = page.getByTestId(group.toggleTestId);

      if (group.defaultChecked) {
        await expect(toggle).toBeChecked();
        await expectLayerEvidenceVisible(page, group);

        await toggle.uncheck();
        await expect(toggle).not.toBeChecked();
        await expect(page).toHaveURL(group.urlOffPattern);
        await expectLayerEvidenceHidden(page, group);

        await toggle.check();
        await expect(toggle).toBeChecked();
        await expect(page).not.toHaveURL(group.urlOffPattern);
        await expectLayerEvidenceVisible(page, group);
        return;
      }

      await expect(toggle).not.toBeChecked();
      await expectLayerEvidenceHidden(page, group);

      await toggle.check();
      await expect(toggle).toBeChecked();
      await expectLayerEvidenceVisible(page, group);

      await toggle.uncheck();
      await expect(toggle).not.toBeChecked();
      await expect(page).toHaveURL(group.urlOffPattern);
      await expectLayerEvidenceHidden(page, group);
    });
  }

  test('turning one layer off leaves the other MapLibre groups visible @maps', async ({
    page,
  }) => {
    await page.getByTestId('map-layer-lodes').uncheck();
    await expect(page.getByTestId('map-layer-lodes')).not.toBeChecked();

    await expectLayerEvidenceVisible(page, MAP_LAYER_VISIBILITY_GROUPS[0]);
    await expectLayerEvidenceVisible(page, MAP_LAYER_VISIBILITY_GROUPS[2]);
    await expectLayerEvidenceVisible(page, MAP_LAYER_VISIBILITY_GROUPS[4]);
    await expectLayerEvidenceHidden(page, MAP_LAYER_VISIBILITY_GROUPS[1]);
  });
});
