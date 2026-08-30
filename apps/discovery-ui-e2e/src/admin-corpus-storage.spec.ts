import { expect, test } from '@playwright/test';
import { mockRepositoryApi } from './support/repository-api-mocks';

const measurement = {
  id: 'measurement-1',
  profile: 'CURATED_DEMO',
  topology: 'DOCKER_COMPOSE',
  activeProjectionCount: 181,
  retainedFederatedCount: 10_000,
  projectionId: 'a'.repeat(64),
  applicationPostgresBytes: 12_000,
  dspaceStoredBytes: 34_000,
  solrIndexBytes: 56_000,
  totalMeasuredLocalBytes: 102_000,
  capturedAt: '2026-08-29T23:30:00Z',
};

const overview = {
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
};

test.describe('Admin Sync corpus storage evidence', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);

    await page.route(`**/api/admin/corpus/storage`, async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        json: overview,
      });
    });

    await page.route(`**/api/admin/corpus/storage/capture`, async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          ...measurement,
          id: 'measurement-2',
          profile: 'FEDERATED_10K',
          activeProjectionCount: 10_181,
          projectionId: 'b'.repeat(64),
        },
      });
    });

    await page.route(
      `**/api/admin/reindex?profile=FEDERATED_10K`,
      async (route) => {
        await route.fulfill({
          contentType: 'application/json',
          json: {
            source: 'REPOSITORY',
            objectCount: 10_181,
            projectionId: 'b'.repeat(64),
            rebuiltAt: '2026-08-30T21:30:00Z',
          },
        });
      },
    );
  });

  test('views inactive corpus scale without pretending it is active @storyboard @comparison', async ({
    page,
  }) => {
    await page.goto('/admin/sync');

    await expect(
      page.getByRole('heading', { name: 'Corpus scale & local storage' }),
    ).toBeVisible();
    await expect(
      page.getByText('Active search profile', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Curated demo', { exact: true }).first(),
    ).toBeVisible();

    await page.getByLabel('View corpus profile').click();
    await page.getByRole('option', { name: 'Federated 1M' }).click();

    await expect(page.getByText('1,000,000')).toBeVisible();
    await expect(page.getByText('Not measured yet')).toBeVisible();
    await expect(
      page.getByText('Selecting a profile does not activate it'),
    ).toBeVisible();
    await expect(page.getByText('Heavy profile.')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Activate Federated 1M' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Capture current footprint' }),
    ).toBeVisible();
  });

  test('explicitly activates an already-retained 10K projection and captures its footprint @storyboard @comparison', async ({
    page,
  }) => {
    await page.goto('/admin/sync');

    await page.getByLabel('View corpus profile').click();
    await page.getByRole('option', { name: 'Federated 10K' }).click();
    await page.getByRole('button', { name: 'Activate Federated 10K' }).click();

    await expect(
      page.getByText(
        'Federated 10K activated with 10,181 searchable documents. Storage footprint captured.',
      ),
    ).toBeVisible();
  });
});
