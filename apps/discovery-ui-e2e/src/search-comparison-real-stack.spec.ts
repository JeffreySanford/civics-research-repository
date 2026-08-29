import { expect, test } from '@playwright/test';

/**
 * Live-stack evidence for the comparison path.
 *
 * Unlike the deterministic Search Lab specs, this file intentionally installs no route mocks.
 * The browser must call the real Angular API client, Spring comparison endpoint, Solr discovery
 * core and OpenSearch comparison index. CI is responsible for starting those services and
 * rebuilding the shared fixture-backed projection before this test runs.
 */
test.describe('Search Lab real stack', () => {
  test('runs one browser request through Spring, Solr and OpenSearch @realstack', async ({
    page,
  }) => {
    await page.goto('/search-lab');

    await expect(
      page.getByRole('heading', { name: 'Compare Solr and OpenSearch' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Run both engines' }).click();

    await expect(page.getByText('Projection parity verified.')).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByRole('heading', { name: 'Solr', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'OpenSearch', exact: true }),
    ).toBeVisible();

    const projectionSection = page.getByRole('heading', {
      name: 'Same input before engine differences',
    });
    await expect(projectionSection).toBeVisible();
    await expect(page.locator('.projection-id code')).toHaveText(
      /[0-9a-f]{64}/,
    );

    const solrCard = page.locator('article').filter({
      has: page.getByRole('heading', { name: 'Solr', exact: true }),
    });
    const openSearchCard = page.locator('article').filter({
      has: page.getByRole('heading', { name: 'OpenSearch', exact: true }),
    });

    await expect(solrCard.getByText('Reachable')).toBeVisible();
    await expect(openSearchCard.getByText('Reachable')).toBeVisible();
    await expect(
      solrCard.getByText('discovery', { exact: true }),
    ).toBeVisible();
    await expect(
      openSearchCard.getByText('discovery-comparison', { exact: true }),
    ).toBeVisible();

    // The smoke test verifies the live infrastructure path, not relative performance.
    await expect(
      page.getByText('not a production performance claim'),
    ).toBeVisible();
  });
});
