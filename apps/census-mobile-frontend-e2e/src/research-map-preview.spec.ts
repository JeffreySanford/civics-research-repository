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

  await page.route('**/api/maps/census-areas', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: [
        {
          id: 'north-dakota',
          label: 'North Dakota Census area boundary preview',
          geography: 'North Dakota',
          west: -104.0489,
          south: 45.9351,
          east: -96.5545,
          north: 49.0007,
          centerLatitude: 47.5515,
          centerLongitude: -101.002,
          defaultZoom: 6,
        },
        {
          id: 'minnesota',
          label: 'Minnesota Census area boundary preview',
          geography: 'Minnesota',
          west: -97.2393,
          south: 43.4994,
          east: -89.4919,
          north: 49.3844,
          centerLatitude: 46.7296,
          centerLongitude: -94.6859,
          defaultZoom: 5.5,
        },
      ],
    });
  });

  await page.route(
    '**/api/overlays/census/population-estimates*',
    async (route) => {
      const url = new URL(route.request().url());
      const geography = url.searchParams.get('geography');
      expect(geography).toBe('North Dakota');
      expect(url.searchParams.get('measure')).toBe('ANNUAL_GROWTH_RATE');
      expect(url.searchParams.get('year')).toBe('2025');

      await route.fulfill({
        contentType: 'application/json',
        json: {
          source: 'U.S. Census Bureau Population Estimates Program',
          sourceUrl: 'https://example.test/co-est2025-alldata.csv',
          attribution: 'U.S. Census Bureau Population Estimates Program',
          geography: 'North Dakota',
          sourceVintage: 2025,
          sourceSha256: 'b'.repeat(64),
          capturedAt: '2026-09-05',
          geometryVintage: 2025,
          geometrySourceUrl: 'https://example.test/tigerweb/counties',
          geometryAttribution: 'U.S. Census Bureau TIGERweb',
          measure: 'ANNUAL_GROWTH_RATE',
          measureLabel: 'Annual population growth rate',
          units: 'percent',
          year: 2025,
          priorYear: 2024,
          supportedPopulationYears: [2020, 2021, 2022, 2023, 2024, 2025],
          supportedChangeYears: [2021, 2022, 2023, 2024, 2025],
          geoJson: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: {
                  fips: '38001',
                  name: 'Adams County',
                  value: -2.5,
                  population: 2100,
                  measure: 'ANNUAL_GROWTH_RATE',
                  year: 2025,
                  priorYear: 2024,
                  priorPopulation: 2154,
                },
                geometry: {
                  type: 'Polygon',
                  coordinates: [
                    [
                      [-102.2, 45.9],
                      [-101.2, 45.9],
                      [-101.2, 46.6],
                      [-102.2, 46.6],
                      [-102.2, 45.9],
                    ],
                  ],
                },
              },
              {
                type: 'Feature',
                properties: {
                  fips: '38017',
                  name: 'Cass County',
                  value: 3.25,
                  population: 202000,
                  measure: 'ANNUAL_GROWTH_RATE',
                  year: 2025,
                  priorYear: 2024,
                  priorPopulation: 195640,
                },
                geometry: {
                  type: 'Polygon',
                  coordinates: [
                    [
                      [-97.2, 46.5],
                      [-96.6, 46.5],
                      [-96.6, 47.1],
                      [-97.2, 47.1],
                      [-97.2, 46.5],
                    ],
                  ],
                },
              },
            ],
          },
          counties: [
            {
              fips: '38001',
              name: 'Adams County',
              value: -2.5,
              population: 2100,
              priorPopulation: 2154,
            },
            {
              fips: '38017',
              name: 'Cass County',
              value: 3.25,
              population: 202000,
              priorPopulation: 195640,
            },
          ],
        },
      });
    },
  );

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
    await expect(page.locator('#mobile-map-preset')).toHaveCount(0);

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

    const preset = page.locator('#mobile-map-preset');
    await expect(preset).toHaveValue('research');
    await preset.selectOption('research-area-context');

    const area = page.locator('#mobile-census-area');
    await expect(area).toBeVisible();
    await area.selectOption('north-dakota');
    await expect(
      page.getByText('North Dakota area context:', { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByText('It is not exact TIGER/Line administrative geometry', {
        exact: false,
      }),
    ).toBeVisible();

    await preset.selectOption('community-population');
    const population = page.getByTestId('mobile-population-context');
    await expect(population).toContainText(
      'Annual population growth rate for North Dakota, 2024–2025',
    );
    await expect(population).toContainText('Adams County');
    await expect(population).toContainText('-2.5%');
    await expect(population).toContainText('Cass County');
    await expect(population).toContainText('+3.25%');
    await expect(population).toContainText('2025 population 202,000');
    await expect(population).toContainText(
      'U.S. Census Bureau Population Estimates Program',
    );
    await expect(population).toContainText('U.S. Census Bureau TIGERweb');

    const currentUrl = new URL(page.url());
    expect(currentUrl.searchParams.get('q')).toBe('climate adaptation');
    expect(currentUrl.searchParams.get('publisher')).toBe('Example Publisher');
    expect(currentUrl.searchParams.get('type')).toBe('DATASET');
    expect(currentUrl.searchParams.has('geography')).toBe(false);

    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
  });

  test('synchronizes semantic-list and pointer map selection @responsive @wcag', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/research-map?q=climate%20adaptation');

    const preview = page.getByTestId('mobile-research-map-preview');
    const selectedRegion = page.getByRole('region', {
      name: 'Selected research',
    });
    const map = page.getByTestId('mobile-research-map-canvas');

    await expect(page.locator('.coverage-map--expanded')).toHaveAttribute(
      'data-map-initialized',
      'true',
    );
    await expect(
      page.getByRole('button', {
        name: 'Show on map: Upper Midwest climate coverage',
      }),
    ).toBeVisible();

    await page
      .getByRole('button', {
        name: 'Show on map: Upper Midwest climate coverage',
      })
      .click();

    await expect(preview).toHaveAttribute('data-selected-source', 'coverage-2');
    await expect(
      page.getByRole('button', {
        name: 'Selected on map: Upper Midwest climate coverage',
      }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(selectedRegion).toContainText(
      'Upper Midwest climate coverage',
    );
    await expect(selectedRegion).toContainText('Example Publisher');
    await expect(
      selectedRegion.getByRole('link', { name: 'Open authoritative source' }),
    ).toHaveAttribute('href', 'https://example.test/coverage-2');

    const mapBox = await map.boundingBox();
    expect(mapBox).not.toBeNull();
    await map.click({
      position: {
        x: Math.floor((mapBox?.width ?? 0) / 2),
        y: Math.floor((mapBox?.height ?? 0) / 2),
      },
    });

    await expect(preview).toHaveAttribute('data-selected-source', 'coverage-1');
    await expect(selectedRegion).toContainText(
      'Northern plains climate coverage',
    );
    await expect(
      page.getByRole('button', {
        name: 'Selected on map: Northern plains climate coverage',
      }),
    ).toHaveAttribute('aria-pressed', 'true');

    const currentUrl = new URL(page.url());
    expect(currentUrl.searchParams.get('q')).toBe('climate adaptation');
    expect(currentUrl.searchParams.has('selectedResearch')).toBe(false);
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
  });

  test('uses matching search geography as initial area context without weakening it @responsive @wcag', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/research-map?q=climate&geography=North%20Dakota');

    await expect(page.locator('#mobile-map-preset')).toHaveValue(
      'research-area-context',
    );
    await expect(page.locator('#mobile-census-area')).toHaveValue(
      'north-dakota',
    );
    await expect(
      page.getByText('North Dakota area context:', { exact: false }),
    ).toBeVisible();
    await expect(page).toHaveURL(/geography=North/);
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
