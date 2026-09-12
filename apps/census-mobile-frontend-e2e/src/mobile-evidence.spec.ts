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

const viewportMatrix = [
  { width: 320, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
] as const;

async function mockRepository(page: Page): Promise<void> {
  await page.route('**/api/search/cursor*', async (route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get('q')?.trim() ?? '';

    await route.fulfill({
      contentType: 'application/json',
      json: {
        search: {
          resultSource: 'REPOSITORY',
          query,
          page: 0,
          pageSize: 10,
          totalResults: 1,
          results: [
            {
              id: 'north-dakota-migration',
              title: 'Migration Flows for North Dakota',
              contentType: 'DATASET',
              program: 'ACS',
              programName: 'Population Mobility',
              publisher: 'U.S. Census Bureau',
              summary: 'Migration research metadata for North Dakota.',
              sourceUrl: 'https://www.census.gov/',
              origin: 'CURATED',
              sourceSystem: 'DSPACE',
              geography: 'North Dakota',
              vintageYear: 2025,
              relevance: {
                rawScore: 10,
                normalizedScore: 1,
                band: 'STRONG',
              },
              matchEvidence: [
                {
                  field: 'TITLE',
                  label: 'Title',
                  matchedTerms: ['migration'],
                },
              ],
            },
          ],
          facets: [
            {
              field: 'type',
              label: 'Type',
              values: [
                {
                  value: 'DATASET',
                  label: 'Dataset',
                  count: 1,
                  selected: false,
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

  await page.route('**/api/research/*', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        source: 'REPOSITORY',
        id: 'north-dakota-migration',
        title: 'Migration Flows for North Dakota',
        contentType: 'DATASET',
        program: 'ACS',
        programName: 'Population Mobility',
        publisher: 'U.S. Census Bureau',
        abstractText:
          'Research metadata describing interstate migration flows for North Dakota.',
        sourceSystem: 'DSPACE',
        geography: 'North Dakota',
        vintageYear: 2025,
        accessLevel: 'PUBLIC',
        license: 'Public domain',
        citation: 'U.S. Census Bureau. Migration Flows for North Dakota.',
        sourceUrl: 'https://www.census.gov/topics/population/migration.html',
        files: [],
        authors: [],
        relations: [
          {
            verb: 'uses',
            targetId: 'north-dakota-methodology',
            targetTitle: 'North Dakota Migration Methodology',
            targetType: 'METHODOLOGY',
            targetAccessLevel: 'PUBLIC',
          },
        ],
        relatedResearch: [],
      },
    });
  });
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
}

async function expectNoAxeViolations(page: Page): Promise<void> {
  const accessibility = await new AxeBuilder({ page })
    .withTags(axeTags)
    .analyze();
  expect(accessibility.violations).toEqual([]);
}

test.describe('mobile responsive and accessibility evidence', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepository(page);
  });

  test('keeps search and detail usable across the mobile-to-tablet matrix @responsive @wcag', async ({
    page,
  }) => {
    for (const viewport of viewportMatrix) {
      await page.setViewportSize(viewport);
      await page.goto('/?q=North%20Dakota%20migration');

      await expect(
        page.getByRole('heading', { name: '1 matching records' }),
      ).toBeVisible();
      await expect(page.getByText('Rank 1', { exact: true })).toBeVisible();
      await expect(page.getByText('Strong match')).toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'Result type mix' }),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectNoAxeViolations(page);

      await page
        .getByRole('link', {
          name: 'View research object: Migration Flows for North Dakota',
        })
        .click();
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: 'Migration Flows for North Dakota',
        }),
      ).toBeFocused();
      await expect(
        page.getByRole('heading', { name: 'Research package' }),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectNoAxeViolations(page);
    }
  });

  test('retains textual ranking semantics in forced-colors mode @media @wcag', async ({
    page,
  }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto('/?q=North%20Dakota%20migration');

    await expect(page.getByText('Rank 1', { exact: true })).toBeVisible();
    await expect(page.getByText('Strong match')).toBeVisible();
    await expect(
      page.getByText('Match labels are query-relative search evidence'),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
  });

  test('keeps filter disclosure operable with reduced motion and restores focus @media @wcag', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?q=North%20Dakota%20migration');

    const filterTrigger = page.getByRole('button', { name: 'Filters' });
    await filterTrigger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Filter results' });
    await expect(dialog).toBeVisible();
    await expectNoAxeViolations(page);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(filterTrigger).toBeFocused();
  });

  test('exposes a keyboard skip path into the main application @keyboard @wcag', async ({
    page,
  }) => {
    await page.goto('/');

    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skipLink).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();

    const queryInput = page.locator('#research-query');
    await queryInput.focus();
    await queryInput.fill('North Dakota migration');
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('heading', { name: '1 matching records' }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
