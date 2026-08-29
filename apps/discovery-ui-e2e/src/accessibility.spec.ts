import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockRepositoryApi } from './support/repository-api-mocks';
import { mockSearchComparisonApi } from './support/search-comparison-mocks';
import { waitForStablePage } from './support/wait-for-stable-page';

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

test.describe('accessibility evidence', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);
    await mockSearchComparisonApi(page);
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
});
