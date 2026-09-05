import { expect, test, type Page } from '@playwright/test';
import { openLayerCategoryForToggle } from './support/map-layer-visibility';
import { mockRepositoryApi } from './support/repository-api-mocks';

const transparentPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2ZkAAAAASUVORK5CYII=',
  'base64',
);

async function installTerrainFixtures(page: Page): Promise<void> {
  await page.route('**/api/datasets/*/map-layers', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: [
        {
          id: 'tiger-line-boundary-preview',
          label: '2025 TIGER/Line Census area preview',
          layerType: 'CENSUS_BOUNDARY',
          sourceUrl:
            'https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html',
          attribution: 'U.S. Census Bureau TIGER/Line',
          visibleByDefault: true,
        },
        {
          id: 'lodes-workplace-flow-sample',
          label: '2023 LODES commuting flows',
          layerType: 'CENSUS_DATA',
          sourceUrl: 'https://lehd.ces.census.gov/data/',
          attribution:
            'U.S. Census Bureau LEHD Origin-Destination Employment Statistics',
          visibleByDefault: true,
        },
        {
          id: 'usgs-3dep-terrain',
          label: 'USGS 3DEP terrain',
          layerType: 'USGS_REFERENCE',
          sourceUrl:
            'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer',
          attribution: 'U.S. Geological Survey 3D Elevation Program',
          visibleByDefault: false,
          rasterTileUrlTemplate:
            '/overlays/usgs/terrain/export?bbox={bbox-epsg-3857}&mode=hillshade',
        },
        {
          id: 'usgs-3hp-hydrography',
          label: 'USGS 3D Hydrography Program reference',
          layerType: 'USGS_REFERENCE',
          sourceUrl:
            'https://hydro.nationalmap.gov/arcgis/rest/services/3DHP_all/MapServer',
          attribution: 'U.S. Geological Survey 3D Hydrography Program',
          visibleByDefault: false,
          rasterTileUrlTemplate:
            '/overlays/usgs/hydrography/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&f=image&transparent=true',
        },
        {
          id: 'usgs-earthquakes-preview',
          label: 'USGS earthquake overlay',
          layerType: 'USGS_EARTHQUAKE',
          sourceUrl:
            'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson',
          attribution: 'U.S. Geological Survey Earthquake Hazards Program',
          visibleByDefault: true,
        },
      ],
    });
  });

  await page.route('**/api/overlays/usgs/terrain/export**', async (route) => {
    await route.fulfill({
      contentType: 'image/png',
      body: transparentPng,
    });
  });
}

async function terrainMapState(page: Page): Promise<{
  visibility: string | null;
  tiles: string[];
} | null> {
  return page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="discovery-map-canvas"]') as
      | (HTMLElement & { __map?: import('maplibre-gl').Map })
      | null;
    const map = canvas?.__map;

    if (!map?.getLayer('usgs-3dep-terrain-raster')) {
      return null;
    }

    const source = map.getStyle().sources['usgs-3dep-terrain'] as
      | { tiles?: string[] }
      | undefined;

    return {
      visibility:
        map.getLayoutProperty('usgs-3dep-terrain-raster', 'visibility') ??
        'visible',
      tiles: source?.tiles ?? [],
    };
  });
}

test.describe('USGS 3DEP terrain', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);
    await installTerrainFixtures(page);
  });

  test('keyboard controls, URL state, legend, and semantic status stay aligned @wcag @section508', async ({
    page,
  }) => {
    await page.goto('/maps');
    await openLayerCategoryForToggle(page, 'map-layer-terrain');

    const toggle = page.getByTestId('map-layer-terrain');
    await expect(toggle).not.toBeChecked();

    await toggle.focus();
    await page.keyboard.press('Space');
    await expect(toggle).toBeChecked();
    await expect(page).toHaveURL(/terrain=on/);

    const mode = page.getByTestId('terrain-mode');
    await expect(mode).toHaveValue('hillshade');

    await mode.focus();
    await mode.selectOption('tinted');

    await expect(mode).toHaveValue('tinted');
    await expect(page).toHaveURL(/terrainMode=tinted/);
    await expect(page.getByLabel('Visible map layer legend')).toContainText(
      'USGS 3DEP terrain — Tinted elevation',
    );

    await expect(page.getByTestId('terrain-semantic-status')).toContainText(
      'USGS 3DEP terrain is on — Tinted elevation',
    );
    await expect(page.getByTestId('terrain-semantic-status')).toContainText(
      'contextual imagery only',
    );
  });

  test('registers one MapLibre raster layer, starts hidden, and swaps rendering mode @maps', async ({
    page,
  }) => {
    await page.goto('/maps');

    await expect.poll(() => terrainMapState(page)).not.toBeNull();
    await expect.poll(async () => (await terrainMapState(page))?.visibility).toBe(
      'none',
    );
    await expect.poll(async () => (await terrainMapState(page))?.tiles.join(' ')).toContain(
      'mode=hillshade',
    );

    await openLayerCategoryForToggle(page, 'map-layer-terrain');
    await page.getByTestId('map-layer-terrain').check();

    await expect.poll(async () => (await terrainMapState(page))?.visibility).toBe(
      'visible',
    );

    await page.getByTestId('terrain-mode').selectOption('slope');

    await expect.poll(async () => (await terrainMapState(page))?.tiles.join(' ')).toContain(
      'mode=slope',
    );
    await expect.poll(async () => (await terrainMapState(page))?.visibility).toBe(
      'visible',
    );
  });

  test('restores terrain visibility and mode while Census geography changes @maps @wcag @section508', async ({
    page,
  }) => {
    await page.goto('/maps?terrain=on&terrainMode=tinted&area=North%20Dakota');
    await openLayerCategoryForToggle(page, 'map-layer-terrain');

    await expect(page.getByTestId('map-layer-terrain')).toBeChecked();
    await expect(page.getByTestId('terrain-mode')).toHaveValue('tinted');

    await page.getByLabel('Census area').selectOption('California');

    await expect(page).toHaveURL(/area=California/);
    await expect(page).toHaveURL(/terrain=on/);
    await expect(page).toHaveURL(/terrainMode=tinted/);
    await expect(page.getByTestId('map-layer-terrain')).toBeChecked();
    await expect(page.getByTestId('terrain-mode')).toHaveValue('tinted');

    await expect.poll(async () => (await terrainMapState(page))?.visibility).toBe(
      'visible',
    );
    await expect.poll(async () => (await terrainMapState(page))?.tiles.join(' ')).toContain(
      'mode=tinted',
    );
  });
});
