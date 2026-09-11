import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const axeTags = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa',
  'best-practice',
];

const result = (
  id: string,
  title: string,
  rawScore: number,
  normalizedScore: number,
  band: 'STRONG' | 'GOOD' | 'MODERATE' | 'WEAK' | 'LOW',
  contentType: 'DATASET' | 'PUBLICATION' = 'DATASET',
) => ({
  id,
  title,
  contentType,
  program: 'OTHER',
  programName: 'Population Mobility',
  publisher: 'U.S. Census Bureau',
  summary: `${title} search evidence.`,
  sourceUrl: `https://example.test/${id}`,
  origin: 'REPOSITORY',
  sourceSystem: 'CENSUS',
  geography: 'North Dakota',
  vintageYear: 2025,
  relevance: { rawScore, normalizedScore, band },
  matchEvidence:
    id === 'strong-match'
      ? [
          { field: 'TITLE', label: 'Title', matchedTerms: ['migration'] },
          {
            field: 'GEOGRAPHY',
            label: 'Geography',
            matchedTerms: ['North Dakota'],
          },
        ]
      : undefined,
});

async function mockCursorSearch(page: Page): Promise<void> {
  await page.route('**/api/search/cursor*', async (route) => {
    const requestUrl = new URL(route.request().url());
    const query = requestUrl.searchParams.get('q')?.trim() ?? '';
    const contentType = requestUrl.searchParams.get('contentType');

    if (!query) {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          search: {
            resultSource: 'REPOSITORY',
            query: '',
            page: 0,
            pageSize: 10,
            totalResults: 644,
            results: [
              {
                id: 'browse-record',
                title: 'TIGER/Line Shapefile, Current, State, North Dakota',
                contentType: 'DATASET',
                program: 'OTHER',
                programName: 'TIGER/Line',
                publisher: 'U.S. Census Bureau',
                summary: 'Repository discovery record.',
                sourceUrl: 'https://example.test/browse-record',
                origin: 'REPOSITORY',
                sourceSystem: 'CENSUS',
                geography: 'North Dakota',
                vintageYear: 2025,
              },
            ],
            facets: [],
          },
          nextCursor: null,
        },
      });
      return;
    }

    const allResults = [
      result(
        'strong-match',
        'Migration Flows for North Dakota',
        10,
        1,
        'STRONG',
      ),
      result(
        'weak-match',
        'North Dakota Geographic Reference File',
        3,
        0.3,
        'WEAK',
        'PUBLICATION',
      ),
    ];
    const results = contentType
      ? allResults.filter((item) => item.contentType === contentType)
      : allResults;

    await route.fulfill({
      contentType: 'application/json',
      json: {
        search: {
          resultSource: 'REPOSITORY',
          query,
          page: 0,
          pageSize: 10,
          totalResults: results.length,
          results,
          facets: [
            {
              field: 'type',
              label: 'Type',
              values: [
                {
                  value: 'DATASET',
                  label: 'Dataset',
                  count: 1,
                  selected: contentType === 'DATASET',
                },
                {
                  value: 'PUBLICATION',
                  label: 'Publication',
                  count: 1,
                  selected: contentType === 'PUBLICATION',
                },
              ],
            },
          ],
          relevanceModel: {
            engine: 'SOLR',
            normalization: 'SOLR_MAX_SCORE_RATIO_V1',
            calibrated: false,
          },
        },
        nextCursor: null,
      },
    });
  });
}

test.describe('mobile relevance and filter evidence', () => {
  test.beforeEach(async ({ page }) => {
    await mockCursorSearch(page);
    await page.goto('/');
  });

  test('shows engine rank and accessible relevance bands at 320px @wcag', async ({
    page,
  }) => {
    const query = 'North Dakota migration';
    await page.locator('#research-query').fill(query);
    await page.getByRole('button', { name: 'Search' }).click();

    await expect(page.getByText(`Results for “${query}”`)).toBeVisible();
    await expect(page.getByText('Rank 1')).toBeVisible();
    await expect(page.getByText('Strong match')).toBeVisible();
    await expect(page.getByText('Rank 2')).toBeVisible();
    await expect(page.getByText('Weak match')).toBeVisible();
    await expect(
      page.getByText('Match labels are query-relative search evidence'),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Result type mix' }),
    ).toBeVisible();
    await expect(page.getByText('1 · 50%').first()).toBeVisible();
    await expect(
      page.getByText('Counts describe all records matching this search'),
    ).toBeVisible();
    await expect(page.getByText('100%')).toHaveCount(0);

    await page.getByText('Why this matched').first().click();
    await expect(page.getByText('migration', { exact: true })).toBeVisible();
    await expect(page.getByText('North Dakota', { exact: true })).toBeVisible();
    await expect(
      page.getByText('do not represent exact score contribution'),
    ).toBeVisible();

    const strongBadge = page.getByLabel(
      'Strong match. Query-relative search match strength.',
    );
    await expect(strongBadge).toBeVisible();

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);

    const accessibility = await new AxeBuilder({ page })
      .withTags(axeTags)
      .analyze();
    expect(accessibility.violations).toEqual([]);
  });

  test('hydrates a shareable URL into the same search and active filter @wcag', async ({
    page,
  }) => {
    await page.goto('/?q=North%20Dakota%20migration&type=DATASET');

    await expect(page.locator('#research-query')).toHaveValue(
      'North Dakota migration',
    );
    await expect(
      page.getByText('Results for “North Dakota migration”'),
    ).toBeVisible();
    await expect(page.locator('.active-filters')).toContainText('Dataset');
    await expect(page.getByText('1 matching records')).toBeVisible();

    const url = new URL(page.url());
    expect(url.searchParams.get('q')).toBe('North Dakota migration');
    expect(url.searchParams.get('type')).toBe('DATASET');

    const accessibility = await new AxeBuilder({ page })
      .withTags(axeTags)
      .analyze();
    expect(accessibility.violations).toEqual([]);
  });

  test('updates filters immediately, preserves them in the URL, and restores focus @wcag', async ({
    page,
  }) => {
    await page.locator('#research-query').fill('North Dakota migration');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByText('2 matching records')).toBeVisible();

    const filterTrigger = page.getByRole('button', { name: 'Filters' });
    await filterTrigger.click();

    const dialog = page.getByRole('dialog', { name: 'Filter results' });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText('reflected in the shareable URL'),
    ).toBeVisible();

    const openAccessibility = await new AxeBuilder({ page })
      .withTags(axeTags)
      .analyze();
    expect(openAccessibility.violations).toEqual([]);

    await dialog.getByRole('button', { name: /Dataset/ }).click();
    await expect(page.getByText('1 matching records')).toBeVisible();
    await expect(page.locator('.active-filters')).toContainText('Dataset');
    await expect
      .poll(() => new URL(page.url()).searchParams.get('type'))
      .toBe('DATASET');
    expect(new URL(page.url()).searchParams.get('q')).toBe(
      'North Dakota migration',
    );

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(filterTrigger).toBeFocused();
  });

  test('keeps an empty repository browse explicitly unscored @wcag', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Search' }).click();

    await expect(
      page.getByText("Browsing the repository's current discovery set."),
    ).toBeVisible();
    await expect(page.locator('.relevance-badge')).toHaveCount(0);
    await expect(page.locator('.results__relevance-note')).toHaveCount(0);
    await expect(page.locator('.match-evidence')).toHaveCount(0);
    await expect(page.getByText('644 matching records')).toBeVisible();

    const accessibility = await new AxeBuilder({ page })
      .withTags(axeTags)
      .analyze();
    expect(accessibility.violations).toEqual([]);
  });
});
