import { expect, test } from '@playwright/test';
import { mockRepositoryApi } from './support/repository-api-mocks';

test.describe('demo storyboard checks', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);
  });

  test('primary navigation tells the demo story @storyboard', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', {
        name: 'Census geospatial discovery with repository sync',
      }),
    ).toBeVisible();

    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Discovery' })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Find research objects' }),
    ).toBeVisible();

    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Maps' })
      .click();
    await expect(
      page.getByRole('heading', { name: 'MapLibre geospatial workspace' }),
    ).toBeVisible();

    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Admin Sync' })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Repository sync' }),
    ).toBeVisible();

    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Evidence' })
      .click();
    await expect(
      page.getByRole('heading', {
        name: 'Platform evidence: conformance and data provenance',
      }),
    ).toBeVisible();
  });

  test('discovery search supports non-North Dakota Census areas @storyboard', async ({
    page,
  }) => {
    await page.goto('/discovery');
    await expect(
      page.getByRole('heading', { name: 'Find research objects' }),
    ).toBeVisible();

    await expect(
      page.getByRole('heading', {
        name: '2025 TIGER/Line - Census Tracts - California',
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'California (3)' }),
    ).toBeEnabled();

    await page.getByRole('button', { name: 'Texas (3)' }).click();

    await expect(
      page.getByRole('heading', {
        name: '2025 TIGER/Line - Census Tracts - Texas',
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: '2025 TIGER/Line - Census Tracts - California',
      }),
    ).toHaveCount(0);
  });

  test('discovery search filters and result links are keyboard operable @storyboard', async ({
    page,
  }) => {
    await page.goto('/discovery?q=Texas');
    await expect(
      page.getByRole('heading', { name: 'Find research objects' }),
    ).toBeVisible();

    await expect(
      page.getByRole('heading', {
        name: '2025 TIGER/Line - Census Tracts - Texas',
      }),
    ).toBeVisible();
    await expect(page.getByLabel('Search terms')).toHaveValue('Texas');

    await page.getByRole('button', { name: 'California (3)' }).focus();
    await page.keyboard.press('Enter');

    await expect(
      page.getByRole('heading', {
        name: '2025 TIGER/Line - Census Tracts - California',
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'California (3)' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/geography=California/);

    await page
      .getByRole('link', { name: 'Research object detail' })
      .first()
      .focus();
    await page.keyboard.press('Enter');

    await expect(
      page.getByRole('heading', {
        name: '2025 TIGER/Line - Census Tracts - California',
      }),
    ).toBeVisible();
  });

  test('dataset detail shows repository metadata, files, citation, and map layers @storyboard', async ({
    page,
  }) => {
    await page.goto('/discovery');
    await page
      .getByRole('link', { name: 'Research object detail' })
      .first()
      .click();

    await expect(
      page.getByRole('heading', {
        name: '2025 TIGER/Line - Census Tracts - California',
      }),
    ).toBeVisible();
    await expect(
      page.locator('dd').filter({ hasText: 'U.S. Census Bureau' }),
    ).toBeVisible();
    await expect(page.getByText('TIGER/Line source archive')).toBeVisible();
    await page.getByRole('tab', { name: 'Citation' }).click();
    await expect(page.getByRole('heading', { name: 'Citation' })).toBeVisible();

    await page.getByRole('tab', { name: 'Versions' }).click();
    await expect(page.getByText('Current')).toBeVisible();

    await page.getByRole('tab', { name: 'Map Layers' }).click();
    await expect(
      page.getByText('2023 LODES workplace flow sample'),
    ).toBeVisible();
    await expect(page.getByText('USGS earthquake overlay')).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Open map workspace' }),
    ).toBeVisible();

    await page.getByRole('tab', { name: 'Map Preview' }).click();
    await expect(
      page.getByRole('heading', { name: 'Map Preview' }),
    ).toBeVisible();
    await expect(page.getByText('California opens in the')).toBeVisible();
    await page.getByRole('link', { name: 'Open interactive map' }).click();

    await expect(
      page.getByRole('heading', { name: 'MapLibre geospatial workspace' }),
    ).toBeVisible();
    await expect(page.getByLabel('Census area')).toHaveValue('California');
    await page.goBack();
    await expect(
      page.getByRole('heading', {
        name: '2025 TIGER/Line - Census Tracts - California',
      }),
    ).toBeVisible();

    await page.getByRole('tab', { name: 'Related Research' }).click();
    await expect(
      page.getByText('2023 LODES Workplace Area Characteristics - California'),
    ).toBeVisible();
  });

  test('dataset detail tabs are keyboard operable @storyboard', async ({
    page,
  }) => {
    await page.goto('/datasets/tiger-line-north-dakota-2025');
    await expect(
      page.getByRole('heading', {
        name: '2025 TIGER/Line - Census Tracts - North Dakota',
      }),
    ).toBeVisible();

    await page.getByRole('tab', { name: 'Files' }).focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Citation' })).toBeVisible();

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Versions' })).toBeVisible();

    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('heading', { name: 'Related Research' }),
    ).toBeVisible();
  });

  /**
   * Every layer the map can draw, with the legend text that proves it is on.
   *
   * Toggles are addressed by test id, not by label: each control now sits beside an info button
   * whose accessible name contains the same layer name, so getByLabel matches two elements.
   *
   * The URL parameter is not always the toggle id -- the earthquake overlay is `earthquakes` --
   * which is exactly the kind of detail a table keeps honest.
   */
  const MAP_LAYERS = [
    { id: 'tiger', param: 'tiger', legend: /TIGER\/Line preview/ },
    { id: 'lodes', param: 'lodes', legend: /LODES workplace flow sample/ },
    { id: 'saipe', param: 'saipe', legend: /SAIPE county poverty/ },
    {
      id: 'hydrography',
      param: 'hydrography',
      legend: /USGS 3HP hydrography reference/,
    },
    { id: 'earthquake', param: 'earthquakes', legend: /USGS event overlay/ },
  ] as const;

  const allLayersOn = MAP_LAYERS.map((layer) => layer.param + '=on').join('&');

  for (const layer of MAP_LAYERS) {
    test(
      layer.id + ' layer toggles on and off on its own @storyboard',
      async ({ page }) => {
        await page.goto('/maps');

        const legend = page.getByLabel('Visible map layer legend');
        const toggle = page.getByTestId('map-layer-' + layer.id);

        // Every layer starts off, so the legend is the evidence that the toggle did something.
        await expect(toggle).not.toBeChecked();
        await expect(legend.getByText(layer.legend)).toHaveCount(0);

        await toggle.check();
        await expect(legend.getByText(layer.legend)).toBeVisible();

        await toggle.uncheck();
        await expect(legend.getByText(layer.legend)).toHaveCount(0);
        await expect(page).toHaveURL(new RegExp(layer.param + '=off'));
      },
    );

    test(
      layer.id + ' layer state survives a reload @storyboard',
      async ({ page }) => {
        await page.goto('/maps?' + layer.param + '=on');

        await expect(page.getByTestId('map-layer-' + layer.id)).toBeChecked();
        await expect(
          page.getByLabel('Visible map layer legend').getByText(layer.legend),
        ).toBeVisible();
      },
    );
  }

  /**
   * The 3HP service suppresses every layer above 1:300,000, which covers most of how this map is
   * used. That made the toggle look broken: on, request succeeds, map unchanged. The legend has to
   * say so rather than leave the user to guess.
   */
  test('hydrography says when the view is too wide to draw it @storyboard', async ({
    page,
  }) => {
    await page.goto('/maps?hydrography=on');

    await expect(
      page
        .getByLabel('Visible map layer legend')
        .getByText(/USGS 3HP hydrography reference/),
    ).toBeVisible();
    await expect(page.getByTestId('hydrography-zoom-hint')).toBeVisible();
  });

  test('the hydrography hint goes away once the layer can draw @storyboard', async ({
    page,
  }) => {
    await page.goto('/maps?hydrography=on');
    await expect(page.getByTestId('hydrography-zoom-hint')).toBeVisible();

    // Past the service's scale threshold, where the overlay can actually render.
    await page.evaluate(() => {
      const container = document.querySelector(
        '[data-testid="discovery-map-canvas"]',
      );
      const map = (
        container as HTMLElement & {
          __map?: { zoomTo: (zoom: number, options?: unknown) => void };
        }
      )?.__map;

      map?.zoomTo(11, { duration: 0 });
    });

    await expect(page.getByTestId('hydrography-zoom-hint')).toHaveCount(0);
  });

  test('every layer can be on at once @storyboard', async ({ page }) => {
    await page.goto('/maps?' + allLayersOn);

    const legend = page.getByLabel('Visible map layer legend');
    for (const layer of MAP_LAYERS) {
      await expect(page.getByTestId('map-layer-' + layer.id)).toBeChecked();
      await expect(legend.getByText(layer.legend)).toBeVisible();
    }

    await expect(legend.getByRole('listitem')).toHaveCount(MAP_LAYERS.length);
  });

  /** Turning one layer off must not disturb its neighbours. */
  test('turning one layer off leaves the others alone @storyboard', async ({
    page,
  }) => {
    await page.goto('/maps?' + allLayersOn);

    const legend = page.getByLabel('Visible map layer legend');
    await page.getByTestId('map-layer-saipe').uncheck();

    await expect(legend.getByText(/SAIPE county poverty/)).toHaveCount(0);
    for (const layer of MAP_LAYERS.filter((entry) => entry.id !== 'saipe')) {
      await expect(legend.getByText(layer.legend)).toBeVisible();
    }
  });

  test('map storyboard can switch Census area while retaining USGS overlay @storyboard', async ({
    page,
  }) => {
    await page.goto('/maps?area=California&' + allLayersOn);

    await page.locator('select option').first().waitFor({ state: 'attached' });
    await expect(page.locator('select option')).toHaveCount(3);
    await expect(page.getByLabel('Census area')).toHaveValue('California');
    await expect(page.getByText('California TIGER/Line preview')).toBeVisible();
    await expect(
      page
        .getByLabel('Visible map layer legend')
        .getByText(/LODES workplace flow sample/),
    ).toBeVisible();
    await expect(page.getByText('3 loaded')).toBeVisible();

    await page.getByLabel('Census area').selectOption('Texas');

    await expect(page.getByLabel('Census area')).toHaveValue('Texas');
    await expect(page.getByText('Texas TIGER/Line preview')).toBeVisible();
    await expect(
      page.getByText('2023 LODES workplace flow sample'),
    ).toBeVisible();
    await expect(page).toHaveURL(/area=Texas/);
    await expect(page.locator('.maplibregl-canvas')).toHaveCount(1);
  });

  test('map layer controls update visible layer evidence @storyboard', async ({
    page,
  }) => {
    await page.goto('/maps?tiger=on&lodes=on&earthquakes=on');

    await expect(
      page.getByText('North Dakota TIGER/Line preview'),
    ).toBeVisible();
    await expect(page.getByText('USGS event overlay')).toBeVisible();
    await expect(
      page.getByText('USGS Earthquake Catalog GeoJSON fallback fixture'),
    ).toBeVisible();
    await expect(
      page
        .getByLabel('Visible map layer legend')
        .getByText(/LODES workplace flow sample/),
    ).toBeVisible();

    await page.getByTestId('map-layer-tiger').uncheck();
    await expect(page.getByText('North Dakota TIGER/Line preview')).toHaveCount(
      0,
    );
    await expect(
      page.getByText('2025 TIGER/Line Census area preview'),
    ).toHaveCount(0);

    await page.getByTestId('map-layer-earthquake').uncheck();
    await expect(page.getByText('USGS event overlay')).toHaveCount(0);
    await expect(page).toHaveURL(/earthquakes=off/);
    await expect(
      page.getByText('USGS Earthquake Catalog GeoJSON fallback fixture'),
    ).toHaveCount(0);
    await expect(page.getByText('Western North Dakota')).toHaveCount(0);

    await page.getByTestId('map-layer-tiger').check();
    await page.getByTestId('map-layer-earthquake').check();
    await expect(page).not.toHaveURL(/tiger=off/);
    await expect(page).not.toHaveURL(/earthquakes=off/);

    await expect(
      page.getByText('North Dakota TIGER/Line preview'),
    ).toBeVisible();
    await expect(page.getByText('USGS event overlay')).toBeVisible();
    await expect(page.getByText('Western North Dakota')).toBeVisible();
  });

  /** Every toggle has to be operable without a mouse, not just the first two. */
  test('map layer controls are keyboard operable @storyboard', async ({
    page,
  }) => {
    await page.goto('/maps');

    const legend = page.getByLabel('Visible map layer legend');

    for (const layer of MAP_LAYERS) {
      const toggle = page.getByTestId('map-layer-' + layer.id);
      await toggle.focus();
      await expect(toggle).toBeFocused();

      await page.keyboard.press('Space');
      await expect(toggle).toBeChecked();
      await expect(legend.getByText(layer.legend)).toBeVisible();
      await expect(page).not.toHaveURL(new RegExp(layer.param + '=off'));

      await page.keyboard.press('Space');
      await expect(toggle).not.toBeChecked();
      await expect(page).toHaveURL(new RegExp(layer.param + '=off'));
    }
  });

  test('map overlay stale and error states keep Census layers visible @storyboard', async ({
    page,
  }) => {
    await page.goto('/maps?overlay=stale&' + allLayersOn);

    await expect(
      page.getByText('USGS overlay data may be stale').first(),
    ).toBeVisible();
    await expect(
      page.getByText('North Dakota TIGER/Line preview'),
    ).toBeVisible();
    await expect(
      page
        .getByLabel('Visible map layer legend')
        .getByText(/LODES workplace flow sample/),
    ).toBeVisible();
    await expect(page.getByText('Stale', { exact: true })).toBeVisible();

    await page.goto('/maps?overlay=error&' + allLayersOn);

    await expect(
      page.getByText('USGS earthquake overlay unavailable').first(),
    ).toBeVisible();
    await expect(
      page.getByText('North Dakota TIGER/Line preview'),
    ).toBeVisible();
    await expect(
      page
        .getByLabel('Visible map layer legend')
        .getByText(/LODES workplace flow sample/),
    ).toBeVisible();
    await expect(page.getByText('unavailable', { exact: true })).toBeVisible();
  });

  test('admin sync storyboard shows planned repository actions @storyboard', async ({
    page,
  }) => {
    await page.goto('/admin/sync');

    await expect(page.getByText('No sync job selected')).toBeVisible();
    await page.getByRole('button', { name: 'Dry run sync' }).click();

    await expect(
      page.locator('dd').filter({ hasText: 'DRY_RUN_COMPLETE' }),
    ).toBeVisible();
    await expect(
      page.locator('strong').filter({ hasText: 'UPSERT_COMMUNITY' }),
    ).toBeVisible();
    await expect(
      page.locator('strong').filter({ hasText: 'VERIFY_INDEX' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Diff sync' }).click();

    await expect(
      page.locator('dd').filter({ hasText: 'DIFF_COMPLETE' }),
    ).toBeVisible();
    await expect(
      page.locator('strong').filter({ hasText: 'CREATE_ITEM' }),
    ).toBeVisible();
  });

  test('admin sync apply reports reconciled repository actions @storyboard', async ({
    page,
  }) => {
    await page.goto('/admin/sync');

    await page.getByRole('button', { name: 'Apply sync' }).click();

    await expect(
      page.locator('dd').filter({ hasText: 'APPLIED' }),
    ).toBeVisible();
    await expect(
      page.locator('strong').filter({ hasText: 'UPSERT_ITEM' }),
    ).toBeVisible();
    await expect(
      page.locator('strong').filter({ hasText: 'SKIP_ITEM' }),
    ).toBeVisible();
  });
});

/**
 * The map and the accessible feature list are two views of one selection. axe cannot detect
 * whether they agree, so these checks are the automated half of the map-equivalence evidence.
 */
test.describe('map and feature list selection', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);
  });

  test('keyboard focus on a feature selects it and announces it @storyboard', async ({
    page,
  }) => {
    await page.goto('/maps?earthquakes=on');
    await expect(page.getByText('No map feature selected.')).toBeVisible();

    await page
      .getByRole('button', { name: /Western North Dakota/ })
      .first()
      .focus();

    await expect(
      page.getByRole('button', { name: /Western North Dakota/ }).first(),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page.getByText(/Selected Western North Dakota, magnitude/),
    ).toBeVisible();
    await expect(page).toHaveURL(/feature=/);
  });

  test('only one feature is selected at a time @storyboard', async ({
    page,
  }) => {
    await page.goto('/maps?earthquakes=on');

    await page.getByRole('button', { name: /Western North Dakota/ }).click();
    await page.getByRole('button', { name: /Central North Dakota/ }).click();

    await expect(
      page.getByRole('button', { name: /Central North Dakota/ }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page.getByRole('button', { name: /Western North Dakota/ }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  test('a selected feature can be restored from the URL @storyboard', async ({
    page,
  }) => {
    await page.goto('/maps?feature=demo-eastern-nd&earthquakes=on');

    await expect(
      page.getByRole('button', { name: /Eastern North Dakota/ }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(/Selected Eastern North Dakota/)).toBeVisible();
  });

  test('clearing selection restores the empty announcement @storyboard', async ({
    page,
  }) => {
    await page.goto('/maps?feature=demo-eastern-nd&earthquakes=on');

    await page.getByRole('button', { name: 'Clear selected feature' }).click();

    await expect(page.getByText('No map feature selected.')).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Eastern North Dakota/ }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  /** A selected feature that is no longer drawn would leave the two views disagreeing. */
  test('hiding the overlay clears the selection @storyboard', async ({
    page,
  }) => {
    await page.goto('/maps?feature=demo-eastern-nd&earthquakes=on');
    await expect(page.getByText(/Selected Eastern North Dakota/)).toBeVisible();

    await page.getByTestId('map-layer-earthquake').uncheck();

    await expect(page.getByText('No map feature selected.')).toBeVisible();
  });
});

/**
 * The program facet is multi-select with defaults. Selecting one program must not hide the others,
 * or the selection becomes a one-way door.
 */
/**
 * The evidence page now carries two tabs. The second one answers a different question from the
 * first: not "is this accessible" but "how much data is behind it, and how stale is that figure".
 */
test.describe('evidence data pipeline tab', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);
    await page.goto('/evidence');
    await expect(
      page.getByRole('heading', {
        name: 'Platform evidence: conformance and data provenance',
      }),
    ).toBeVisible();
  });

  test('the accessibility tab stays the one that opens @storyboard', async ({
    page,
  }) => {
    await expect(
      page.getByRole('tab', { name: 'WCAG and Section 508' }),
    ).toHaveAttribute('aria-selected', 'true');
    await expect(
      page.getByRole('tab', { name: 'Data pipeline' }),
    ).toHaveAttribute('aria-selected', 'false');
  });

  test('the pipeline tab reports subscribed, mirrored, curated, and indexed @storyboard', async ({
    page,
  }) => {
    await page.getByRole('tab', { name: 'Data pipeline' }).click();

    // Subscribed: the publishers' bytes, in binary units.
    await expect(page.getByText('1.7 GiB')).toBeVisible();
    await expect(page.getByText('191 distinct files')).toBeVisible();

    // Mirrored, curated and indexed come from the live DSpace and Solr overviews. Asserted by
    // their labels: the counts themselves depend on what the repository currently holds.
    await expect(page.getByText('Mirrored into the assetstore')).toBeVisible();
    await expect(page.getByText('Curated as research objects')).toBeVisible();
    await expect(page.getByText('Indexed for discovery')).toBeVisible();
    await expect(page.getByText(/% of the subscribed bytes/)).toBeVisible();

    // An as-of date, because a byte total without one is a number pretending to be current.
    await expect(page.getByText(/Sizes measured/)).toBeVisible();
    // Both caveats on the subscribed total, not only the failures. 191 distinct files, 167
    // measured, 8 in error leaves 16 that answered without a length.
    await expect(
      page.getByText(/8 source file\(s\) answered with an error/),
    ).toBeVisible();
    await expect(
      page.getByText(/16 more answered without reporting a length/),
    ).toBeVisible();
  });

  /** The bars are decorative; the table is the accessible equivalent and carries the same numbers. */
  test('the per-program breakdown has a table, not only bars @storyboard', async ({
    page,
  }) => {
    await page.getByRole('tab', { name: 'Data pipeline' }).click();

    const table = page.getByRole('table', {
      name: /Subscribed source data by program/,
    });
    await expect(table).toBeVisible();
    await expect(table.getByRole('row')).toHaveCount(4);
    await expect(table.getByRole('rowheader', { name: 'ACS' })).toBeVisible();
  });

  test('the pipeline tab is reachable from the keyboard @storyboard', async ({
    page,
  }) => {
    const accessibility = page.getByRole('tab', {
      name: 'WCAG and Section 508',
    });
    await accessibility.focus();
    await page.keyboard.press('ArrowRight');

    await expect(
      page.getByRole('tab', { name: 'Data pipeline' }),
    ).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('heading', {
        name: 'Subscribed, mirrored, curated, indexed',
      }),
    ).toBeVisible();
  });
});

/**
 * The open-science slice: types, typed edges, and restricted-data handling.
 *
 * Asserted through the UI rather than the API because the point of the slice is that a reader can
 * see a publication is a publication, and that a restricted object says so before they click.
 */
test.describe('research package', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);
    await page.goto('/discovery');
  });

  test('discovery lists more than datasets @storyboard', async ({ page }) => {
    await expect(
      page.getByRole('heading', {
        name: 'Re-assessing the Spatial Mismatch Hypothesis',
      }),
    ).toBeVisible();

    // The type is on the card, so the reader never has to open an object to learn what it is.
    await expect(page.getByText('PUBLICATION').first()).toBeVisible();
  });

  test('a restricted object is marked in the result list @storyboard', async ({
    page,
  }) => {
    await expect(page.locator('.result-access')).toHaveText('RESTRICTED');
  });

  test('the type facet filters and can be cleared @storyboard', async ({
    page,
  }) => {
    const publication = page.getByRole('button', { name: /^PUBLICATION \(/ });
    await publication.click();

    await expect(page).toHaveURL(/type=PUBLICATION/);
    await expect(
      page.getByRole('heading', {
        name: 'Re-assessing the Spatial Mismatch Hypothesis',
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: '2025 TIGER/Line - Census Tracts - California',
      }),
    ).toHaveCount(0);

    // Selecting the chosen type again clears it, rather than being a dead end.
    await page.getByRole('button', { name: /^PUBLICATION \(/ }).click();
    await expect(page).not.toHaveURL(/type=PUBLICATION/);
    await expect(
      page.getByRole('heading', {
        name: '2025 TIGER/Line - Census Tracts - California',
      }),
    ).toBeVisible();
  });

  test('a publication shows its authors, DOI, and typed edges @storyboard', async ({
    page,
  }) => {
    await page.goto('/datasets/ces-wp-25-23-spatial-mismatch');

    await expect(page.getByText('Publication').first()).toBeVisible();
    await expect(page.getByText('David Card')).toBeVisible();
    await expect(
      page.getByRole('link', { name: '10.3386/w32252' }),
    ).toBeVisible();

    // No map tabs on a paper: there is no geometry to draw.
    await expect(page.getByRole('tab', { name: 'Map Layers' })).toHaveCount(0);

    await page.getByRole('tab', { name: 'Research Package' }).click();
    await expect(
      page.getByRole('heading', { name: 'Research package' }),
    ).toBeVisible();
    // Scoped to the relation list: the abstract also opens with the word "Uses".
    await expect(page.locator('.relation-verb')).toHaveText('Uses');
    await expect(
      page.getByRole('link', {
        name: 'LEHD Longitudinal Employer-Household Dynamics microdata',
      }),
    ).toBeVisible();
  });

  test('a restricted object states how to obtain it and offers no files @storyboard', async ({
    page,
  }) => {
    await page.goto('/datasets/lehd-microdata-restricted');

    await expect(page.getByText('RESTRICTED').first()).toBeVisible();
    await expect(
      page.getByText(/Special Sworn Status through a Federal Statistical/),
    ).toBeVisible();
    await expect(
      page.getByText('Restricted under Title 13, U.S. Code.'),
    ).toBeVisible();
  });
});

/**
 * Pagination. 181 objects at 25 a page means most of the repository was previously unreachable
 * from the UI: the count said 181 and the list stopped at 25 with nothing to click.
 */
/** Vintage was indexed and filterable long before it was offered; now a reader can reach it. */
test.describe('vintage facet', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);
    await page.goto('/discovery');
  });

  test('years are offered newest first @storyboard', async ({ page }) => {
    const years = page.locator(
      'section[aria-labelledby="facet-vintageYear"] button',
    );

    await expect(years.first()).toHaveText(/2025/);
    await expect(years.nth(1)).toHaveText(/2023/);
  });

  test('selecting a year filters and round-trips through the URL @storyboard', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /^2023 \(/ }).click();

    await expect(page).toHaveURL(/vintageYear=2023/);
    await expect(
      page.getByRole('button', { name: /^2023 \(/ }),
    ).toHaveAttribute('aria-pressed', 'true');

    // Only the 2023 records survive; the 2025 filler is gone.
    await expect(
      page.getByRole('heading', { name: /Additional research object/ }),
    ).toHaveCount(0);
  });

  /** Selecting a year must not hide the others, or the choice becomes a one-way door. */
  test('other years stay selectable once one is chosen @storyboard', async ({
    page,
  }) => {
    await page.goto('/discovery?vintageYear=2023');

    await expect(page.getByRole('button', { name: /^2025 \(/ })).toBeEnabled();
    await expect(
      page.getByRole('button', { name: /^2025 \(/ }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  test('reselecting the chosen year clears it @storyboard', async ({
    page,
  }) => {
    await page.goto('/discovery?vintageYear=2023');

    await page.getByRole('button', { name: /^2023 \(/ }).click();

    await expect(page).not.toHaveURL(/vintageYear=/);
  });
});

test.describe('result pagination', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);
    await page.goto('/discovery');
  });

  test('the result range and page position are stated @storyboard', async ({
    page,
  }) => {
    await expect(page.getByText(/Showing 1-25 of \d+/)).toBeVisible();
    await expect(page.getByText(/Page 1 of \d+/)).toBeVisible();
  });

  test('Previous is disabled on the first page @storyboard', async ({
    page,
  }) => {
    const pager = page.getByRole('navigation', {
      name: 'Search results pages',
    });

    await expect(
      pager.getByRole('button', { name: 'Previous' }),
    ).toBeDisabled();
    await expect(pager.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  test('paging forward changes the results and the URL @storyboard', async ({
    page,
  }) => {
    const firstTitle = await page
      .locator('.result-list h3')
      .first()
      .innerText();

    await page
      .getByRole('navigation', { name: 'Search results pages' })
      .getByRole('button', { name: 'Next' })
      .click();

    await expect(page).toHaveURL(/page=1/);
    await expect(page.getByText(/Page 2 of/)).toBeVisible();
    await expect(page.getByText(/Showing 26-/)).toBeVisible();
    await expect(page.locator('.result-list h3').first()).not.toHaveText(
      firstTitle,
    );
  });

  test('a deep link opens on the requested page @storyboard', async ({
    page,
  }) => {
    await page.goto('/discovery?page=1');

    await expect(page.getByText(/Page 2 of/)).toBeVisible();
    await expect(
      page
        .getByRole('navigation', { name: 'Search results pages' })
        .getByRole('button', { name: 'Previous' }),
    ).toBeEnabled();
  });

  /** Narrowing the results while on page 2 would otherwise strand the reader on an empty list. */
  test('changing a filter returns to the first page @storyboard', async ({
    page,
  }) => {
    await page.goto('/discovery?page=1');
    await expect(page.getByText(/Page 2 of/)).toBeVisible();

    await page.getByRole('button', { name: /^PUBLICATION \(/ }).click();

    await expect(page).not.toHaveURL(/page=1/);
  });

  /** Paging replaces the whole list, so focus moves to the heading that describes it. */
  test('paging moves focus to the results heading @storyboard', async ({
    page,
  }) => {
    await page
      .getByRole('navigation', { name: 'Search results pages' })
      .getByRole('button', { name: 'Next' })
      .click();

    await expect(page.locator('#discovery-results-heading')).toBeFocused();
  });
});

test.describe('program facet selection', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);
  });

  /**
   * No program is applied unless the reader asks for one.
   *
   * Three programs used to be selected implicitly whenever the URL carried no `program` parameter,
   * which quietly excluded every LEHD object -- the publications, the methodology report and the
   * research project -- from the first page a visitor sees.
   */
  test('no program is selected by default @storyboard', async ({ page }) => {
    await page.goto('/discovery');

    for (const program of [
      'TIGER LINE (1)',
      'LODES (1)',
      'ACS (1)',
      'SAIPE (1)',
    ]) {
      await expect(page.getByRole('button', { name: program })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    }

    await expect(page).not.toHaveURL(/program=/);
  });

  test('a program can be added to and removed from the selection @storyboard', async ({
    page,
  }) => {
    await page.goto('/discovery');
    const lodes = page.getByRole('button', { name: 'LODES (1)' });

    await lodes.click();
    await expect(lodes).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/program=LODES/);

    await lodes.click();
    await expect(lodes).toHaveAttribute('aria-pressed', 'false');
    await expect(page).not.toHaveURL(/program=/);
  });

  /** Unselected programs stay visible with their unfiltered counts, so another can always be added. */
  test('a second program can be added to an existing selection @storyboard', async ({
    page,
  }) => {
    await page.goto('/discovery?program=LODES');

    await page.getByRole('button', { name: 'SAIPE (1)' }).click();

    await expect(
      page.getByRole('button', { name: 'SAIPE (1)' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page.getByRole('button', { name: 'LODES (1)' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/program=LODES/);
    await expect(page).toHaveURL(/program=SAIPE/);
  });

  /** The geospatial trio is a shortcut the reader chooses, not a filter applied on their behalf. */
  test('the geospatial shortcut selects the three programs and clears them again @storyboard', async ({
    page,
  }) => {
    await page.goto('/discovery');

    const shortcut = page.getByRole('button', {
      name: /the three geospatial programs/,
    });
    await shortcut.click();

    for (const program of ['TIGER LINE (1)', 'LODES (1)', 'ACS (1)']) {
      await expect(page.getByRole('button', { name: program })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    }
    await expect(
      page.getByRole('button', { name: 'SAIPE (1)' }),
    ).toHaveAttribute('aria-pressed', 'false');

    await page
      .getByRole('button', { name: /the three geospatial programs/ })
      .click();

    await expect(
      page.getByRole('button', { name: 'TIGER LINE (1)' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });
});
