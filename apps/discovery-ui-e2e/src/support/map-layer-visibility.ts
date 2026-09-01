import { expect, type Page } from '@playwright/test';

/** Every MapLibre layer the maps page registers for the demo toggles. */
export const REGISTERED_MAP_LAYER_IDS = [
  'census-area-fill',
  'census-area-outline',
  'saipe-county-fill',
  'saipe-county-outline',
  'usgs-3hp-hydrography-raster',
  'usgs-earthquake-points',
  'usgs-earthquake-labels',
  'usgs-earthquake-selected',
  'lodes-workplace-flow-line',
  'lodes-workplace-flow-points',
] as const;

export type MapLayerVisibility = Record<
  (typeof REGISTERED_MAP_LAYER_IDS)[number],
  'visible' | 'none' | 'missing' | 'missing-map'
>;

type MapLayerVisibilityGroup = {
  name: string;
  toggleTestId: string;
  mapLayerIds: readonly (typeof REGISTERED_MAP_LAYER_IDS)[number][];
  accessibleListText: string;
  legendText: string | RegExp;
  urlOffPattern: RegExp;
};

export const MAP_LAYER_VISIBILITY_GROUPS: readonly MapLayerVisibilityGroup[] = [
  {
    name: 'TIGER/Line boundary',
    toggleTestId: 'map-layer-tiger',
    mapLayerIds: ['census-area-fill', 'census-area-outline'],
    accessibleListText: '2025 TIGER/Line Census area preview - North Dakota',
    legendText: 'North Dakota TIGER/Line preview',
    urlOffPattern: /tiger=off/,
  },
  {
    name: 'LODES workplace employment',
    toggleTestId: 'map-layer-workplace',
    mapLayerIds: ['lodes-workplace-jobs-circles'],
    accessibleListText: 'Jobs by workplace county for North Dakota',
    legendText: /LODES workplace employment/,
    urlOffPattern: /workplace=off/,
  },
  {
    name: 'LODES commuting flows',
    toggleTestId: 'map-layer-lodes',
    mapLayerIds: [
      'lodes-workplace-flow-line',
      'lodes-workplace-flow-selected',
      'lodes-workplace-flow-points',
    ],
    accessibleListText: 'LEHD LODES 2023 main OD sample - North Dakota',
    legendText: /LODES commuting flows/,
    urlOffPattern: /lodes=off/,
  },
  {
    name: 'SAIPE county poverty',
    toggleTestId: 'map-layer-saipe',
    mapLayerIds: ['saipe-county-fill', 'saipe-county-outline'],
    accessibleListText: 'SAIPE 2023 county poverty - North Dakota',
    legendText: /SAIPE county poverty/,
    urlOffPattern: /saipe=off/,
  },
  {
    name: 'USGS 3HP hydrography',
    toggleTestId: 'map-layer-hydrography',
    mapLayerIds: ['usgs-3hp-hydrography-raster'],
    accessibleListText:
      'Raster reference overlay for streams, rivers, and lakes from the 3D Hydrography Program',
    legendText: 'USGS 3HP hydrography reference',
    urlOffPattern: /hydrography=off/,
  },
  {
    name: 'USGS earthquake overlay',
    toggleTestId: 'map-layer-earthquake',
    mapLayerIds: [
      'usgs-earthquake-points',
      'usgs-earthquake-labels',
      'usgs-earthquake-selected',
    ],
    accessibleListText: 'USGS earthquake overlay',
    legendText: 'USGS event overlay',
    urlOffPattern: /earthquakes=off/,
  },
] as const;

/**
 * Reads MapLibre layout visibility from the live map instance.
 *
 * Limitations:
 * - Requires the maps page to expose its MapLibre handle on the canvas element because MapLibre
 *   does not publish a DOM lookup API.
 * - Asserts layout visibility only; it does not inspect rendered pixels or source feature counts.
 * - Layers that have not been added yet report `missing` rather than failing the poll immediately.
 */
export async function readMapLayerVisibility(
  page: Page,
  layerIds: readonly string[],
): Promise<Record<string, MapLayerVisibility[keyof MapLayerVisibility]>> {
  return page.evaluate((ids) => {
    const container = document.querySelector(
      '[data-testid="discovery-map-canvas"]',
    );
    const map = (
      container as HTMLElement & {
        __map?: {
          getLayer: (id: string) => unknown;
          getLayoutProperty: (id: string, name: string) => string;
        };
      }
    )?.__map;

    if (!map) {
      return Object.fromEntries(ids.map((id) => [id, 'missing-map']));
    }

    return Object.fromEntries(
      ids.map((id) => {
        if (!map.getLayer(id)) {
          return [id, 'missing'];
        }

        return [id, map.getLayoutProperty(id, 'visibility') ?? 'visible'];
      }),
    );
  }, layerIds);
}

export async function expectMapLayersVisibility(
  page: Page,
  layerIds: readonly string[],
  expected: 'visible' | 'none',
): Promise<void> {
  await expect
    .poll(async () => readMapLayerVisibility(page, layerIds), {
      message: `MapLibre layers should be ${expected}: ${layerIds.join(', ')}`,
    })
    .toEqual(Object.fromEntries(layerIds.map((id) => [id, expected])));
}

async function isMapStyleReady(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const container = document.querySelector(
      '[data-testid="discovery-map-canvas"]',
    );
    const map = (
      container as HTMLElement & {
        __map?: { isStyleLoaded: () => boolean };
      }
    )?.__map;

    return map?.isStyleLoaded() ?? false;
  });
}

export async function waitForRegisteredMapLayers(page: Page): Promise<void> {
  await expect(page.getByTestId('discovery-map-canvas')).toBeVisible();

  // MapLibre initializes asynchronously after Angular renders the canvas. Firefox can expose the
  // canvas several seconds before the dynamically imported MapLibre bundle has parsed its style,
  // so first wait for the same style-ready boundary the production page uses for overlay setup.
  await expect
    .poll(() => isMapStyleReady(page), {
      timeout: 15_000,
      message: 'MapLibre style should be ready before checking registered layers',
    })
    .toBe(true);

  // Overlay data and style readiness can resolve in either order. Give the render subscriptions a
  // bounded window to register all layers instead of assuming that work finishes within the
  // default five-second Playwright poll on every browser.
  await expect
    .poll(async () => readMapLayerVisibility(page, REGISTERED_MAP_LAYER_IDS), {
      timeout: 15_000,
      message:
        'Registered MapLibre layers should exist but stay hidden by default',
    })
    .toEqual(
      Object.fromEntries(REGISTERED_MAP_LAYER_IDS.map((id) => [id, 'none'])),
    );
}

export async function expectLayerEvidenceVisible(
  page: Page,
  group: MapLayerVisibilityGroup,
): Promise<void> {
  const featureList = page.locator(
    'section[aria-labelledby="features-heading"]',
  );

  await expect(featureList.getByText(group.accessibleListText)).toBeVisible();

  const legend = page.getByLabel('Visible map layer legend');
  await expect(legend.getByText(group.legendText)).toBeVisible();

  await expectMapLayersVisibility(page, group.mapLayerIds, 'visible');
}

export async function expectLayerEvidenceHidden(
  page: Page,
  group: MapLayerVisibilityGroup,
): Promise<void> {
  const featureList = page.locator(
    'section[aria-labelledby="features-heading"]',
  );

  await expect(featureList.getByText(group.accessibleListText)).toHaveCount(0);

  const legend = page.getByLabel('Visible map layer legend');
  await expect(legend.getByText(group.legendText)).toHaveCount(0);

  await expectMapLayersVisibility(page, group.mapLayerIds, 'none');
}
