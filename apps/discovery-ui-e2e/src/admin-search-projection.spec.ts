import { expect, test } from '@playwright/test';
import { mockRepositoryApi } from './support/repository-api-mocks';
import { mockSearchComparisonApi } from './support/search-comparison-mocks';

test.describe('Admin Sync search projection evidence', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);
    await mockSearchComparisonApi(page);
  });

  test('shows one normalized projection feeding Solr and OpenSearch @storyboard @comparison', async ({
    page,
  }) => {
    await page.goto('/admin/sync');

    await page.getByRole('tab', { name: 'Search projection' }).click();

    await expect(
      page.getByRole('heading', { name: 'Normalize once, project many' }),
    ).toBeVisible();
    await expect(page.getByText('Projection parity verified.')).toBeVisible();
    await expect(page.getByText('aaaaaaaaaaaa…')).toBeVisible();

    const targets = page.getByRole('region').filter({
      has: page.getByRole('heading', { name: 'Configured search targets' }),
    });

    await expect(
      targets.getByRole('heading', { name: 'Solr', exact: true }),
    ).toBeVisible();
    await expect(targets.getByText('Public discovery')).toBeVisible();
    await expect(targets.getByText('discovery', { exact: true })).toBeVisible();

    await expect(
      targets.getByRole('heading', { name: 'OpenSearch', exact: true }),
    ).toBeVisible();
    await expect(targets.getByText('Comparison target')).toBeVisible();
    await expect(
      targets.getByText('discovery-comparison', { exact: true }),
    ).toBeVisible();

    await expect(page.getByText('not a performance benchmark')).toBeVisible();
  });
});
