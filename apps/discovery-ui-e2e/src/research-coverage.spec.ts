import { expect, test } from '@playwright/test';
import { mockRepositoryApi } from './support/repository-api-mocks';

/**
 * Browser evidence for publisher-spatial Research Coverage.
 *
 * The browser receives only the bounded features intersecting its viewport plus source-owned
 * summary counts. The same returned research objects are exposed in semantic HTML, so WCAG/508
 * evidence does not depend on inspecting WebGL pixels. Raw MapLibre registration and visibility
 * remain in map-layer-visibility.spec.ts.
 */
test.describe('repository research coverage', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);
  });

  test('preserves Discovery criteria in a viewport-bounded spatial request @wcag @section508', async ({
    page,
  }) => {
    const researchRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        url.pathname.endsWith('/api/maps/research-coverage') &&
        url.searchParams.get('q') === 'climate'
      );
    });

    await page.goto(
      '/maps?view=workforce&area=California&q=climate' +
        '&program=TIGER_LINE&program=LODES' +
        '&publisher=U.S.%20Census%20Bureau' +
        '&sourceSystem=DATA_GOV&type=DATASET',
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
    expect(requestUrl.searchParams.get('contentType')).toBe('DATASET');
    expect(requestUrl.searchParams.get('geography')).toBeNull();
    expect(requestUrl.searchParams.get('vintageYear')).toBeNull();
    expect(requestUrl.searchParams.get('limit')).toBe('200');

    for (const parameter of ['west', 'south', 'east', 'north']) {
      const value = Number(requestUrl.searchParams.get(parameter));
      expect(Number.isFinite(value), `${parameter} must be numeric`).toBe(true);
    }
    expect(Number(requestUrl.searchParams.get('west'))).toBeGreaterThanOrEqual(
      -180,
    );
    expect(Number(requestUrl.searchParams.get('east'))).toBeLessThanOrEqual(
      180,
    );
    expect(Number(requestUrl.searchParams.get('south'))).toBeGreaterThanOrEqual(
      -90,
    );
    expect(Number(requestUrl.searchParams.get('north'))).toBeLessThanOrEqual(
      90,
    );

    const category = page.getByTestId('map-layer-category-research-coverage');
    const categorySummary = page.getByTestId(
      'map-layer-category-research-coverage-summary',
    );
    const toggle = page.getByTestId('map-layer-research-coverage');

    // The capability remains discoverable while its bounded result is loading or empty, but its
    // child control no longer consumes above-the-fold space until the disclosure is opened.
    await expect(category).toBeVisible();
    await expect(categorySummary).toContainText('Research Coverage');
    await expect(categorySummary).toContainText('1 layer');
    await expect(category).toHaveJSProperty('open', false);
    await expect(toggle).not.toBeVisible();

    await categorySummary.click();
    await expect(category).toHaveJSProperty('open', true);
    await expect(toggle).toBeVisible();
    await expect(category).toContainText(
      'Data.gov publisher research geometry',
    );
    await expect(toggle).not.toBeChecked();

    await toggle.check();
    await expect(toggle).toBeChecked();
    await expect(page).toHaveURL(/research=on/);

    const legend = page.getByLabel('Visible map layer legend');
    const legendEntry = legend.getByText(
      /Data.gov publisher research geometry/,
    );
    await expect(legendEntry).toContainText('3 mapped in view');
    await expect(legendEntry).toContainText('2 returned of 33 matching');
    await expect(legendEntry).toContainText('bounded to 200 features');

    const featureList = page.locator(
      'section[aria-labelledby="features-heading"]',
    );
    const researchSummary = featureList.locator('.research-coverage-summary');
    await expect(
      researchSummary.getByRole('heading', {
        name: 'Data.gov publisher research geometry',
      }),
    ).toBeVisible();
    await expect(researchSummary).toContainText(
      '30 of 33 matching Data.gov research objects have publisher spatial geometry',
    );
    await expect(researchSummary).toContainText('3 have no publisher geometry');
    await expect(researchSummary).toContainText(
      '1 have geometry that failed validation',
    );
    await expect(researchSummary).toContainText(
      '2 bounded features are returned to the browser',
    );
    await expect(researchSummary).toContainText(
      'Publisher, laboratory, author, and institution addresses are never substituted',
    );
    await expect(researchSummary).toContainText(
      '1 additional mapped objects in this viewport are omitted',
    );

    const table = researchSummary.getByRole('table', {
      name: 'Publisher-spatial research objects returned for the current map viewport',
    });
    const polygon = table
      .getByRole('row')
      .filter({ hasText: 'California Climate Resilience Study' });
    const point = table
      .getByRole('row')
      .filter({ hasText: 'Western Water Research Observatory' });

    await expect(polygon).toContainText('U.S. Census Bureau');
    await expect(polygon).toContainText('TIGER_LINE / DATASET');
    await expect(polygon).toContainText('Publisher geometry');
    await expect(
      polygon.getByRole('link', { name: 'Open source record' }),
    ).toHaveAttribute(
      'href',
      'https://catalog.data.gov/dataset/california-climate-resilience',
    );
    await expect(point).toContainText('LODES / DATASET');
    await expect(table.getByRole('row')).toHaveCount(3); // header + two bounded features

    await expect(researchSummary).toContainText(
      'Spatial build data-gov-spatial-e2e',
    );
    await expect(researchSummary).toContainText('projection projection-e2e');

    // Category collapse is presentation-only. It must not mutate the checked child, legend, or
    // semantic equivalent. MapLibre layout state is covered by the dedicated @maps suite.
    await categorySummary.click();
    await expect(category).toHaveJSProperty('open', false);
    await expect(toggle).toBeChecked();
    await expect(legendEntry).toBeVisible();
    await expect(researchSummary).toBeVisible();

    await categorySummary.click();
    await expect(category).toHaveJSProperty('open', true);
    await toggle.uncheck();
    await expect(toggle).not.toBeChecked();
    await expect(page).toHaveURL(/research=off/);
    await expect(
      legend.getByText(/Data.gov publisher research geometry/),
    ).toHaveCount(0);
    await expect(researchSummary).toHaveCount(0);
  });
});
