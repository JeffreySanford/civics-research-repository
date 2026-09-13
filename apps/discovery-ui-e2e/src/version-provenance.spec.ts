import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { axeEngineeringTags } from './support/axe-tags';
import { mockRepositoryApi } from './support/repository-api-mocks';
import { waitForStablePage } from './support/wait-for-stable-page';

const checksum =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const observedCurrentOnly = {
  researchObjectId: 'tiger-line-north-dakota-2025',
  status: 'OBSERVED_CURRENT_ONLY',
  note: 'Only the current repository/source record has been observed; earlier or later version history is not established.',
  versions: [
    {
      id: 'tiger-line-north-dakota-2025',
      label: '2025 TIGER/Line - Census Tracts - North Dakota',
      current: true,
      versionLabel: 'TIGER2025',
      versionDate: '2025-09-22',
      releasedOn: '2025-09-23',
      sourceUrl:
        'https://www2.census.gov/geo/tiger/TIGER2025/TRACT/tl_2025_38_tract.zip',
      sourceSha256: checksum,
      capturedAt: '2026-09-12T18:45:00-05:00',
      isVersionOf: 'tiger-line-north-dakota',
      changeNote:
        'Retained repository capture used for provenance UI evidence.',
    },
  ],
};

const historyAvailable = {
  researchObjectId: 'tiger-line-north-dakota-2025',
  status: 'HISTORY_AVAILABLE',
  note: 'Multiple repository versions have been observed in DSpace; lineage reflects DSpace-native version history.',
  versions: [
    {
      id: 'dspace-version:102',
      label: '2025 TIGER/Line - Census Tracts - North Dakota',
      current: true,
      versionLabel: 'Repository version 2',
      versionDate: '2026-09-13',
      releasedOn: '2025-09-23',
      sourceUrl:
        'https://www2.census.gov/geo/tiger/TIGER2025/TRACT/tl_2025_38_tract.zip',
      isVersionOf: 'tiger-line-north-dakota-2025',
      supersedes: 'dspace-version:101',
      changeNote: 'Phase C observed DSpace lineage proof',
    },
    {
      id: 'dspace-version:101',
      label: '2025 TIGER/Line - Census Tracts - North Dakota',
      current: false,
      versionLabel: 'Repository version 1',
      versionDate: '2026-08-13',
      releasedOn: '2025-09-23',
      sourceUrl:
        'https://www2.census.gov/geo/tiger/TIGER2025/TRACT/tl_2025_38_tract.zip',
      isVersionOf: 'tiger-line-north-dakota-2025',
    },
  ],
};

test.describe('artifact version provenance', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);

    // Registered after the shared catalog on purpose: Playwright gives the newest matching route
    // first chance to handle the request. This isolates provenance-rich evidence without making
    // every unrelated repository fixture pretend it has checksum/capture facts.
    await page.route('**/api/research/*/versions', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        json: observedCurrentOnly,
      });
    });
  });

  test('renders authority, fixity and capture evidence without inventing broader history @wcag @section508', async ({
    page,
  }) => {
    await page.goto('/datasets/tiger-line-north-dakota-2025');
    await expect(
      page.getByRole('heading', {
        name: '2025 TIGER/Line - Census Tracts - North Dakota',
      }),
    ).toBeVisible();

    await page.getByRole('tab', { name: 'Versions' }).click();
    await expect(
      page.getByRole('heading', { name: 'Versions and provenance' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Authority and evidence trail' }),
    ).toBeVisible();
    await expect(
      page.getByText('DSpace curated repository record'),
    ).toBeVisible();
    await expect(
      page.getByText(
        'Derived projections only; Solr/OpenSearch are not authority.',
      ),
    ).toBeVisible();
    await expect(
      page.getByText('Current observed record', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('TIGER2025')).toBeVisible();
    await expect(page.getByText(checksum)).toBeVisible();
    await expect(page.getByText('tiger-line-north-dakota')).toBeVisible();
    await expect(
      page.getByText(
        'Retained repository capture used for provenance UI evidence.',
      ),
    ).toBeVisible();
    await expect(page.getByText('What this record proves')).toBeVisible();
    await expect(
      page.getByText(/Established by the recorded SHA-256 digest/),
    ).toBeVisible();
    await expect(
      page.getByText(/Established by an actual retained observation timestamp/),
    ).toBeVisible();
    await expect(
      page.getByText(
        /current-record evidence does not prove earlier or later versions/,
      ),
    ).toBeVisible();
    await expect(page.getByText('TIGER_LINE 2024')).toHaveCount(0);

    await waitForStablePage(page);
    const results = await new AxeBuilder({ page })
      .withTags(axeEngineeringTags)
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('states missing fixity and capture evidence instead of implying proof @wcag @section508', async ({
    page,
  }) => {
    await page.route('**/api/research/*/versions', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          ...observedCurrentOnly,
          versions: [
            {
              id: 'tiger-line-north-dakota-2025',
              label: '2025 TIGER/Line - Census Tracts - North Dakota',
              current: true,
              versionLabel: 'TIGER2025',
              sourceUrl:
                'https://www2.census.gov/geo/tiger/TIGER2025/TRACT/tl_2025_38_tract.zip',
            },
          ],
        },
      });
    });

    await page.goto('/datasets/tiger-line-north-dakota-2025');
    await page.getByRole('tab', { name: 'Versions' }).click();

    await expect(
      page.getByText(/Not established; no source digest is recorded/),
    ).toBeVisible();
    await expect(
      page.getByText(/sync time is not substituted for capture evidence/),
    ).toBeVisible();
    await expect(page.getByText(checksum)).toHaveCount(0);

    await waitForStablePage(page);
    const results = await new AxeBuilder({ page })
      .withTags(axeEngineeringTags)
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('renders observed DSpace-native current and prior lineage with keyboard semantics @wcag @section508', async ({
    page,
  }) => {
    await page.route('**/api/research/*/versions', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        json: historyAvailable,
      });
    });

    await page.goto('/datasets/tiger-line-north-dakota-2025');
    const versionsTab = page.getByRole('tab', { name: 'Versions' });
    await versionsTab.focus();
    await expect(versionsTab).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(
      page.getByRole('heading', { name: 'Versions and provenance' }),
    ).toBeVisible();
    await expect(
      page.getByText('Observed multi-version lineage'),
    ).toBeVisible();
    await expect(
      page.getByText('DSpace native item version history'),
    ).toBeVisible();
    await expect(
      page.getByText('Current repository version', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Repository version 2')).toBeVisible();
    await expect(page.getByText('Repository version 1')).toBeVisible();
    await expect(page.getByText('dspace-version:101')).toBeVisible();
    await expect(
      page.getByText('Phase C observed DSpace lineage proof'),
    ).toBeVisible();
    await expect(
      page.getByText(
        /Prior repository version is established by the observed DSpace version history/,
      ),
    ).toBeVisible();
    await expect(
      page.getAllByText(
        /Established from observed DSpace-native version-lineage records/,
      ),
    ).toHaveCount(2);
    await expect(page.getByText('TIGER_LINE 2024')).toHaveCount(0);

    await waitForStablePage(page);
    const results = await new AxeBuilder({ page })
      .withTags(axeEngineeringTags)
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
