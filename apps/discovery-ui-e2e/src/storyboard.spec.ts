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
      page.getByRole('heading', { name: 'WCAG and Section 508 status' }),
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

    await page.getByRole('link', { name: 'Dataset detail' }).first().focus();
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
    await page.getByRole('link', { name: 'Dataset detail' }).first().click();

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

  test('map storyboard can switch Census area while retaining USGS overlay @storyboard', async ({
    page,
  }) => {
    await page.goto('/maps?area=California');

    await page.locator('select option').first().waitFor({ state: 'attached' });
    await expect(page.locator('select option')).toHaveCount(3);
    await expect(page.getByLabel('Census area')).toHaveValue('California');
    await expect(page.getByText('California TIGER/Line preview')).toBeVisible();
    await expect(
      page.getByText('LODES workplace flow sample', { exact: true }),
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
    await page.goto('/maps');

    await expect(
      page.getByText('North Dakota TIGER/Line preview'),
    ).toBeVisible();
    await expect(page.getByText('USGS event overlay')).toBeVisible();
    await expect(
      page.getByText('USGS Earthquake Catalog GeoJSON fallback fixture'),
    ).toBeVisible();
    await expect(
      page.getByText('LODES workplace flow sample', { exact: true }),
    ).toBeVisible();

    await page.getByLabel('TIGER/Line boundary').uncheck();
    await expect(page.getByText('North Dakota TIGER/Line preview')).toHaveCount(
      0,
    );
    await expect(
      page.getByText('2025 TIGER/Line Census area preview'),
    ).toHaveCount(0);

    await page.getByLabel('USGS earthquake overlay').uncheck();
    await expect(page.getByText('USGS event overlay')).toHaveCount(0);
    await expect(page).toHaveURL(/earthquakes=off/);
    await expect(
      page.getByText('USGS Earthquake Catalog GeoJSON fallback fixture'),
    ).toHaveCount(0);
    await expect(page.getByText('Western North Dakota')).toHaveCount(0);

    await page.getByLabel('TIGER/Line boundary').check();
    await page.getByLabel('USGS earthquake overlay').check();
    await expect(page).not.toHaveURL(/tiger=off/);
    await expect(page).not.toHaveURL(/earthquakes=off/);

    await expect(
      page.getByText('North Dakota TIGER/Line preview'),
    ).toBeVisible();
    await expect(page.getByText('USGS event overlay')).toBeVisible();
    await expect(page.getByText('Western North Dakota')).toBeVisible();
  });

  test('map layer controls are keyboard operable @storyboard', async ({
    page,
  }) => {
    await page.goto('/maps?tiger=off&earthquakes=off');

    await expect(page.getByLabel('TIGER/Line boundary')).not.toBeChecked();
    await expect(page.getByLabel('USGS earthquake overlay')).not.toBeChecked();
    await expect(page.getByText('North Dakota TIGER/Line preview')).toHaveCount(
      0,
    );
    await expect(page.getByText('USGS event overlay')).toHaveCount(0);

    await page.getByLabel('TIGER/Line boundary').focus();
    await page.keyboard.press('Space');
    await expect(
      page.getByText('North Dakota TIGER/Line preview'),
    ).toBeVisible();
    await expect(page).not.toHaveURL(/tiger=off/);

    await page.getByLabel('USGS earthquake overlay').focus();
    await page.keyboard.press('Space');
    await expect(page.getByText('USGS event overlay')).toBeVisible();
    await expect(page.getByText('Western North Dakota')).toBeVisible();
    await expect(page).not.toHaveURL(/earthquakes=off/);
  });

  test('map overlay stale and error states keep Census layers visible @storyboard', async ({
    page,
  }) => {
    await page.goto('/maps?overlay=stale');

    await expect(
      page.getByText('USGS overlay data may be stale').first(),
    ).toBeVisible();
    await expect(
      page.getByText('North Dakota TIGER/Line preview'),
    ).toBeVisible();
    await expect(
      page.getByText('LODES workplace flow sample', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Stale', { exact: true })).toBeVisible();

    await page.goto('/maps?overlay=error');

    await expect(
      page.getByText('USGS earthquake overlay unavailable').first(),
    ).toBeVisible();
    await expect(
      page.getByText('North Dakota TIGER/Line preview'),
    ).toBeVisible();
    await expect(
      page.getByText('LODES workplace flow sample', { exact: true }),
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
    await page.goto('/maps');
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
    await page.goto('/maps');

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
    await page.goto('/maps?feature=demo-eastern-nd');

    await expect(
      page.getByRole('button', { name: /Eastern North Dakota/ }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(/Selected Eastern North Dakota/)).toBeVisible();
  });

  test('clearing selection restores the empty announcement @storyboard', async ({
    page,
  }) => {
    await page.goto('/maps?feature=demo-eastern-nd');

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
    await page.goto('/maps?feature=demo-eastern-nd');
    await expect(page.getByText(/Selected Eastern North Dakota/)).toBeVisible();

    await page.getByLabel('USGS earthquake overlay').uncheck();

    await expect(page.getByText('No map feature selected.')).toBeVisible();
  });
});

/**
 * The program facet is multi-select with defaults. Selecting one program must not hide the others,
 * or the selection becomes a one-way door.
 */
test.describe('program facet selection', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);
  });

  test('the three demo programs are selected by default @storyboard', async ({
    page,
  }) => {
    await page.goto('/discovery');

    for (const program of ['TIGER LINE (1)', 'LODES (1)', 'ACS (1)']) {
      await expect(page.getByRole('button', { name: program })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    }

    await expect(
      page.getByRole('button', { name: 'SAIPE (1)' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  test('a program can be removed from and added back to the selection @storyboard', async ({
    page,
  }) => {
    await page.goto('/discovery');
    const lodes = page.getByRole('button', { name: 'LODES (1)' });

    await lodes.click();
    await expect(lodes).toHaveAttribute('aria-pressed', 'false');

    await lodes.click();
    await expect(lodes).toHaveAttribute('aria-pressed', 'true');
  });

  /** Unselected programs stay visible, so a fourth can always be added. */
  test('an unselected program can be added to the defaults @storyboard', async ({
    page,
  }) => {
    await page.goto('/discovery');

    await page.getByRole('button', { name: 'SAIPE (1)' }).click();

    await expect(
      page.getByRole('button', { name: 'SAIPE (1)' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/program=SAIPE/);
  });

  test('reset restores the default program selection @storyboard', async ({
    page,
  }) => {
    await page.goto('/discovery?program=SAIPE');

    await expect(
      page.getByRole('button', { name: 'SAIPE (1)' }),
    ).toHaveAttribute('aria-pressed', 'true');

    await page
      .getByRole('button', { name: 'Reset to default programs' })
      .click();

    await expect(
      page.getByRole('button', { name: 'TIGER LINE (1)' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page.getByRole('button', { name: 'SAIPE (1)' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });
});
