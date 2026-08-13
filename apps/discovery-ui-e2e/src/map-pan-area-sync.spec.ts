import { expect, test } from '@playwright/test';
import { waitForRegisteredMapLayers } from './support/map-layer-visibility';
import { mockRepositoryApi } from './support/repository-api-mocks';

/** California center from the storyboard census-areas fixture bounding box. */
const CALIFORNIA_CENTER = {
  longitude: -119.2704,
  latitude: 37.2719,
};

async function panMapTo(
  page: import('@playwright/test').Page,
  center: { longitude: number; latitude: number },
  zoom = 6,
): Promise<void> {
  await page.evaluate(
    ({ longitude, latitude, zoomLevel }) => {
      const container = document.querySelector(
        '[data-testid="discovery-map-canvas"]',
      );
      const map = (
        container as HTMLElement & {
          __map?: {
            jumpTo: (options: {
              center: [number, number];
              zoom: number;
            }) => void;
          };
        }
      )?.__map;

      map?.jumpTo({ center: [longitude, latitude], zoom: zoomLevel });
    },
    { longitude: center.longitude, latitude: center.latitude, zoomLevel: zoom },
  );
}

test.describe('map pan census area sync', () => {
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
    await expect(page.getByLabel('Census area')).toHaveValue('North Dakota');
  });

  test('panning the map center into another state updates the census area @maps', async ({
    page,
  }) => {
    await panMapTo(page, CALIFORNIA_CENTER);

    await expect(page.getByLabel('Census area')).toHaveValue('California', {
      timeout: 5000,
    });
    await expect(page).toHaveURL(/area=California/);
    await expect(
      page.getByText('Census area updated to California based on map center.'),
    ).toBeVisible();
  });

  test('panning over the ocean does not change the census area @maps', async ({
    page,
  }) => {
    await panMapTo(page, { longitude: -130, latitude: 40 });

    // Waiting out the sync debounce is the assertion: there is no state change to wait for, and
    // checking immediately would pass even if the area did change a moment later.
    // eslint-disable-next-line playwright/no-wait-for-timeout
    await page.waitForTimeout(500);

    await expect(page.getByLabel('Census area')).toHaveValue('North Dakota');
    await expect(page).not.toHaveURL(/area=/);
  });
});
