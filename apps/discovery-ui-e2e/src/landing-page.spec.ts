import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { axeEngineeringTags } from './support/axe-tags';
import { mockRepositoryApi } from './support/repository-api-mocks';
import { waitForStablePage } from './support/wait-for-stable-page';

const heading = 'Discover, connect, and map public research at federal scale';

test.describe('landing page release evidence', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);
  });

  test('presents the current platform and primary research paths @wcag @section508', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { level: 1, name: heading }),
    ).toBeVisible();
    await waitForStablePage(page);

    await expect(
      page.getByRole('heading', { name: '1,000,181 searchable records' }),
    ).toBeVisible();
    await expect(
      page.getByText('500K Data.gov + 500K DOE OSTI'),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Search the research corpus' }),
    ).toHaveAttribute('href', '/discovery');
    await expect(
      page.getByRole('link', { name: 'Explore research maps' }),
    ).toHaveAttribute('href', '/maps');
    await expect(
      page.getByRole('link', { name: 'Open Evidence →' }),
    ).toHaveAttribute('href', '/evidence');

    const results = await new AxeBuilder({ page })
      .withTags(axeEngineeringTags)
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('primary landing actions are keyboard operable @wcag @section508', async ({
    page,
  }) => {
    await page.goto('/');
    const search = page.getByRole('link', {
      name: 'Search the research corpus',
    });

    await search.focus();
    await expect(search).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(
      page.getByRole('heading', { name: 'Find research objects' }),
    ).toBeVisible();
  });

  test('landing page reflows at 320 CSS pixels without horizontal scrolling @wcag @section508', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/');
    await expect(
      page.getByRole('heading', { level: 1, name: heading }),
    ).toBeVisible();
    await waitForStablePage(page);

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
  });
});
