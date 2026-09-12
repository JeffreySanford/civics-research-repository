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

async function mockSearch(page: Page): Promise<void> {
  await page.route('**/api/search/cursor*', async (route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get('q')?.trim() ?? '';
    const contentType = url.searchParams.get('contentType');
    const result = {
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
      relevance: { rawScore: 10, normalizedScore: 1, band: 'STRONG' },
    };
    await route.fulfill({
      contentType: 'application/json',
      json: {
        search: {
          resultSource: 'REPOSITORY',
          query,
          page: 0,
          pageSize: 10,
          totalResults: 1,
          results: contentType && contentType !== 'DATASET' ? [] : [result],
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

function researchIdFromRequest(url: string): string {
  const token = new URL(url).pathname.split('/').at(-1) ?? '';
  return Buffer.from(token, 'base64url').toString('utf8');
}

async function mockDetail(page: Page): Promise<void> {
  await page.route('**/api/research/*', async (route) => {
    const researchId = researchIdFromRequest(route.request().url());

    if (researchId === 'north-dakota-methodology') {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          source: 'REPOSITORY',
          id: researchId,
          title: 'North Dakota Migration Methodology',
          contentType: 'METHODOLOGY',
          program: 'ACS',
          programName: 'Population Mobility',
          publisher: 'U.S. Census Bureau',
          abstractText: 'Methodology used to construct the migration-flow research product.',
          sourceSystem: 'DSPACE',
          geography: 'North Dakota',
          vintageYear: 2025,
          accessLevel: 'PUBLIC',
          license: 'Public domain',
          citation: 'U.S. Census Bureau. North Dakota Migration Methodology.',
          sourceUrl: 'https://www.census.gov/topics/population/migration.html',
          files: [],
          authors: [],
          relations: [],
          relatedResearch: [],
        },
      });
      return;
    }

    if (researchId === 'north-dakota-population-estimates') {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          source: 'REPOSITORY',
          id: researchId,
          title: 'North Dakota Population Estimates',
          contentType: 'DATASET',
          program: 'PEP',
          programName: 'Population Estimates',
          publisher: 'U.S. Census Bureau',
          abstractText: 'Related population estimates for North Dakota.',
          sourceSystem: 'DSPACE',
          geography: 'North Dakota',
          vintageYear: 2025,
          accessLevel: 'PUBLIC',
          license: 'Public domain',
          citation: 'U.S. Census Bureau. North Dakota Population Estimates.',
          sourceUrl: 'https://www.census.gov/programs-surveys/popest.html',
          files: [],
          authors: [],
          relations: [],
          relatedResearch: [],
        },
      });
      return;
    }

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
        files: [
          {
            id: 'migration-table',
            label: 'Migration table',
            format: 'CSV',
            url: 'https://example.test/migration.csv',
          },
        ],
        authors: [],
        relations: [
          {
            verb: 'uses',
            targetId: 'north-dakota-methodology',
            targetTitle: 'North Dakota Migration Methodology',
            targetType: 'METHODOLOGY',
            targetAccessLevel: 'PUBLIC',
            note: 'Documents the methodology used by this migration product.',
          },
        ],
        relatedResearch: [
          {
            id: 'north-dakota-population-estimates',
            title: 'North Dakota Population Estimates',
            contentType: 'DATASET',
            program: 'PEP',
            programName: 'Population Estimates',
            publisher: 'U.S. Census Bureau',
            summary: 'Related population estimates for North Dakota.',
            sourceUrl: 'https://www.census.gov/programs-surveys/popest.html',
            origin: 'CURATED',
            sourceSystem: 'DSPACE',
            geography: 'North Dakota',
            vintageYear: 2025,
          },
        ],
      },
    });
  });
}

async function openMigrationDetail(page: Page) {
  await page.goto('/?q=North%20Dakota%20migration&type=DATASET');
  const viewLink = page.getByRole('link', {
    name: 'View research object: Migration Flows for North Dakota',
  });
  await expect(viewLink).toBeVisible();
  await viewLink.click();
  return viewLink;
}

async function expectSearchContextRestored(page: Page): Promise<void> {
  await expect
    .poll(() => new URL(page.url()).searchParams.get('q'))
    .toBe('North Dakota migration');
  expect(new URL(page.url()).searchParams.get('type')).toBe('DATASET');
  await expect(page.locator('#research-query')).toHaveValue(
    'North Dakota migration',
  );
  await expect(page.locator('.active-filters')).toContainText('Dataset');
}

test.describe('mobile research detail navigation', () => {
  test.beforeEach(async ({ page }) => {
    await mockSearch(page);
    await mockDetail(page);
  });

  test('opens a result and returns to the exact filtered search at 320px @wcag', async ({
    page,
  }) => {
    const viewLink = await openMigrationDetail(page);

    await expect(page).toHaveURL(/\/research\//);
    const heading = page.getByRole('heading', {
      level: 1,
      name: 'Migration Flows for North Dakota',
    });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    await expect(page.getByText('Population Mobility')).toBeVisible();
    await expect(page.getByText('Public domain')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open file' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'View authoritative source' }),
    ).toBeVisible();

    const accessibility = await new AxeBuilder({ page })
      .withTags(axeTags)
      .analyze();
    expect(accessibility.violations).toEqual([]);

    await page.getByRole('button', { name: 'Back to results' }).click();
    await expectSearchContextRestored(page);
    await expect(viewLink).toBeFocused();
  });

  test('traverses a typed research package and returns directly to search @wcag', async ({
    page,
  }) => {
    const viewLink = await openMigrationDetail(page);

    await expect(
      page.getByRole('heading', { name: 'Research package' }),
    ).toBeVisible();
    await expect(page.getByText('Uses', { exact: true })).toBeVisible();
    const methodologyLink = page.getByRole('link', {
      name: 'North Dakota Migration Methodology',
    });
    await expect(methodologyLink).toBeVisible();
    await expect(
      page.getByText('Documents the methodology used by this migration product.'),
    ).toBeVisible();

    await methodologyLink.click();
    const methodologyHeading = page.getByRole('heading', {
      level: 1,
      name: 'North Dakota Migration Methodology',
    });
    await expect(methodologyHeading).toBeVisible();
    await expect(methodologyHeading).toBeFocused();
    await expect(page.getByText('Methodology', { exact: true })).toBeVisible();

    const accessibility = await new AxeBuilder({ page })
      .withTags(axeTags)
      .analyze();
    expect(accessibility.violations).toEqual([]);

    await page.getByRole('button', { name: 'Back to results' }).click();
    await expectSearchContextRestored(page);
    await expect(viewLink).toBeFocused();
  });

  test('opens broader related research without losing the search origin @wcag', async ({
    page,
  }) => {
    await openMigrationDetail(page);

    await expect(
      page.getByRole('heading', { name: 'Related research' }),
    ).toBeVisible();
    const relatedLink = page.getByRole('link', {
      name: 'North Dakota Population Estimates',
    });
    await relatedLink.click();

    const relatedHeading = page.getByRole('heading', {
      level: 1,
      name: 'North Dakota Population Estimates',
    });
    await expect(relatedHeading).toBeVisible();
    await expect(relatedHeading).toBeFocused();
    await expect(
      page.getByText('Population Estimates', { exact: true }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Back to results' }).click();
    await expectSearchContextRestored(page);
  });

  test('deep-links to federated provenance and uses the return URL fallback @wcag', async ({
    page,
  }) => {
    await page.route('**/api/research/*', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          source: 'FEDERATED',
          id: 'DATA_GOV:https://example.test/federated',
          title: 'Federated Migration Metadata',
          contentType: 'PUBLICATION',
          program: 'OTHER',
          programName: 'Population Research',
          publisher: 'Example Federal Publisher',
          abstractText: 'Federated metadata retained for discovery.',
          sourceSystem: 'DATA_GOV',
          accessLevel: 'PUBLIC',
          citation: 'Federated Migration Metadata',
          sourceUrl: 'https://example.test/federated',
          files: [],
          authors: [],
          relations: [],
          relatedResearch: [],
        },
      });
    });

    await page.goto(
      '/research/REFUQV9HT1Y6aHR0cHM6Ly9leGFtcGxlLnRlc3QvZmVkZXJhdGVk?returnUrl=%2F%3Fq%3Dmigration',
    );
    await expect(page.getByText('Federated metadata.')).toBeVisible();
    await expect(
      page.getByText('No publisher files are preserved locally'),
    ).toBeVisible();

    const accessibility = await new AxeBuilder({ page })
      .withTags(axeTags)
      .analyze();
    expect(accessibility.violations).toEqual([]);

    await page.getByRole('button', { name: 'Back to results' }).click();
    await expect(page).toHaveURL(/\?q=migration/);
  });

  test('announces a detail failure @wcag', async ({ page }) => {
    await page.route('**/api/research/*', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        json: { message: 'Not found' },
      });
    });
    await page.goto('/research/dW5rbm93bg');
    await expect(page.getByRole('alert')).toContainText(
      'Research object could not be loaded',
    );
  });
});
