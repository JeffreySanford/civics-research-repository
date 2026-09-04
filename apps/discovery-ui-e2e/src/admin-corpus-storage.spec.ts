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

const hundredKMeasurement = {
  ...measurement,
  id: 'measurement-100k',
  profile: 'FEDERATED_100K',
  activeProjectionCount: 100_181,
  retainedFederatedCount: 100_000,
  projectionId: 'c'.repeat(64),
  totalMeasuredLocalBytes: 3_200_000,
  capturedAt: '2026-08-31T00:45:00Z',
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
    let scaleStarted = false;
    let scalePolls = 0;
    let scaleCompleted = false;

    await page.route(`**/api/admin/corpus/storage`, async (route) => {
      const response = scaleCompleted
        ? {
            ...overview,
            activeProfile: 'FEDERATED_100K',
            profiles: overview.profiles.map((profile) => ({
              ...profile,
              active: profile.profile === 'FEDERATED_100K',
              latestMeasurement:
                profile.profile === 'FEDERATED_100K'
                  ? hundredKMeasurement
                  : profile.latestMeasurement,
            })),
            history: [hundredKMeasurement, measurement],
          }
        : overview;
      await route.fulfill({
        contentType: 'application/json',
        json: response,
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
      `**/api/admin/corpus/scale?profile=FEDERATED_100K`,
      async (route) => {
        scaleStarted = true;
        await route.fulfill({
          status: 202,
          contentType: 'application/json',
          json: {
            operationId: 'scale-100k',
            profile: 'FEDERATED_100K',
            phase: 'PREPARING',
            processedDocuments: 0,
            totalDocuments: null,
            percentComplete: 0,
            startedAt: '2026-08-31T00:40:00Z',
            updatedAt: '2026-08-31T00:40:00Z',
            elapsedMs: 1,
            message: 'Preparing deterministic corpus projection.',
          },
        });
      },
    );

    await page.route(`**/api/admin/reindex/progress`, async (route) => {
      if (scaleStarted) {
        scalePolls += 1;
        // The UI has separate render and completion observers. Keep the mocked
        // transient state around for several polling cycles so every browser can
        // observe the same operator-facing progress evidence before completion.
        if (scalePolls <= 8) {
          await route.fulfill({
            contentType: 'application/json',
            json: {
              operationId: 'scale-100k',
              profile: 'FEDERATED_100K',
              phase: 'HARVESTING',
              processedDocuments: 42_000,
              totalDocuments: 100_000,
              percentComplete: 42,
              startedAt: '2026-08-31T00:40:00Z',
              updatedAt: '2026-08-31T00:41:00Z',
              elapsedMs: 60_000,
              documentsPerSecond: 533,
              message:
                'Harvesting and retaining federated metadata from the authoritative source.',
            },
          });
          return;
        }

        scaleCompleted = true;
        await route.fulfill({
          contentType: 'application/json',
          json: {
            operationId: 'scale-100k',
            profile: 'FEDERATED_100K',
            phase: 'COMPLETED',
            processedDocuments: 100_181,
            totalDocuments: 100_181,
            percentComplete: 100,
            startedAt: '2026-08-31T00:40:00Z',
            updatedAt: '2026-08-31T00:45:00Z',
            completedAt: '2026-08-31T00:45:00Z',
            elapsedMs: 300_000,
            documentsPerSecond: 334,
            message:
              'Corpus profile growth, verified projection, and storage evidence capture completed.',
          },
        });
        return;
      }

      await route.fulfill({
        contentType: 'application/json',
        json: {
          operationId: 'activation-1',
          profile: 'FEDERATED_10K',
          phase: 'PROJECTING',
          processedDocuments: 4_000,
          totalDocuments: 10_181,
          percentComplete: 39,
          startedAt: '2026-08-30T21:29:59Z',
          updatedAt: '2026-08-30T21:30:00Z',
          elapsedMs: 1_000,
          documentsPerSecond: 4_000,
          message: 'Building Solr and OpenSearch projections.',
        },
      });
    });

    await page.route(
      `**/api/admin/reindex?profile=FEDERATED_10K`,
      async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 900));
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

    await expect(
      page.getByLabel('Federated 1M').getByText('1,000,000', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Not measured yet')).toBeVisible();
    await expect(
      page.getByText('Selecting a profile does not activate it'),
    ).toBeVisible();
    await expect(page.getByText('Not available yet.')).toBeVisible();
    await expect(
      page.getByText(/the current corpus has\s*10,000/),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Activate Federated 1M' }),
    ).toBeDisabled();
    await expect(
      page.getByRole('button', { name: 'Capture current footprint' }),
    ).toBeVisible();

    const historyFilter = page.getByLabel('Filter historical measurements');
    await expect(historyFilter).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: /Captured/ }),
    ).toBeVisible();
    await expect(page.locator('mat-paginator')).toBeVisible();

    await historyFilter.fill('no-such-profile');
    await expect(
      page.getByText('No historical measurements match the current filter.'),
    ).toBeVisible();
    await historyFilter.fill('');
  });

  test('explicitly activates an already-retained 10K projection with live progress and captures its footprint @storyboard @comparison', async ({
    page,
  }) => {
    await page.goto('/admin/sync');

    await page.getByLabel('View corpus profile').click();
    await page.getByRole('option', { name: 'Federated 10K' }).click();
    await page.getByRole('button', { name: 'Activate Federated 10K' }).click();

    await expect(page.getByText('Loading search indexes')).toBeVisible();
    await expect(page.getByText('4,000 / 10,181 documents')).toBeVisible();
    await expect(page.getByText('39%')).toBeVisible();
    await expect(page.getByText('4,000 docs/s')).toBeVisible();

    await expect(
      page.getByText(
        'Federated 10K activated with 10,181 searchable documents. Storage footprint captured.',
      ),
    ).toBeVisible();
  });

  test('grows and activates the 100K tier through asynchronous guarded progress @storyboard @comparison', async ({
    page,
  }) => {
    await page.goto('/admin/sync');

    await page.getByLabel('View corpus profile').click();
    await page.getByRole('option', { name: 'Federated 100K' }).click();

    await expect(page.getByText('Ready for guarded growth.')).toBeVisible();
    await page
      .getByRole('button', { name: 'Grow & activate Federated 100K' })
      .click();

    await expect(page.getByText('Harvesting Data.gov metadata')).toBeVisible();
    await expect(page.getByText('42,000 / 100,000 records')).toBeVisible();
    await expect(page.getByText('42%')).toBeVisible();
    await expect(page.getByText('533 records/s')).toBeVisible();

    await expect(
      page.getByText(/Federated 100K growth and activation completed/),
    ).toBeVisible();
    await expect(
      page.getByText('Active search profile', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Federated 100K', { exact: true }).first(),
    ).toBeVisible();
  });
});
