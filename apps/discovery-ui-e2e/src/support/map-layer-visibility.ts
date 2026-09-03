import { expect, type Page } from '@playwright/test';

/** Every MapLibre layer the maps page registers for the demo toggles. */
export const REGISTERED_MAP_LAYER_IDS = [
  'census-area-fill',
  'census-area-outline',
  'lodes-workplace-jobs-circles',
  'saipe-county-fill',
  'saipe-county-outline',
  'repository-research-coverage-fill',
  'repository-research-coverage-line',
  'repository-research-coverage-points',
  'usgs-3hp-hydrography-raster',
  'usgs-earthquake-points',
  'usgs-earthquake-labels',
  'usgs-earthquake-selected',
  'lodes-workplace-flow-line',
  'lodes-workplace-flow-selected',
  'lodes-workplace-flow-points',
] as const;

export type MapLayerVisibility = Record<
  (typeof REGISTERED_MAP_LAYER_IDS)[number],
  'visible' | 'none' | 'missing' | 'missing-map'
>;

type MapLayerVisibilityGroup = {
  name: string;
  categoryTestId: string;
  toggleTestId: string;
  mapLayerIds: readonly (typeof REGISTERED_MAP_LAYER_IDS)[number][];
  accessibleListText: string;
  legendText: string | RegExp;
  urlOffPattern: RegExp;
};

export const MAP_LAYER_VISIBILITY_GROUPS: readonly MapLayerVisibilityGroup[] = [
  {
    name: 'TIGER/Line boundary',
    categoryTestId: 'map-layer-category-geography-boundaries',
    toggleTestId: 'map-layer-tiger',
    mapLayerIds: ['census-area-fill', 'census-area-outline'],
    accessibleListText: '2025 TIGER/Line Census area preview - North Dakota',
    legendText: 'North Dakota TIGER/Line preview',
    urlOffPattern: /tiger=off/,
  },
  {
    name: 'LODES workplace employment',
    categoryTestId: 'map-layer-category-community-economy',
    toggleTestId: 'map-layer-workplace',
    mapLayerIds: ['lodes-workplace-jobs-circles'],
    accessibleListText: 'Jobs by workplace county for North Dakota',
    legendText: /LODES workplace employment/,
    urlOffPattern: /workplace=off/,
  },
  {
    name: 'LODES commuting flows',
    categoryTestId: 'map-layer-category-community-economy',
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
    categoryTestId: 'map-layer-category-community-economy',
    toggleTestId: 'map-layer-saipe',
    mapLayerIds: ['saipe-county-fill', 'saipe-county-outline'],
    accessibleListText: 'SAIPE 2023 county poverty - North Dakota',
    legendText: /SAIPE county poverty/,
    urlOffPattern: /saipe=off/,
  },
  {
    name: 'Data.gov publisher research geometry',
    categoryTestId: 'map-layer-category-research-coverage',
    toggleTestId: 'map-layer-research-coverage',
    mapLayerIds: [
      'repository-research-coverage-fill',
      'repository-research-coverage-line',
      'repository-research-coverage-points',
    ],
    accessibleListText: 'Data.gov publisher research geometry',
    legendText: /Data.gov publisher research geometry/,
    urlOffPattern: /research=off/,
  },
  {
    name: 'USGS 3HP hydrography',
    categoryTestId: 'map-layer-category-environment-hazards',
    toggleTestId: 'map-layer-hydrography',
    mapLayerIds: ['usgs-3hp-hydrography-raster'],
    accessibleListText:
      'Raster reference overlay for streams, rivers, and lakes from the 3D Hydrography Program',
    legendText: 'USGS 3HP hydrography reference',
    urlOffPattern: /hydrography=off/,
  },
  {
    name: 'USGS earthquake overlay',
    categoryTestId: 'map-layer-category-environment-hazards',
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

export async function openLayerCategoryForToggle(
  page: Page,
  toggleTestId: string,
): Promise<void> {
  const group = MAP_LAYER_VISIBILITY_GROUPS.find(
    (candidate) => candidate.toggleTestId === toggleTestId,
  );
  if (!group) {
    throw new Error(`No layer visibility group for ${toggleTestId}`);
  }

  const category = page.getByTestId(group.categoryTestId);
  const isOpen = await category.evaluate(
    (element) => (element as HTMLDetailsElement).open,
  );
  if (!isOpen) {
    await category.locator('summary').click();
  }
  await expect(category).toHaveJSProperty('open', true);
}

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

export async function waitForRegisteredMapLayers(page: Page): Promise<void> {
  await expect(page.getByTestId('discovery-map-canvas')).toBeVisible();

  // Registration is the relevant contract for these tests. Do not gate it on isStyleLoaded():
  // Firefox can keep that global style signal false while application-owned overlay behavior and
  // the accessible map UI remain usable. Dedicated @maps evidence polls the actual layer objects.
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
