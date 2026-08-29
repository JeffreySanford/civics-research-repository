import { expect, test } from '@playwright/test';
import {
  failRepositoryApi,
  mockFixtureBackedRepositoryApi,
  mockRepositoryApi,
} from './support/repository-api-mocks';

/**
 * Each page renders an `role="alert"` region when its API call fails, but nothing exercised those
 * paths. A repository demo is judged partly on how it behaves when a backing service is down, so
 * the failure states are storyboard evidence in their own right.
 */
test.describe('repository API failure states', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);
  });

  test('discovery reports a search outage without losing the search form @storyboard', async ({
    page,
  }) => {
    await failRepositoryApi(page, '**/api/search**');
    await page.goto('/discovery');

    await expect(
      page
        .locator('.error-message[role="alert"]')
        .filter({ hasText: 'Search results failed' }),
    ).toBeVisible();
    await expect(page.getByLabel('Search terms')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Find research objects' }),
    ).toBeVisible();
  });

  test('discovery recovers when a later search succeeds @storyboard', async ({
    page,
  }) => {
    await failRepositoryApi(page, '**/api/search**');
    await page.goto('/discovery');

    const inlineSearchError = page
      .locator('.error-message[role="alert"]')
      .filter({ hasText: 'Search results failed' });

    await expect(inlineSearchError).toBeVisible();

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mockRepositoryApi(page);
    await page.getByLabel('Search terms').fill('Texas');
    await page.getByLabel('Search terms').press('Enter');

    await expect(
      page.getByRole('heading', {
        name: '2025 TIGER/Line - Census Tracts - Texas',
      }),
    ).toBeVisible();
    // The inline search error must clear when the successful response lands. The failed request
    // also raises a transient snackbar with the same text; that notification may legitimately
    // remain visible for a little longer and is not the recovery state this assertion verifies.
    await expect(inlineSearchError).toHaveCount(0);
  });

  test('dataset detail reports an outage @storyboard', async ({ page }) => {
    await failRepositoryApi(page, '**/api/datasets/*');
    await page.goto('/datasets/tiger-line-north-dakota-2025');

    // Named, not just "an alert": a page can raise several at once, and asserting on the count of
    // anonymous alerts breaks whenever an unrelated request also fails.
    await expect(
      page.getByRole('alert').filter({ hasText: 'Dataset detail failed' }),
    ).toBeVisible();
  });

  test('admin sync reports a failed sync request @storyboard', async ({
    page,
  }) => {
    await failRepositoryApi(page, '**/api/admin/sync');
    await page.goto('/admin/sync');

    await page.getByRole('button', { name: 'Dry run sync' }).click();

    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: 'Repository sync request failed' }),
    ).toBeVisible();
  });

  /**
   * The map's own USGS outage path is already covered by the `?overlay=error` storyboard check.
   * What is not covered there is the census-boundary request failing, which would leave the map
   * shell with no area list to choose from.
   */
  test('map reports a census boundary outage @storyboard', async ({ page }) => {
    await failRepositoryApi(page, '**/api/maps/census-areas');
    await page.goto('/maps');

    await expect(
      page.getByRole('heading', { name: 'MapLibre geospatial workspace' }),
    ).toBeVisible();
    // Scoped to the workspace: the same failure is also announced in a snackbar, and this test
    // is about the page itself reporting the outage inline rather than only in a transient toast.
    await expect(
      page
        .getByLabel('MapLibre geospatial workspace')
        .getByRole('alert')
        .filter({ hasText: 'Map data failed to load' }),
    ).toBeVisible();
  });
});

/**
 * The API labels every response REPOSITORY or FIXTURE. A user must be able to see that label:
 * presenting generated placeholders as repository content is exactly the failure this disclosure
 * exists to prevent.
 */
test.describe('fixture data disclosure', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);
    await mockFixtureBackedRepositoryApi(page);
  });

  test('discovery discloses fixture-backed results @storyboard', async ({
    page,
  }) => {
    await page.goto('/discovery');

    await expect(page.getByText('Placeholder data.')).toBeVisible();
    await expect(
      page.getByText('generated examples rather than DSpace repository'),
    ).toBeVisible();
  });

  test('dataset detail discloses fixture-backed records @storyboard', async ({
    page,
  }) => {
    await page.goto('/datasets/tiger-line-north-dakota-2025');

    await expect(page.getByText('Placeholder data.')).toBeVisible();
  });

  test('repository-backed results carry no placeholder notice @storyboard', async ({
    page,
  }) => {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mockRepositoryApi(page);
    await page.goto('/discovery');

    await expect(
      page.getByRole('heading', {
        name: '2025 TIGER/Line - Census Tracts - California',
      }),
    ).toBeVisible();
    await expect(page.getByText('Placeholder data.')).toHaveCount(0);
  });
});
