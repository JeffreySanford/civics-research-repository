import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { axeEngineeringTags } from './support/axe-tags';
import { mockRepositoryApi } from './support/repository-api-mocks';
import { waitForStablePage } from './support/wait-for-stable-page';

const AXE_ROUTES = [
  { path: '/', heading: 'Census geospatial discovery with repository sync' },
  { path: '/discovery', heading: 'Find research objects' },
  { path: '/maps', heading: 'Geospatial research explorer' },
  {
    path: '/evidence',
    heading: 'Platform evidence: conformance and data provenance',
  },
] as const;

/**
 * Windows High Contrast, as Chromium models it.
 *
 * <p>Forced-colors mode replaces the author's palette wholesale. `background-color`, `box-shadow`
 * and `border-color` are overridden by the user's chosen colours; `outline` and border *width* are
 * preserved. That makes it a machine check for a defect a screen reader cannot find and a sighted
 * reviewer only notices if they happen to run it: state that is carried by a background or a shadow
 * simply stops existing, while the markup still claims the element is selected.
 *
 * <p>These run on Chromium only. Firefox and WebKit do not implement the emulation, and a test that
 * silently passes because the feature is absent is worse than one that does not run.
 */
test.describe('forced-colors mode', () => {
  test.beforeEach(async ({ page, browserName }) => {
    // A capability guard, not a disabled test: Firefox and WebKit do not implement forced-colors
    // emulation, and running these there would pass against the ordinary palette while claiming to
    // have checked high contrast.
    // eslint-disable-next-line playwright/no-skipped-test
    test.skip(
      browserName !== 'chromium',
      'forced-colors emulation is Chromium-only',
    );

    // page.emulateMedia, not test.use({ forcedColors }). The fixture form reported success and
    // left `matchMedia('(forced-colors: active)')` false, so the whole suite would have passed
    // against the ordinary palette while claiming to have tested high contrast.
    await page.emulateMedia({ forcedColors: 'active' });
    await mockRepositoryApi(page);
  });

  /**
   * The selected commuting flow must stay visibly selected.
   *
   * <p>An outline is the assertion rather than a background, because a background is exactly what
   * forced-colors takes away. `aria-selected` still carries the state to assistive technology; this
   * covers the sighted high-contrast user, who has neither the colour nor the screen reader.
   */
  test('a selected flow row keeps a visible marker @wcag @section508', async ({
    page,
  }) => {
    await page.goto('/maps?area=North%20Dakota&lodes=on');

    const firstRow = page.locator('.flow-select').first();
    await firstRow.click();
    await expect(firstRow).toHaveAttribute('aria-pressed', 'true');

    const outlineStyle = await page
      .locator('.flow-table tr.selected')
      .evaluate((row) => getComputedStyle(row).outlineStyle);

    expect(outlineStyle).not.toBe('none');
  });

  /** Facet selection is the same problem on the discovery page. */
  test('a selected facet keeps a visible marker @wcag @section508', async ({
    page,
  }) => {
    await page.goto('/discovery');

    const publication = page.getByRole('button', { name: /^PUBLICATION \(/ });
    await publication.click();
    await expect(publication).toHaveAttribute('aria-pressed', 'true');

    const outlineStyle = await publication.evaluate(
      (button) => getComputedStyle(button).outlineStyle,
    );

    expect(outlineStyle).not.toBe('none');
  });

  /**
   * Legend swatches lose their colour entirely, so the legend has to read without them.
   *
   * <p>This is why every legend entry carries its layer name as text rather than relying on the
   * coloured square beside it.
   */
  test('the map legend reads without its swatches @wcag @section508', async ({
    page,
  }) => {
    await page.goto('/maps?area=North%20Dakota&lodes=on&workplace=on');

    const legend = page.getByLabel('Visible map layer legend');
    await expect(legend).toContainText('LODES commuting flows');
    await expect(legend).toContainText('LODES workplace employment');
  });

  /** The restricted badge is a word, not a colour, so it survives the palette being replaced. */
  test('a restricted object still says RESTRICTED @wcag @section508', async ({
    page,
  }) => {
    await page.goto('/datasets/lehd-microdata-restricted');

    await expect(page.getByText('RESTRICTED').first()).toBeVisible();
  });

  for (const route of AXE_ROUTES.filter(
    (candidate) => candidate.path !== '/',
  )) {
    test(`${route.path} has no axe violations in forced colors @wcag @section508`, async ({
      page,
    }) => {
      await page.goto(route.path);
      // Wait for the page's own heading before scanning. waitForStablePage alone let the maps
      // route be scanned mid-load, which failed and then passed on retry -- a flake that would
      // have trained everyone to ignore this suite.
      await expect(
        page.getByRole('heading', { name: route.heading }),
      ).toBeVisible();
      await waitForStablePage(page);

      const results = await new AxeBuilder({ page })
        .withTags(axeEngineeringTags)
        .analyze();

      expect(results.violations).toEqual([]);
    });
  }
});

/**
 * Dark mode is a selected palette, not an inverted one, and it is where a token defined only under
 * a light media query shows up as invisible text.
 */
test.describe('dark color scheme', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await mockRepositoryApi(page);
  });

  for (const route of AXE_ROUTES) {
    test(`${route.path} has no axe violations in dark mode @wcag @section508`, async ({
      page,
    }) => {
      await page.goto(route.path);
      await expect(
        page.getByRole('heading', { name: route.heading }),
      ).toBeVisible();
      await waitForStablePage(page);

      const results = await new AxeBuilder({ page })
        .withTags(axeEngineeringTags)
        .analyze();

      expect(results.violations).toEqual([]);
    });
  }
});
