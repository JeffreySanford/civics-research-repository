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

  test('map storyboard can switch Census area while retaining USGS overlay @storyboard', async ({
    page,
  }) => {
    await page.goto('/maps');

    await page.locator('select option').first().waitFor({ state: 'attached' });
    await expect(page.locator('select option')).toHaveCount(3);
    await expect(
      page.getByText('North Dakota TIGER/Line preview'),
    ).toBeVisible();
    await expect(page.getByText('3 loaded')).toBeVisible();

    await page.getByLabel('Census area').selectOption('California');

    await expect(page.getByLabel('Census area')).toHaveValue('California');
    await expect(page.getByText('California TIGER/Line preview')).toBeVisible();
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

    await page.getByLabel('TIGER/Line boundary').uncheck();
    await expect(page.getByText('North Dakota TIGER/Line preview')).toHaveCount(
      0,
    );
    await expect(
      page.getByText('2025 TIGER/Line Census area preview'),
    ).toHaveCount(0);

    await page.getByLabel('USGS earthquake overlay').uncheck();
    await expect(page.getByText('USGS event overlay')).toHaveCount(0);
    await expect(
      page.getByText('USGS Earthquake Catalog GeoJSON fallback fixture'),
    ).toHaveCount(0);
    await expect(page.getByText('Western North Dakota')).toHaveCount(0);

    await page.getByLabel('TIGER/Line boundary').check();
    await page.getByLabel('USGS earthquake overlay').check();

    await expect(
      page.getByText('North Dakota TIGER/Line preview'),
    ).toBeVisible();
    await expect(page.getByText('USGS event overlay')).toBeVisible();
    await expect(page.getByText('Western North Dakota')).toBeVisible();
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
  });
});
