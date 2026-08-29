import { expect, test } from '@playwright/test';
import { mockRepositoryApi } from './support/repository-api-mocks';
import { mockSearchComparisonApi } from './support/search-comparison-mocks';

test.describe('Evidence search comparison', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);
    await mockSearchComparisonApi(page);
    await page.route('**/api/admin/reindex', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          source: 'REPOSITORY',
          objectCount: 181,
          rebuiltAt: '2026-08-29T17:00:00Z',
        },
      });
    });
  });

  test('separates deterministic, live, performance, and manual evidence @storyboard @comparison', async ({
    page,
  }) => {
    await page.goto('/evidence');
    await page.getByRole('tab', { name: 'Search comparison' }).click();

    await expect(
      page.getByRole('heading', { name: 'Normalize once, project many' }),
    ).toBeVisible();
    await expect(page.getByText('Projection parity verified.')).toBeVisible();

    const table = page.getByRole('table', {
      name: 'Search comparison evidence types and verification boundaries',
    });
    await expect(table).toBeVisible();
    await expect(
      table.getByRole('rowheader', { name: 'Mocked browser comparison' }),
    ).toBeVisible();
    await expect(
      table.getByRole('rowheader', { name: 'Live Solr/OpenSearch smoke' }),
    ).toBeVisible();
    await expect(
      table.getByRole('rowheader', { name: 'Performance distributions' }),
    ).toBeVisible();
    await expect(table.getByText('5 warm-ups / 100 measured')).toBeVisible();
    await expect(
      table.getByText(/Solr QTime \/ OpenSearch took/),
    ).toBeVisible();
    await expect(
      table.getByRole('rowheader', {
        name: 'Keyboard and screen-reader comparison flow',
      }),
    ).toBeVisible();
    await expect(table.getByText('Pending', { exact: true })).toBeVisible();
    await expect(
      page.getByText(/does not synthesize a green build status/),
    ).toBeVisible();
  });
});
