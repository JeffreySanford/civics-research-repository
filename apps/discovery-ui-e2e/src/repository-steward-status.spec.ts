import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { axeEngineeringTags } from './support/axe-tags';
import { failRepositoryApi } from './support/repository-api-mocks-base';
import { mockRepositoryApi } from './support/repository-api-mocks';
import { mockSearchComparisonApi } from './support/search-comparison-mocks';
import { waitForStablePage } from './support/wait-for-stable-page';

async function mockCorpusStorage(page: Parameters<typeof mockRepositoryApi>[0]) {
  await page.route('**/api/admin/corpus/storage', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        activeProfile: 'FEDERATED_1M',
        profiles: [
          {
            profile: 'FEDERATED_1M',
            label: 'Federated 1M',
            active: true,
            targetFederatedRecordCount: 1_000_000,
          },
        ],
        history: [
          {
            profile: 'FEDERATED_1M',
            topology: 'COMPOSE',
            databaseBytes: 1_250_000_000,
            searchIndexBytes: 2_100_000_000,
            archiveBytes: 540_000_000,
            capturedAt: '2026-09-12T15:00:00Z',
          },
        ],
      },
    });
  });
}

test.describe('Repository steward status', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);
    await mockSearchComparisonApi(page);
    await mockCorpusStorage(page);
  });

  test('assembles a read-only operational view from existing typed APIs @storyboard', async ({
    page,
  }) => {
    await page.goto('/steward');
    await waitForStablePage(page);

    await expect(
      page.getByRole('heading', { name: 'Read-only repository status' }),
    ).toBeVisible();

    const corpusStatus = page.getByRole('region', {
      name: 'Active profile and retained storage evidence',
    });
    await expect(
      corpusStatus.getByText('FEDERATED_1M', { exact: true }),
    ).toBeVisible();

    await expect(page.getByText('Projection parity verified.')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'DSpace availability' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Measured source inventory' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Recent metadata sync history' }),
    ).toBeVisible();
    await expect(page.getByText('No synchronization jobs are recorded.')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Retained engineering evidence' }),
    ).toBeVisible();

    await expect(page.getByRole('button')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Admin Sync' })).toBeVisible();
  });

  test('keeps a degraded source section explicit without collapsing healthy evidence', async ({
    page,
  }) => {
    await failRepositoryApi(page, '**/api/admin/sources/inventory');

    await page.goto('/steward');
    await waitForStablePage(page);

    await expect(
      page.getByText('Source inventory is unavailable from the repository API.'),
    ).toBeVisible();
    await expect(page.getByText('Projection parity verified.')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'DSpace availability' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Retained engineering evidence' }),
    ).toBeVisible();
  });

  test('contains wide status tables inside the page at 320px with clean axe evidence @wcag @section508', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/steward');
    await waitForStablePage(page);

    const documentOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(documentOverflow).toBeLessThanOrEqual(1);

    await expect(
      page.getByRole('heading', { name: 'Read-only repository status' }),
    ).toBeVisible();
    await expect(page.getByText('Projection parity verified.')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(axeEngineeringTags)
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
