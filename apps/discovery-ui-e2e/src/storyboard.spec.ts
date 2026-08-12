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
});
