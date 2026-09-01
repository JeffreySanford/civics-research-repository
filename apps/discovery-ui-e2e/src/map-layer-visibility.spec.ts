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

  test('layer categories organize controls without owning render state @maps @wcag @section508', async ({
    page,
  }) => {
    const censusCategory = page.getByTestId(
      'map-layer-category-census-community',
    );
    const censusSummary = page.getByTestId(
      'map-layer-category-census-community-summary',
    );
    const environmentCategory = page.getByTestId(
      'map-layer-category-environment-hazards',
    );

    await expect(censusSummary).toContainText('Census & Community');
    await expect(censusSummary).toContainText('0 of 4 visible');
    await expect(environmentCategory.locator('summary')).toContainText(
      'Environment & Hazards',
    );
    await expect(environmentCategory.locator('summary')).toContainText(
      '0 of 2 visible',
    );

    const tiger = page.getByTestId('map-layer-tiger');
    await tiger.check();
    await expect(censusSummary).toContainText('1 of 4 visible');

    // Collapse is presentation-only. The checked layer remains selected and rendered, and the
    // category summary still tells the reader that an active child is inside the closed group.
    await censusSummary.click();
    await expect(censusCategory).not.toHaveAttribute('open', '');
    await expect(censusSummary).toContainText('1 of 4 visible');
    await expect(tiger).toBeChecked();
    await expectLayerEvidenceVisible(page, MAP_LAYER_VISIBILITY_GROUPS[0]);

    await censusSummary.click();
    await expect(censusCategory).toHaveAttribute('open', '');
    await expect(tiger).toBeVisible();
  });

  for (const group of MAP_LAYER_VISIBILITY_GROUPS) {
    test(`${group.name} toggle syncs legend, URL, and MapLibre visibility @maps`, async ({
      page,
    }) => {
      const toggle = page.getByTestId(group.toggleTestId);

      // Every layer starts off. There used to be a branch here for layers that started on; it has
      // been dead since the defaults changed, and a conditional in a test hides which path ran.
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
    for (const group of MAP_LAYER_VISIBILITY_GROUPS) {
      await page.getByTestId(group.toggleTestId).check();
    }

    await page.getByTestId('map-layer-lodes').uncheck();
    await expect(page.getByTestId('map-layer-lodes')).not.toBeChecked();

    // Addressed by toggle id, not by position. These used to be numeric indices, and adding a
    // layer to the table silently repointed every one of them at its neighbour: the assertion
    // still passed its own shape while checking the wrong layer.
    const groupFor = (toggleTestId: string) => {
      const group = MAP_LAYER_VISIBILITY_GROUPS.find(
        (candidate) => candidate.toggleTestId === toggleTestId,
      );
      if (!group) {
        throw new Error(`No layer visibility group for ${toggleTestId}`);
      }
      return group;
    };

    for (const toggleTestId of MAP_LAYER_VISIBILITY_GROUPS.map(
      (group) => group.toggleTestId,
    ).filter((toggleTestId) => toggleTestId !== 'map-layer-lodes')) {
      await expectLayerEvidenceVisible(page, groupFor(toggleTestId));
    }

    await expectLayerEvidenceHidden(page, groupFor('map-layer-lodes'));
  });
});
