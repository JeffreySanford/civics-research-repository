import { expect, test } from '@playwright/test';
import { mockRepositoryApi } from './support/repository-api-mocks';
import { mockSearchComparisonApi } from './support/search-comparison-mocks';

const PROJECTION_ID = 'a'.repeat(64);

test.describe('Admin Sync search projection evidence', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);
    await mockSearchComparisonApi(page);

    // Keep the operational projection fixture consistent with the comparison fixture. The
    // AdminSearchProjectionComponent intentionally refuses to merge a comparison projection ID
    // into an admin state whose normalized source/count differs. Registering this route last
    // overrides the generic three-object admin fixture while leaving the projectionId absent so
    // this scenario also proves the safe metadata fallback from the matching comparison result.
    await page.route(`**/api/admin/reindex`, async (route) => {
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

  test('shows one normalized projection feeding Solr and OpenSearch @storyboard @comparison', async ({
    page,
  }) => {
    await page.goto('/admin/sync');

    await page.getByRole('tab', { name: 'Search projection' }).click();

    await expect(
      page.getByRole('heading', { name: 'Normalize once, project many' }),
    ).toBeVisible();
    await expect(page.getByText('Projection parity verified.')).toBeVisible();

    const projectionId = page.locator('.projection-id-card code');
    await expect(projectionId).toHaveText('aaaaaaaaaaaa…');
    await expect(projectionId).toHaveAttribute('title', PROJECTION_ID);

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
