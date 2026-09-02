import { expect, test } from '@playwright/test';
import { expectMapLayersVisibility } from './support/map-layer-visibility';
import { mockRepositoryApi } from './support/repository-api-mocks';

const RESEARCH_LAYER_IDS = [
  'repository-research-coverage-circles',
  'repository-research-coverage-labels',
] as const;

/**
 * Browser evidence for the first search-backed Research Coverage layer.
 *
 * The important scale property is not how many matching records exist. Maps requests one hit and
 * consumes the search engine's full-result geography facet, so a million-result search never turns
 * into a million browser features. The same aggregated counts are exposed in semantic HTML.
 */
test.describe('repository research coverage', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);
  });

  test('preserves Discovery criteria in one bounded map aggregation request @maps @wcag @section508', async ({
    page,
  }) => {
    const researchRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        url.pathname.endsWith('/api/search') &&
        url.searchParams.get('pageSize') === '1'
      );
    });

    await page.goto(
      '/maps?view=workforce&area=California&q=climate' +
        '&program=TIGER_LINE&program=LODES' +
        '&publisher=U.S.%20Census%20Bureau' +
        '&sourceSystem=DATA_GOV' +
        '&geography=California&type=DATASET&vintageYear=2025',
    );

    await expect(
      page.getByRole('heading', { name: 'California Workforce Explorer' }),
    ).toBeVisible();

    const requestUrl = new URL((await researchRequest).url());
    expect(requestUrl.searchParams.get('q')).toBe('climate');
    expect(requestUrl.searchParams.getAll('program')).toEqual([
      'TIGER_LINE',
      'LODES',
    ]);
    expect(requestUrl.searchParams.get('publisher')).toBe('U.S. Census Bureau');
    expect(requestUrl.searchParams.get('sourceSystem')).toBe('DATA_GOV');
    expect(requestUrl.searchParams.get('geography')).toBe('California');
    expect(requestUrl.searchParams.get('contentType')).toBe('DATASET');
    expect(requestUrl.searchParams.get('vintageYear')).toBe('2025');
    expect(requestUrl.searchParams.get('page')).toBe('0');
    expect(requestUrl.searchParams.get('pageSize')).toBe('1');

    const category = page.getByTestId('map-layer-category-research-coverage');
    const summary = page.getByTestId(
      'map-layer-category-research-coverage-summary',
    );
    const toggle = page.getByTestId('map-layer-research-coverage');

    await expect(category).toBeVisible();
    await expect(summary).toContainText('Research Coverage');
    await expect(summary).toContainText('1 layer');
    await expect(toggle).not.toBeChecked();
    await expectMapLayersVisibility(page, RESEARCH_LAYER_IDS, 'none');

    await toggle.check();
    await expect(toggle).toBeChecked();
    await expect(page).toHaveURL(/research=on/);
    await expectMapLayersVisibility(page, RESEARCH_LAYER_IDS, 'visible');

    const legend = page.getByLabel('Visible map layer legend');
    await expect(legend.getByText(/Repository research by area/)).toContainText(
      '3 mapped of 33 matching',
    );

    const featureList = page.locator(
      'section[aria-labelledby="features-heading"]',
    );
    const researchSummary = featureList.locator('.research-coverage-summary');
    await expect(
      researchSummary.getByRole('heading', {
        name: 'Repository research by area',
      }),
    ).toBeVisible();
    await expect(researchSummary).toContainText(
      '3 of 33 matching research objects explicitly name a supported Census area',
    );
    await expect(researchSummary).toContainText(
      '30 matching objects are not drawn',
    );
    await expect(researchSummary).toContainText(
      'publisher, laboratory, author, and institution locations are not substituted',
    );

    const table = researchSummary.getByRole('table', {
      name: 'Matching research objects with explicit administrative geography',
    });
    const california = table.getByRole('row').filter({ hasText: 'California' });
    await expect(california).toContainText('3');
    await expect(
      table.getByRole('row').filter({ hasText: 'Texas' }),
    ).toHaveCount(0);

    const discoveryLink = california.getByRole('link', {
      name: 'View matching research',
    });
    const href = await discoveryLink.getAttribute('href');
    expect(href).not.toBeNull();
    const discoveryUrl = new URL(href ?? '', 'http://localhost');
    expect(discoveryUrl.pathname).toBe('/discovery');
    expect(discoveryUrl.searchParams.get('q')).toBe('climate');
    expect(discoveryUrl.searchParams.getAll('program')).toEqual([
      'TIGER_LINE',
      'LODES',
    ]);
    expect(discoveryUrl.searchParams.get('publisher')).toBe(
      'U.S. Census Bureau',
    );
    expect(discoveryUrl.searchParams.get('sourceSystem')).toBe('DATA_GOV');
    expect(discoveryUrl.searchParams.get('geography')).toBe('California');
    expect(discoveryUrl.searchParams.get('type')).toBe('DATASET');
    expect(discoveryUrl.searchParams.get('vintageYear')).toBe('2025');

    // Category collapse is presentation-only. It must not mutate the checked layer, legend,
    // accessible summary, or MapLibre layout state.
    await summary.click();
    await expect(category).toHaveJSProperty('open', false);
    await expect(toggle).toBeChecked();
    await expect(legend.getByText(/Repository research by area/)).toBeVisible();
    await expect(researchSummary).toBeVisible();
    await expectMapLayersVisibility(page, RESEARCH_LAYER_IDS, 'visible');

    await summary.click();
    await expect(category).toHaveJSProperty('open', true);
    await toggle.uncheck();
    await expect(toggle).not.toBeChecked();
    await expect(page).toHaveURL(/research=off/);
    await expect(legend.getByText(/Repository research by area/)).toHaveCount(
      0,
    );
    await expect(researchSummary).toHaveCount(0);
    await expectMapLayersVisibility(page, RESEARCH_LAYER_IDS, 'none');
  });
});
