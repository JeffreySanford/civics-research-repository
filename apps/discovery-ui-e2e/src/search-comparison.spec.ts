import { expect, test } from '@playwright/test';
import { mockRepositoryApi } from './support/repository-api-mocks';
import { mockSearchComparisonApi } from './support/search-comparison-mocks';

async function mockApis(page: Parameters<typeof mockRepositoryApi>[0]) {
  await mockRepositoryApi(page);
  // Registered second so these more-specific routes win over the general **/api/search** fixture.
  await mockSearchComparisonApi(page);
}

test.describe('Search Lab', () => {
  test.beforeEach(async ({ page }) => {
    await mockApis(page);
  });

  test('runs the same normalized query against both engines', async ({ page }) => {
    await page.goto('/search-lab');

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
    await expect(
      page.getByText(
        '2023 LODES Workplace Area Characteristics - North Dakota',
      ),
    ).toHaveCount(2);
  });

  test('supports relevance and filtering scenarios without changing routes', async ({
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
