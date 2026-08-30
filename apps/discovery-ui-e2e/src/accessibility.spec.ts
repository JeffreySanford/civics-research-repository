import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockRepositoryApi } from './support/repository-api-mocks';
import { mockSearchComparisonApi } from './support/search-comparison-mocks';
import { waitForStablePage } from './support/wait-for-stable-page';

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];
const federatedResearchId =
  'REFUQV9HT1Y6aHR0cHM6Ly9jYXRhbG9nLmRhdGEuZ292L2RhdGFzZXQvd29ya2ZvcmNlLWV4YW1wbGU';

test.describe('accessibility evidence', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);
    await mockSearchComparisonApi(page);
    await page.route(`**/api/research/*`, async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          source: 'FEDERATED',
          id: 'DATA_GOV:https://catalog.data.gov/dataset/workforce-example',
          title: 'Workforce Example Metadata',
          program: 'OTHER',
          programName: 'Workforce Research',
          publisher: 'Example Federal Publisher',
          abstractText:
            'Federated metadata retained locally for reproducible discovery.',
          files: [],
          citation: 'Workforce Example Metadata',
          sourceUrl: 'https://catalog.data.gov/dataset/workforce-example',
          relatedResearch: [],
          contentType: 'DATASET',
          origin: 'FEDERATED',
          sourceSystem: 'DATA_GOV',
        },
      });
    });
  });

  for (const route of [
    { path: '/', heading: 'Census geospatial discovery with repository sync' },
    { path: '/discovery', heading: 'Find research objects' },
    {
      path: '/search-lab',
      heading: 'Compare Solr and OpenSearch',
    },
    {
      path: '/datasets/tiger-line-north-dakota-2025',
      heading: '2025 TIGER/Line - Census Tracts - North Dakota',
    },
    {
      path: `/research/${federatedResearchId}`,
      heading: 'Workforce Example Metadata',
    },
    { path: '/maps', heading: 'MapLibre geospatial workspace' },
    { path: '/admin/sync', heading: 'Repository sync' },
    {
      path: '/evidence',
      heading: 'Platform evidence: conformance and data provenance',
    },
  ]) {
    test(`${route.path} has no detectable axe violations @wcag @section508`, async ({
      page,
    }) => {
      await page.goto(route.path);
      await expect(
        page.getByRole('heading', { name: route.heading }),
      ).toBeVisible();
      await waitForStablePage(page);

      const results = await new AxeBuilder({ page })
        .withTags(axeTags)
        .analyze();

      expect(results.violations).toEqual([]);
    });
  }

  test('federated detail discloses external authority without repository-only tabs', async ({
    page,
  }) => {
    await page.goto(`/research/${federatedResearchId}`);

    await expect(
      page.getByText('Federated metadata.', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'View authoritative source' }),
    ).toHaveAttribute(
      'href',
      'https://catalog.data.gov/dataset/workforce-example',
    );
    await expect(page.getByRole('tab', { name: 'Versions' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Map Layers' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Map Preview' })).toHaveCount(0);
  });
});
