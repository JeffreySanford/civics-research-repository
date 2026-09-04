import { expect, test } from '@playwright/test';
import {
  MAP_LAYER_VISIBILITY_GROUPS,
  expectLayerEvidenceHidden,
  expectLayerEvidenceVisible,
  openLayerCategoryForToggle,
  waitForRegisteredMapLayers,
} from './support/map-layer-visibility';
import { mockRepositoryApi } from './support/repository-api-mocks';

const groupFor = (toggleTestId: string) => {
  const group = MAP_LAYER_VISIBILITY_GROUPS.find(
    (candidate) => candidate.toggleTestId === toggleTestId,
  );
  if (!group) {
    throw new Error(`No layer visibility group for ${toggleTestId}`);
  }
  return group;
};

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
      page.getByRole('heading', { name: 'Geospatial research explorer' }),
    ).toBeVisible();
    await expect(page.getByText('Loading map data from the API')).toHaveCount(
      0,
    );
  });

  test('layer categories start collapsed and do not own selection state @wcag @section508', async ({
    page,
  }) => {
    const geographyCategory = page.getByTestId(
      'map-layer-category-geography-boundaries',
    );
    const geographySummary = page.getByTestId(
      'map-layer-category-geography-boundaries-summary',
    );
    const communityCategory = page.getByTestId(
      'map-layer-category-community-economy',
    );
    const environmentCategory = page.getByTestId(
      'map-layer-category-environment-hazards',
    );
    const researchCategory = page.getByTestId(
      'map-layer-category-research-coverage',
    );

    await expect(geographySummary).toContainText('Geography & Boundaries');
    await expect(geographySummary).toContainText('1 layer');
    await expect(communityCategory.locator('summary')).toContainText(
      'Community & Economy',
    );
    await expect(communityCategory.locator('summary')).toContainText(
      '3 layers',
    );
    await expect(environmentCategory.locator('summary')).toContainText(
      'Environment & Hazards',
    );
    await expect(environmentCategory.locator('summary')).toContainText(
      '2 layers',
    );
    await expect(researchCategory.locator('summary')).toContainText(
      'Research Coverage',
    );

    for (const category of [
      geographyCategory,
      communityCategory,
      environmentCategory,
      researchCategory,
    ]) {
      await expect(category).toHaveJSProperty('open', false);
    }

    // At the desktop test viewport the four collapsed categories share one horizontal row. Round
    // CSS pixel positions so tiny cross-browser subpixel differences do not masquerade as layout
    // drift while still catching a category that wrapped onto another row.
    const categoryTops = await Promise.all(
      [
        geographyCategory,
        communityCategory,
        environmentCategory,
        researchCategory,
      ].map((category) =>
        category.evaluate((element) =>
          Math.round(element.getBoundingClientRect().top),
        ),
      ),
    );
    expect(Math.max(...categoryTops) - Math.min(...categoryTops)).toBeLessThan(
      2,
    );

    await geographySummary.click();
    await expect(geographyCategory).toHaveJSProperty('open', true);

    const tiger = page.getByTestId('map-layer-tiger');
    await tiger.check();

    const featureList = page.locator(
      'section[aria-labelledby="features-heading"]',
    );
    const legend = page.getByLabel('Visible map layer legend');
    const tigerGroup = groupFor('map-layer-tiger');

    await expect(
      featureList.getByText(tigerGroup.accessibleListText),
    ).toBeVisible();
    await expect(legend.getByText(tigerGroup.legendText)).toBeVisible();

    // Collapse is presentation-only. The checked selection and its semantic map evidence remain
    // active even though the checkbox itself is hidden inside the native disclosure. Dedicated
    // @maps tests below cover MapLibre layout visibility without making cross-browser WCAG evidence
    // depend on Firefox/WebGL style readiness.
    await geographySummary.click();
    await expect(geographyCategory).toHaveJSProperty('open', false);
    await expect(tiger).toBeChecked();
    await expect(
      featureList.getByText(tigerGroup.accessibleListText),
    ).toBeVisible();
    await expect(legend.getByText(tigerGroup.legendText)).toBeVisible();

    await geographySummary.click();
    await expect(geographyCategory).toHaveJSProperty('open', true);
    await expect(tiger).toBeVisible();
  });

  for (const group of MAP_LAYER_VISIBILITY_GROUPS) {
    test(`${group.name} toggle syncs legend, URL, and MapLibre visibility @maps`, async ({
      page,
    }) => {
      await waitForRegisteredMapLayers(page);
      await openLayerCategoryForToggle(page, group.toggleTestId);
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
    await waitForRegisteredMapLayers(page);

    for (const group of MAP_LAYER_VISIBILITY_GROUPS) {
      await openLayerCategoryForToggle(page, group.toggleTestId);
      await page.getByTestId(group.toggleTestId).check();
    }

    await openLayerCategoryForToggle(page, 'map-layer-lodes');
    await page.getByTestId('map-layer-lodes').uncheck();
    await expect(page.getByTestId('map-layer-lodes')).not.toBeChecked();

    for (const toggleTestId of MAP_LAYER_VISIBILITY_GROUPS.map(
      (group) => group.toggleTestId,
    ).filter((toggleTestId) => toggleTestId !== 'map-layer-lodes')) {
      await expectLayerEvidenceVisible(page, groupFor(toggleTestId));
    }

    await expectLayerEvidenceHidden(page, groupFor('map-layer-lodes'));
  });
});
