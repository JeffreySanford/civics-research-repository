import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockRepositoryApi } from './support/repository-api-mocks';

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

test.describe('accessibility evidence', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);
  });

  for (const route of [
    { path: '/', heading: 'Census geospatial discovery with repository sync' },
    { path: '/discovery', heading: 'Find research objects' },
    { path: '/maps', heading: 'MapLibre geospatial workspace' },
    { path: '/admin/sync', heading: 'Repository sync' },
    { path: '/evidence', heading: 'WCAG and Section 508 status' },
  ]) {
    test(`${route.path} has no detectable axe violations @wcag @section508`, async ({
      page,
    }) => {
      await page.goto(route.path);
      await expect(
        page.getByRole('heading', { name: route.heading }),
      ).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(axeTags)
        .analyze();

      expect(results.violations).toEqual([]);
    });
  }
});
