import { expect, test } from '@playwright/test';
import { mockRepositoryApi } from './support/repository-api-mocks';

const measurement = {
  id: 'measurement-1',
  profile: 'CURATED_DEMO',
  topology: 'DOCKER_COMPOSE',
  activeProjectionCount: 181,
  retainedFederatedCount: 0,
  projectionId: 'a'.repeat(64),
  applicationPostgresBytes: 12_000,
  dspaceStoredBytes: 34_000,
  solrIndexBytes: 56_000,
  totalMeasuredLocalBytes: 102_000,
  capturedAt: '2026-08-29T23:30:00Z',
};

test.describe('Admin Sync corpus storage evidence', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);

    await page.route(`**/api/admin/corpus/storage`, async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          activeProfile: 'CURATED_DEMO',
          profiles: [
            {
              profile: 'CURATED_DEMO',
              label: 'Curated demo',
              active: true,
              latestMeasurement: measurement,
            },
            {
              profile: 'FEDERATED_10K',
              label: 'Federated 10K',
              active: false,
              targetFederatedRecordCount: 10_000,
            },
            {
              profile: 'FEDERATED_100K',
              label: 'Federated 100K',
              active: false,
              targetFederatedRecordCount: 100_000,
            },
            {
              profile: 'FEDERATED_1M',
              label: 'Federated 1M',
              active: false,
              targetFederatedRecordCount: 1_000_000,
            },
            {
              profile: 'FULL',
              label: 'Full source bounds',
              active: false,
            },
          ],
          history: [measurement],
        },
      });
    });
  });

  test('views planned corpus scale without pretending it is active @storyboard @comparison', async ({
    page,
  }) => {
    await page.goto('/admin/sync');

    await expect(
      page.getByRole('heading', { name: 'Corpus scale & local storage' }),
    ).toBeVisible();
    await expect(page.getByText('Active search profile')).toBeVisible();
    await expect(
      page.getByText('Curated demo', { exact: true }).first(),
    ).toBeVisible();

    await page.getByLabel('View corpus profile').click();
    await page.getByRole('option', { name: 'Federated 1M' }).click();

    await expect(page.getByText('1,000,000')).toBeVisible();
    await expect(page.getByText('Not measured yet')).toBeVisible();
    await expect(
      page.getByText('Viewing this profile does not activate it'),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Capture current footprint' }),
    ).toBeVisible();
  });
});
