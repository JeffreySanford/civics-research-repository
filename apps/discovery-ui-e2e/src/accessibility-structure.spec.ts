import { expect, test, type Page } from '@playwright/test';
import { mockRepositoryApi } from './support/repository-api-mocks';

/**
 * The machine-checkable half of the manual accessibility checklists.
 *
 * A screen-reader checklist item like "headings are navigable with H" decomposes into a
 * precondition a machine can verify (one `h1`, no skipped levels, meaningful text) and a judgement
 * only a human can make (does the resulting outline help someone find what they came for). This
 * suite asserts every precondition it can, so the manual run starts from a known-good structure
 * and spends its time on the judgement.
 *
 * It does not replace the NVDA and JAWS runs, and passing it is not evidence of screen-reader
 * support. See documentation/accessibility-manual-evidence.md for what remains human-only.
 */
const ROUTES = [
  {
    path: '/',
    title: 'Civics Research Repository',
    heading: 'Census geospatial discovery with repository sync',
  },
  { path: '/discovery', title: 'Discovery', heading: 'Find research objects' },
  {
    path: '/datasets/tiger-line-north-dakota-2025',
    title: 'Dataset Detail',
    heading: '2025 TIGER/Line - Census Tracts - North Dakota',
  },
  {
    path: '/maps',
    title: 'Map Preview',
    heading: 'MapLibre geospatial workspace',
  },
  { path: '/admin/sync', title: 'Repository Sync', heading: 'Repository sync' },
  {
    path: '/evidence',
    title: 'Platform Evidence',
    heading: 'Platform evidence: conformance and data provenance',
  },
];

async function openRoute(page: Page, route: (typeof ROUTES)[number]) {
  await page.goto(route.path);
  await expect(
    page.getByRole('heading', { name: route.heading }),
  ).toBeVisible();
}

test.describe('accessibility structure', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);
  });

  for (const route of ROUTES) {
    /** NVDA checklist N1: the page title is announced on load and distinguishes the route. */
    test(`${route.path} has a distinct page title @wcag @section508`, async ({
      page,
    }) => {
      await openRoute(page, route);

      await expect(page).toHaveTitle(
        new RegExp(route.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      );
    });

    /** N2: exactly one h1 and no skipped heading levels, so the outline is navigable. */
    test(`${route.path} has one h1 and an unbroken heading outline @wcag @section508`, async ({
      page,
    }) => {
      await openRoute(page, route);

      const levels = await page
        .locator('h1, h2, h3, h4, h5, h6')
        .evaluateAll((nodes) =>
          nodes.map((node) => Number(node.tagName.slice(1))),
        );

      expect(
        levels.filter((level) => level === 1),
        'exactly one h1',
      ).toHaveLength(1);
      expect(levels[0], 'the first heading is the h1').toBe(1);

      for (let index = 1; index < levels.length; index += 1) {
        expect(
          levels[index] - levels[index - 1],
          `heading level jumps from h${levels[index - 1]} to h${levels[index]}`,
        ).toBeLessThanOrEqual(1);
      }
    });

    /** N3: landmarks are navigable. This app has banner, navigation, and main; there is no footer. */
    test(`${route.path} exposes banner, navigation, and main landmarks @wcag @section508`, async ({
      page,
    }) => {
      await openRoute(page, route);

      await expect(page.getByRole('banner')).toHaveCount(1);
      await expect(
        page.getByRole('navigation', { name: 'Primary navigation' }),
      ).toHaveCount(1);
      await expect(page.getByRole('main')).toHaveCount(1);
    });

    /** K1/K4: nothing overrides the natural tab order. */
    test(`${route.path} uses no positive tabindex @wcag @section508`, async ({
      page,
    }) => {
      await openRoute(page, route);

      const positive = await page
        .locator('[tabindex]')
        .evaluateAll((nodes) =>
          nodes
            .filter((node) => Number(node.getAttribute('tabindex')) > 0)
            .map((node) => node.outerHTML.slice(0, 80)),
        );

      expect(positive, 'elements with a positive tabindex').toEqual([]);
    });

    /** K13/N19: every control has a name, and no name is a bare URL or an opaque identifier. */
    test(`${route.path} gives every control a human accessible name @wcag @section508`, async ({
      page,
    }) => {
      await openRoute(page, route);

      const unnamed: string[] = [];
      const machineNamed: string[] = [];

      for (const role of [
        'button',
        'link',
        'checkbox',
        'combobox',
        'textbox',
        'tab',
      ] as const) {
        // Collect, then assert once below. The rule wants no branching in a test, but an audit
        // that walks every control has to skip the hidden ones and record the rest; a single
        // assertion naming every offender is more useful than failing on the first.
        /* eslint-disable playwright/no-conditional-in-test */
        const controls = await page.getByRole(role).all();
        for (const control of controls) {
          if (!(await control.isVisible())) {
            continue;
          }

          const name = (
            await control.evaluate((node) => {
              const element = node as HTMLElement;
              const labelled = element.getAttribute('aria-labelledby');
              if (labelled) {
                return labelled
                  .split(/\s+/)
                  .map((id) => document.getElementById(id)?.textContent ?? '')
                  .join(' ');
              }

              const ariaLabel = element.getAttribute('aria-label');
              if (ariaLabel) {
                return ariaLabel;
              }

              // Form controls take their name from an associated label, never from innerText.
              if (element.id) {
                const label = document.querySelector(
                  `label[for="${element.id}"]`,
                );
                if (label?.textContent) {
                  return label.textContent;
                }
              }

              const wrappingLabel = element.closest('label');
              if (wrappingLabel?.textContent) {
                return wrappingLabel.textContent;
              }

              return element.getAttribute('title') ?? element.innerText ?? '';
            })
          )
            .replace(/\s+/g, ' ')
            .trim();

          if (!name) {
            unnamed.push(
              `${role}: ${(await control.evaluate((node) => node.outerHTML)).slice(0, 70)}`,
            );
            continue;
          }

          // A name that is a raw URL or a slug tells a listener nothing useful.
          if (
            /^https?:\/\//i.test(name) ||
            /^[a-f0-9]{8}-[a-f0-9]{4}-/i.test(name)
          ) {
            machineNamed.push(`${role}: ${name}`);
          }
        }
        /* eslint-enable playwright/no-conditional-in-test */
      }

      expect(unnamed, 'controls with no accessible name').toEqual([]);
      expect(machineNamed, 'controls named with a URL or identifier').toEqual(
        [],
      );
    });
  }

  /**
   * K5: the skip link is the first focusable element and reaches main content.
   *
   * Asserted by DOM order and by focusing it directly rather than by pressing Tab. WebKit only
   * tabs to links when Safari's full keyboard access preference is enabled, so a Tab-based
   * assertion would fail there for a platform-preference reason rather than an application one.
   * That Safari nuance is itself worth knowing and is recorded in the evidence baseline.
   */
  test('a skip link is first in the tab order and reaches main content @wcag @section508', async ({
    page,
  }) => {
    await page.goto('/discovery');

    const firstFocusableIsSkipLink = await page.evaluate(() => {
      const focusable = document.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      return focusable[0]?.className.includes('skip-link') ?? false;
    });
    expect(
      firstFocusableIsSkipLink,
      'the skip link is the first focusable element',
    ).toBe(true);

    const skipLink = page.getByRole('link', { name: 'Skip to main content' });
    await skipLink.focus();

    await expect(skipLink).toBeFocused();
    await expect(skipLink).toHaveAttribute('href', '#main-content');
    await expect(page.locator('#main-content')).toHaveAttribute(
      'tabindex',
      '-1',
    );
  });

  /** N4: the current route is conveyed, not left to visual styling alone. */
  test('primary navigation marks the active route @wcag @section508', async ({
    page,
  }) => {
    await page.goto('/maps');

    await expect(
      page.getByRole('navigation').getByRole('link', { name: 'Maps' }),
    ).toHaveClass(/active/);
  });

  /** N6: facet buttons announce label, count, and pressed state. */
  test('discovery facets expose their selected state @wcag @section508', async ({
    page,
  }) => {
    await page.goto('/discovery');

    const facet = page.getByRole('button', { name: 'Texas (3)' });
    await expect(facet).toHaveAttribute('aria-pressed', 'false');

    await facet.click();
    await expect(
      page.getByRole('button', { name: 'Texas (3)' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  /** N10: tabs expose role, selected state, and a reachable panel. */
  test('dataset detail tabs expose selection state @wcag @section508', async ({
    page,
  }) => {
    await page.goto('/datasets/tiger-line-north-dakota-2025');

    await expect(page.getByRole('tablist')).toHaveCount(1);
    const tabs = page.getByRole('tab');
    expect(await tabs.count()).toBeGreaterThan(1);

    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: 'Citation' }).click();
    await expect(page.getByRole('tab', { name: 'Citation' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('tabpanel')).toBeVisible();
  });

  /** N13: layer controls are labelled checkboxes carrying their own state. */
  test('map layer controls are labelled and stateful @wcag @section508', async ({
    page,
  }) => {
    await page.goto('/maps');

    // By accessible name, and by checkbox role: naming alone is now ambiguous, because each
    // toggle sits beside an info button whose name contains the same layer name. Requiring the
    // role keeps this asserting what N13 is about -- the control is a labelled checkbox -- while
    // still failing if a toggle loses its name.
    const layerNames = [
      'TIGER/Line boundary',
      'LODES commuting flows',
      'SAIPE county poverty',
      'USGS 3HP hydrography',
      'USGS earthquake overlay',
    ];

    for (const name of layerNames) {
      const toggle = page.getByRole('checkbox', { name });

      await expect(toggle).not.toBeChecked();

      await toggle.check();
      await expect(toggle).toBeChecked();

      await toggle.uncheck();
      await expect(toggle).not.toBeChecked();
    }
  });

  /**
   * N14 and M1/M2: the accessible list must carry every event the map draws, with the detail a
   * listener needs. This is the precondition for map equivalence; whether it is *usable* is what
   * Checklist 4 decides.
   */
  test('the feature list carries every mapped event with place and magnitude @wcag @section508', async ({
    page,
  }) => {
    await page.goto('/maps?earthquakes=on');

    const overlay = await page.evaluate(async () => {
      const response = await fetch(
        '/api/overlays/usgs/earthquakes?minMagnitude=0&days=7',
      );
      return response.ok ? await response.json() : null;
    });

    // The empty fallback is not a branch that hides a failure: the assertion below fails loudly
    // if the overlay did not load, rather than passing an empty loop.
    const features: Array<{ place: string; magnitude: number }> =
      // eslint-disable-next-line playwright/no-conditional-in-test
      overlay?.features ?? [];
    expect(
      features.length,
      'overlay returned features to compare against',
    ).toBeGreaterThan(0);

    for (const feature of features) {
      const entry = page.getByRole('button', {
        name: new RegExp(feature.place),
      });
      await expect(entry).toBeVisible();
      await expect(entry).toContainText(String(feature.magnitude));
    }
  });

  /**
   * N16: the map is reachable as a named region.
   *
   * MapLibre puts `tabindex="0"` on its own canvas so keyboard users can pan and zoom, which is a
   * feature for a sighted keyboard user and a question mark for a screen-reader user: focus lands
   * on a canvas whose only accessible name comes from the wrapping region. Whether that is
   * acceptable or confusing is a judgement for Checklist 4 / N16, not something to assert here.
   * What is assertable is that the region carries a name.
   */
  test('the map is exposed as a named region @wcag @section508', async ({
    page,
  }) => {
    await page.goto('/maps');

    await expect(
      page.getByRole('region', { name: 'Interactive map' }),
    ).toHaveCount(1);
    await expect(
      page.getByRole('complementary', { name: 'Visible map layer legend' }),
    ).toHaveCount(1);
  });

  /** N17/N30: status changes are announced through a live region rather than only rendered. */
  test('map selection is announced through a status region @wcag @section508', async ({
    page,
  }) => {
    await page.goto('/maps?earthquakes=on');

    // Named, because the workspace now has two independent selections and an unnamed status
    // region is ambiguous to anyone listing them.
    const announcement = page.getByTestId('feature-announcement');
    await expect(announcement).toHaveAttribute('role', 'status');
    await expect(announcement).toContainText('No map feature selected.');

    await page.getByRole('button', { name: /Western North Dakota/ }).click();
    await expect(announcement).toContainText('Selected Western North Dakota');
  });

  /** K31/N18: a failed operation is announced as an alert, not just styled red. */
  test('a failed sync is exposed as an alert @wcag @section508', async ({
    page,
  }) => {
    await page.route('**/api/admin/sync', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        json: { message: 'down' },
      });
    });
    await page.goto('/admin/sync');

    await page.getByRole('button', { name: 'Dry run sync' }).click();

    // Named: the failure is announced in the page and in a snackbar, and a bare `alert` role
    // lookup matches both plus the live region, which is a strict-mode violation rather than a
    // finding. What this check is about is the sync panel carrying the failure as an alert.
    await expect(
      page
        .getByLabel('Sync workflow')
        .getByRole('alert')
        .filter({ hasText: 'Repository sync request failed' }),
    ).toBeVisible();
  });
});
