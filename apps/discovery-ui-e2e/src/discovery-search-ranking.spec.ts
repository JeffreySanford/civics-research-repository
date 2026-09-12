import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { axeEngineeringTags } from './support/axe-tags';
import { mockRepositoryApi } from './support/repository-api-mocks';

async function mockRankingEvidence(page: Page): Promise<void> {
  await page.route('**/api/search/cursor**', async (route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get('q')?.trim() ?? '';
    const ranked = query.length > 0;
    const results = [
      {
        id: 'north-dakota-migration',
        title: ranked
          ? 'Migration Flows for North Dakota'
          : 'Repository browse record',
        contentType: 'DATASET',
        program: 'ACS',
        publisher: 'U.S. Census Bureau',
        summary: 'Migration research metadata for North Dakota.',
        geography: 'North Dakota',
        sourceUrl: 'https://www.census.gov/',
        accessLevel: 'PUBLIC',
        sourceSystem: 'DSPACE',
        origin: 'CURATED',
        ...(ranked
          ? {
              relevance: {
                rawScore: 10,
                normalizedScore: 1,
                band: 'STRONG',
              },
              matchEvidence: [
                {
                  field: 'TITLE',
                  label: 'Title',
                  matchedTerms: ['Migration'],
                },
                {
                  field: 'GEOGRAPHY',
                  label: 'Geography',
                  matchedTerms: ['North Dakota'],
                },
              ],
            }
          : {}),
      },
    ];

    await route.fulfill({
      contentType: 'application/json',
      json: {
        search: {
          resultSource: 'REPOSITORY',
          query,
          page: 0,
          pageSize: 25,
          totalResults: results.length,
          results,
          facets: [],
          ...(ranked
            ? {
                relevanceModel: {
                  engine: 'SOLR',
                  normalization: 'SOLR_MAX_SCORE_RATIO_V1',
                  calibrated: false,
                },
              }
            : {}),
        },
        nextCursor: null,
      },
    });
  });
}

test.describe('desktop search ranking presentation', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);
    await mockRankingEvidence(page);
  });

  test('uses shared rank, relevance and explainability semantics for a query @wcag @section508', async ({
    page,
  }) => {
    await page.goto('/discovery?q=North%20Dakota%20migration');

    await expect(page.getByText('Top ranked')).toBeVisible();
    await expect(page.getByText('Rank 1', { exact: true })).toBeVisible();
    await expect(page.getByText('Strong match')).toBeVisible();
    await expect(
      page.getByText('Match labels are query-relative search evidence'),
    ).toBeVisible();
    await expect(page.getByText('100%')).toHaveCount(0);

    const explainabilityTrigger = page.getByRole('button', {
      name: 'Why this result matched: Migration Flows for North Dakota',
    });
    await expect(explainabilityTrigger).toBeVisible();
    await explainabilityTrigger.click();

    const dialog = page.getByRole('dialog', { name: 'Why this matched' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('North Dakota migration');
    await expect(dialog).toContainText('Rank 1');
    await expect(dialog).toContainText('Strong');
    await expect(dialog).toContainText('Title');
    await expect(dialog).toContainText('Migration');
    await expect(dialog).toContainText('Geography');
    await expect(dialog).toContainText('North Dakota');
    await expect(dialog).toContainText('not calibrated');

    const results = await new AxeBuilder({ page })
      .withTags(axeEngineeringTags)
      .analyze();
    expect(results.violations).toEqual([]);

    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toBeHidden();
    await expect(explainabilityTrigger).toBeFocused();
  });

  test('does not call an empty repository browse ranked or relevant @wcag @section508', async ({
    page,
  }) => {
    await page.goto('/discovery');

    await expect(page.locator('.search-rank-badge')).toHaveCount(0);
    await expect(page.locator('.relevance-badge')).toHaveCount(0);
    await expect(page.locator('.results-relevance-note')).toHaveCount(0);
    await expect(page.locator('lib-search-explainability-dialog')).toHaveCount(
      0,
    );
  });
});
