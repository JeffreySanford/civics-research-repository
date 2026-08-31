import { expect, test } from '@playwright/test';
import { mockRepositoryApi } from './support/repository-api-mocks';

const sha = 'c'.repeat(64);

const composition = {
  compositionVersion: 'federated-composition/v1',
  mode: 'COMPOSITE_SNAPSHOT',
  corpusProfile: 'FEDERATED_1M',
  federatedRecordCount: 1_000_000,
  compositionSha256: sha,
  capturedAt: '2026-08-31T18:30:00Z',
  sources: [
    {
      sourceSystem: 'DATA_GOV',
      requestedRecordCount: 500_000,
      snapshotId: `DATA_GOV:${'a'.repeat(64)}`,
      runId: 'data-run-1',
      runAdapterVersion: 'data-gov-catalog-v4-v2',
      recordAdapterVersions: ['data-gov-catalog-v4-v2'],
      retainedRecordCount: 500_000,
      sha256: 'a'.repeat(64),
      snapshotCapturedAt: '2026-08-31T18:00:00Z',
    },
    {
      sourceSystem: 'DOE_OSTI',
      requestedRecordCount: 500_000,
      snapshotId: `DOE_OSTI:${'b'.repeat(64)}`,
      runId: 'osti-run-1',
      runAdapterVersion: 'doe-osti-v1',
      recordAdapterVersions: ['doe-osti-v1'],
      retainedRecordCount: 500_000,
      sha256: 'b'.repeat(64),
      snapshotCapturedAt: '2026-08-31T18:05:00Z',
    },
  ],
};

const storageOverview = {
  activeProfile: 'CURATED_DEMO',
  profiles: [
    {
      profile: 'CURATED_DEMO',
      label: 'Curated demo',
      active: true,
    },
    {
      profile: 'FEDERATED_1M',
      label: 'Federated 1M',
      active: false,
      targetFederatedRecordCount: 1_000_000,
    },
  ],
  history: [],
};

test.describe('Admin composite corpus evidence', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);
    await page.route(`**/api/admin/corpus/storage`, async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        json: storageOverview,
      });
    });
  });

  test('shows source-level provenance for a captured mixed-source identity @storyboard @comparison @wcag @section508', async ({
    page,
  }) => {
    await page.route(
      `**/api/admin/federation/compositions**`,
      async (route) => {
        const url = new URL(route.request().url());
        expect(url.searchParams.get('corpusProfile')).toBe('FEDERATED_1M');
        expect(url.searchParams.get('limit')).toBe('20');
        await route.fulfill({
          contentType: 'application/json',
          json: [composition],
        });
      },
    );

    await page.goto('/admin/sync');

    await expect(
      page.getByRole('heading', { name: 'Composite corpus identity' }),
    ).toBeVisible();
    await expect(page.getByText('1,000,000 federated records')).toBeVisible();
    await expect(page.getByText('Data.gov', { exact: true })).toBeVisible();
    await expect(page.getByText('DOE OSTI', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Exact quota' }),
    ).toBeVisible();
    await expect(
      page.getByRole('cell', { name: '500,000' }).first(),
    ).toBeVisible();
    await expect(
      page.getByText(
        /Projection linkage to compositionSha256 belongs to the next delivery slice/,
      ),
    ).toBeVisible();
  });

  test('does not imply evidence exists before bounded snapshots are composed @storyboard @comparison', async ({
    page,
  }) => {
    await page.route(
      `**/api/admin/federation/compositions**`,
      async (route) => {
        await route.fulfill({ contentType: 'application/json', json: [] });
      },
    );

    await page.goto('/admin/sync');

    await expect(
      page.getByText('No composite corpus evidence captured yet.'),
    ).toBeVisible();
    await expect(
      page.getByText(/500,000-record Data.gov bounded snapshot/),
    ).toBeVisible();
    await expect(
      page.getByText(/500,000-record DOE OSTI bounded snapshot/),
    ).toBeVisible();
  });
});
