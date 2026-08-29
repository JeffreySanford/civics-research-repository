import { expect, test } from '@playwright/test';
import { mockRepositoryApi } from './support/repository-api-mocks';
import { mockSearchComparisonApi } from './support/search-comparison-mocks';

test.describe('Search Lab storyboard', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);
    await mockSearchComparisonApi(page);
  });

  test('shows projection parity and side-by-side engine evidence @storyboard @comparison', async ({
    page,
  }) => {
    await page.goto('/');

    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Search Lab' })
      .click();

    await expect(
      page.getByRole('heading', { name: 'Compare Solr and OpenSearch' }),
    ).toBeVisible();
    await expect(page.getByLabel('Scenario')).toHaveValue('FACETED_SEARCH');

    await page.getByRole('button', { name: 'Run both engines' }).click();

    await expect(page.getByText('Projection parity verified.')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Solr', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'OpenSearch', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('34 ms')).toBeVisible();
    await expect(page.getByText('29 ms')).toBeVisible();
    await expect(page.getByText('local demo measurements')).toBeVisible();
  });

  test('keeps relevance and filtering in the same comparison workflow @storyboard @comparison', async ({
    page,
  }) => {
    await page.goto('/search-lab');

    await page.getByLabel('Scenario').selectOption('FULL_TEXT_RELEVANCE');
    await page.getByLabel('Search terms').fill('North Dakota workforce');
    await page.getByRole('button', { name: 'Run both engines' }).click();
    await expect(page.getByText('Projection parity verified.')).toBeVisible();

    await page.getByLabel('Scenario').selectOption('FILTERING');
    await page.getByLabel('Program').selectOption('LODES');
    await page.getByLabel('Vintage year').fill('2023');
    await page.getByRole('button', { name: 'Run both engines' }).click();

    await expect(page.getByText('Projection parity verified.')).toBeVisible();
    await expect(page).toHaveURL(/\/search-lab$/);
  });
});
