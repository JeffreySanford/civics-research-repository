import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function mockMobileMapRepository(page: Page): Promise<void> {
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
              id: 'mobile-map-result',
              title: 'Climate adaptation research',
              contentType: 'DATASET',
              program: 'Climate',
              publisher: 'Example Publisher',
              sourceUrl: 'https://example.test/research',
              origin: 'FEDERATED',
              sourceSystem: 'DATA_GOV',
              relevance: {
                rawScore: 8,
                normalizedScore: 1,
                band: 'STRONG',
              },
              matchEvidence: [
                {
                  field: 'TITLE',
                  label: 'Title',
                  matchedTerms: ['climate'],
                },
              ],
            },
          ],
          facets: [],
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

  await page.route('**/api/maps/research-coverage*', async (route) => {
    const url = new URL(route.request().url());
    const west = Number(url.searchParams.get('west') ?? -180);
    const south = Number(url.searchParams.get('south') ?? -85);
    const east = Number(url.searchParams.get('east') ?? 180);
    const north = Number(url.searchParams.get('north') ?? 85);
    await route.fulfill({
      contentType: 'application/json',
      json: {
        buildId: 'mobile-map-e2e',
        sourceSystem: 'DATA_GOV',
        schemaVersion: 1,
        sourceSnapshotAt: '2026-09-12T12:00:00Z',
        capturedAt: '2026-09-12T12:05:00Z',
        compositionSha256: 'a'.repeat(64),
        projectionId: 'projection-mobile',
        criteriaFingerprint: 'criteria-mobile',
        viewport: { west, south, east, north },
        summary: {
          matchingRecords: 12,
          mappedRecords: 8,
          unmappedRecords: 4,
          quarantinedRecords: 0,
          unanchoredAntimeridianRecords: 0,
          viewportMappedRecords: 8,
          returnedFeatures: 2,
          omittedFeatures: 6,
          featureLimit: Number(url.searchParams.get('limit') ?? 80),
          truncated: true,
        },
        features: [
          {
            sourceSystem: 'DATA_GOV',
            sourceIdentifier: 'coverage-1',
            title: 'Northern plains climate coverage',
            publisher: 'Example Publisher',
            program: 'Climate',
            contentType: 'DATASET',
            sourceUrl: 'https://example.test/coverage-1',
            geometryStatus: 'VALID',
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [-104.05, 45.94],
                  [-96.55, 45.94],
                  [-96.55, 49.0],
                  [-104.05, 49.0],
                  [-104.05, 45.94],
                ],
              ],
            },
          },
          {
            sourceSystem: 'DATA_GOV',
            sourceIdentifier: 'coverage-2',
            title: 'Upper Midwest climate coverage',
            publisher: 'Example Publisher',
            program: 'Climate',
            contentType: 'DATASET',
            sourceUrl: 'https://example.test/coverage-2',
            geometryStatus: 'VALID',
            geometry: {
              type: 'Point',
              coordinates: [-94.5, 46.0],
            },
          },
        ],
      },
    });
  });

  await page.route('https://tile.openstreetmap.org/**', async (route) => {
    await route.abort();
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
  const result = await new AxeBuilder({ page })
    .withTags([
      'wcag2a',
      'wcag2aa',
      'wcag21a',
      'wcag21aa',
      'wcag22aa',
      'best-practice',
    ])
    .analyze();
  expect(result.violations).toEqual([]);
}

test.describe('mobile research coverage map preview', () => {
  test.beforeEach(async ({ page }) => {
    await mockMobileMapRepository(page);
  });

  test('shows a small semantic preview and preserves search intent when opening the map @responsive @wcag', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(
      '/?q=climate%20adaptation&publisher=Example%20Publisher&type=DATASET',
    );

    const preview = page.getByTestId('mobile-research-map-preview');
    await expect(preview).toContainText(
      '8 of 12 matching Data.gov spatial records',
    );
    await expect(preview).toContainText(
      '4 matching records do not declare publisher geometry',
    );

    const openMap = page.getByRole('link', {
      name: 'Open research coverage map for the current search',
    });
    await expect(openMap).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);

    await openMap.click();
    await expect(page).toHaveURL(/\/research-map\?/);
    await expect(page).toHaveURL(/q=climate/);
    await expect(page).toHaveURL(/publisher=Example/);
    await expect(page).toHaveURL(/type=DATASET/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Research map' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'Research mapped in this view',
      }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
  });

  test('keeps the preview discoverable in forced colors @media @wcag', async ({
    page,
  }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto('/?q=climate%20adaptation');
    await expect(
      page.getByRole('link', {
        name: 'Open research coverage map for the current search',
      }),
    ).toBeVisible();
    await expectNoAxeViolations(page);
  });
});
