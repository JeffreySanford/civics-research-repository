import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockRepositoryApi } from './support/repository-api-mocks';
import { waitForStablePage } from './support/wait-for-stable-page';

const routes = [
  { path: '/', heading: 'Census geospatial discovery with repository sync' },
  { path: '/discovery', heading: 'Find research objects' },
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
];

test.describe('WCAG reflow and contrast evidence', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);
  });

  /**
   * WCAG 2.1 SC 1.4.10 Reflow: at a 320 CSS pixel viewport width, content must not require
   * horizontal scrolling. A map-heavy page is the most likely place to regress this.
   */
  for (const route of routes) {
    test(`${route.path} reflows to 320px without horizontal scrolling @wcag @section508`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 320, height: 800 });
      await page.goto(route.path);
      await expect(
        page.getByRole('heading', { name: route.heading }),
      ).toBeVisible();
      await waitForStablePage(page);

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));

      expect(
        overflow.scrollWidth,
        `${route.path} overflows its 320px viewport horizontally`,
      ).toBeLessThanOrEqual(overflow.clientWidth);
    });
  }

  /**
   * WCAG 2.1 SC 1.4.4 Resize Text: text must stay readable at 200% zoom. Emulated here by halving
   * the viewport, which is the standard equivalent of doubling text size.
   */
  test('discovery stays operable at 200% zoom @wcag @section508', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 640, height: 512 });
    await page.goto('/discovery');

    await expect(
      page.getByRole('heading', { name: 'Find research objects' }),
    ).toBeVisible();
    await expect(page.getByLabel('Search terms')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'California (3)' }),
    ).toBeEnabled();

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
  });

  /**
   * SC 1.4.3 Contrast is already inside the wcag2aa tag used by the main accessibility sweep, but
   * an isolated run names the failing nodes directly instead of burying them in a mixed report.
   */
  for (const route of routes) {
    test(`${route.path} meets AA color contrast @wcag @section508`, async ({
      page,
    }) => {
      await page.goto(route.path);
      await expect(
        page.getByRole('heading', { name: route.heading }),
      ).toBeVisible();
      await waitForStablePage(page);

      const results = await new AxeBuilder({ page })
        .withRules(['color-contrast'])
        .analyze();

      expect(results.violations).toEqual([]);
    });
  }
});
