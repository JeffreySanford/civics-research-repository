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
      name: 'LODES commuting flows',
    });
    const tiger = layerControls.getByRole('checkbox', {
      name: 'TIGER/Line boundary',
    });

    await lodes.check();
    await tiger.check();

    await expect(page.getByText('2023 LODES commuting flows')).toBeVisible();
    await expect(page.getByText('2025 TIGER/Line Census area')).toBeVisible();

    await lodes.uncheck();
    await expect(page.getByText('2023 LODES commuting flows')).toHaveCount(0);
    // Only the LODES layer goes: a toggle must not take its neighbours with it.
    await expect(page.getByText('2025 TIGER/Line Census area')).toBeVisible();

    await tiger.uncheck();
    await expect(page.getByText('2025 TIGER/Line Census area')).toHaveCount(0);

    await lodes.check();
    await expect(page.getByText('2023 LODES commuting flows')).toBeVisible();
  });

  /** The toggle is shareable state: a copied URL has to reopen the same map. */
  test('the LODES toggle survives a reload @maps', async ({ page }) => {
    await page
      .getByRole('group', { name: 'Map layer controls' })
      .getByRole('checkbox', { name: 'LODES commuting flows' })
      .check();

    await page
      .getByRole('group', { name: 'Map layer controls' })
      .getByRole('checkbox', { name: 'LODES commuting flows' })
      .uncheck();

    await expect(page).toHaveURL(/lodes=off/);

    await page.reload();

    await expect(
      page
        .getByRole('group', { name: 'Map layer controls' })
        .getByRole('checkbox', { name: 'LODES commuting flows' }),
    ).not.toBeChecked();
    await expect(page.getByText('2023 LODES commuting flows')).toHaveCount(0);
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
      .getByRole('checkbox', { name: 'LODES commuting flows' })
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
      page.getByText('2023 LODES commuting flows - California'),
    ).toBeVisible();
    await expect(
      page.getByText('2025 TIGER/Line Census area preview - North Dakota'),
    ).toHaveCount(0);
  });

  test('unsupported SAIPE capability removes the control and skips the request @maps', async ({
    page,
  }) => {
    const community = page.getByTestId(
      'map-layer-category-community-economy',
    );
    await expect(community).toContainText('3 layers');
    await expect(page.getByTestId('map-layer-saipe')).toBeVisible();

    let floridaSaipeRequests = 0;
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (
        url.pathname.endsWith('/api/overlays/census/saipe-counties') &&
        url.searchParams.get('geography') === 'Florida'
      ) {
        floridaSaipeRequests += 1;
      }
    });

    // Registered after the shared fixture, so this handler owns only the unsupported Florida
    // dataset. All other geography fixtures keep using the normal mockRepositoryApi contract.
    await page.route('**/api/datasets/*/map-layers', async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (!pathname.includes('tiger-line-florida-2025')) {
        await route.fallback();
        return;
      }

      await route.fulfill({
        contentType: 'application/json',
        json: [
          {
            id: 'tiger-line-florida-boundary',
            label: '2025 TIGER/Line Census area preview - Florida',
            layerType: 'CENSUS_BOUNDARY',
            sourceUrl: 'https://www.census.gov/geographies/',
            attribution: 'U.S. Census Bureau TIGER/Line',
            visibleByDefault: true,
          },
          {
            id: 'lodes-workplace-flow-florida',
            label: '2023 LODES commuting flows - Florida',
            layerType: 'CENSUS_DATA',
            sourceUrl: 'https://lehd.ces.census.gov/data/',
            attribution: 'U.S. Census Bureau LEHD',
            visibleByDefault: true,
          },
          {
            id: 'usgs-3hp-hydrography',
            label: 'USGS 3D Hydrography Program reference',
            layerType: 'USGS_REFERENCE',
            sourceUrl: 'https://hydro.nationalmap.gov/',
            attribution: 'U.S. Geological Survey 3D Hydrography Program',
            visibleByDefault: false,
          },
          {
            id: 'usgs-earthquakes-florida',
            label: 'USGS earthquake overlay',
            layerType: 'USGS_EARTHQUAKE',
            sourceUrl: 'https://earthquake.usgs.gov/',
            attribution: 'U.S. Geological Survey Earthquake Hazards Program',
            visibleByDefault: true,
          },
        ],
      });
    });

    await page.goto('/maps?area=Florida');

    await expect(community).toContainText('2 layers');
    await expect(page.getByTestId('map-layer-saipe')).toHaveCount(0);
    await expect(page.getByTestId('map-layer-saipe-info')).toHaveCount(0);
    await expect(page.getByText('Loading map data from the API')).toHaveCount(0);
    expect(floridaSaipeRequests).toBe(0);
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

    // Off: still reported in full. "Source loaded, layers none" is how an unused layer is told
    // apart from a broken one, so the details are not something to hide.
    await expect(earthquakeGroup).toHaveAttribute('data-toggled', 'off');
    await expect(earthquakeGroup).toContainText('OFF');
    await expect(earthquakeGroup).toContainText('usgs-earthquake-points=none');
    await expect(earthquakeGroup).toContainText('usgs-earthquake-labels=none');
    await expect(earthquakeGroup).toContainText(
      'usgs-earthquake-selected=none',
    );

    await earthquake.check();
    await expect(earthquakeGroup).toHaveAttribute('data-toggled', 'on');
    await expect(earthquakeGroup).toContainText(
      'usgs-earthquake-points=visible',
    );

    await earthquake.uncheck();
    await expect(earthquakeGroup).toHaveAttribute('data-toggled', 'off');
    // Off in the panel means off on the map, not merely off in the store.
    await expect(earthquakeGroup).toHaveAttribute(
      'data-matches-toggle',
      'true',
    );
  });

  /**
   * With every group open the panel outgrew the map stage, which clips its overflow, so the lower
   * groups were cut off rather than scrollable and the toggle that closes it was out of reach.
   */
  test('the map debug panel scrolls and keeps its toggle reachable @maps', async ({
    page,
  }) => {
    const layerControls = page.getByRole('group', {
      name: 'Map layer controls',
    });
    for (const name of [
      'TIGER/Line boundary',
      'LODES commuting flows',
      'SAIPE county poverty',
      'USGS 3HP hydrography',
      'USGS earthquake overlay',
    ]) {
      await layerControls.getByRole('checkbox', { name }).check();
    }

    const toggle = page.getByTestId('map-debug-toggle');
    await toggle.click();

    const panel = page.getByTestId('map-debug-panel');
    await expect(panel).toBeVisible();

    // Taller than it can show, and able to scroll rather than clip.
    const scroll = await panel.evaluate((element) => ({
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      overflowY: getComputedStyle(element).overflowY,
    }));
    expect(scroll.overflowY).toBe('auto');
    expect(scroll.scrollHeight).toBeGreaterThan(scroll.clientHeight);

    // The last group is reachable by scrolling the panel.
    const lastGroup = page.getByTestId('map-debug-group-hydrography');
    await lastGroup.scrollIntoViewIfNeeded();
    await expect(lastGroup).toBeVisible();

    // And the panel never grows past the stage that contains it.
    const fits = await panel.evaluate((element) => {
      const stage = element.closest('.map-stage');
      if (!stage) {
        return false;
      }
      return (
        element.getBoundingClientRect().bottom <=
        stage.getBoundingClientRect().bottom + 1
      );
    });
    expect(fits).toBe(true);

    // The toggle stays usable, so the panel can always be closed again.
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(panel).toHaveCount(0);
  });

  /**
   * Two ways out, both required. The toggle was reported as missing, and it was: Material's own
   * button styles beat the bare class, so it rendered as blue text with no background over a
   * moving map. Close lives in the panel's sticky header, within reach however far it is scrolled.
   */
  test('the map debug panel closes from the toggle and from Close @maps', async ({
    page,
  }) => {
    const toggle = page.getByTestId('map-debug-toggle');
    await toggle.click();

    const panel = page.getByTestId('map-debug-panel');
    await expect(panel).toBeVisible();

    // The toggle is legible: a real background, not Material's transparent one.
    const background = await toggle.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    expect(background).not.toBe('rgba(0, 0, 0, 0)');
    expect(background).not.toBe('transparent');

    const close = page.getByTestId('map-debug-close');
    await expect(close).toBeVisible();
    await close.click();
    await expect(panel).toHaveCount(0);

    // And the toggle still both opens and closes it.
    await toggle.click();
    await expect(page.getByTestId('map-debug-panel')).toBeVisible();
    await toggle.click();
    await expect(page.getByTestId('map-debug-panel')).toHaveCount(0);
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
