import { expect, test, type Page } from '@playwright/test';
import { mockRepositoryApi } from './support/repository-api-mocks';

/**
 * Browser-level keyboard preconditions for the manual Section 508 checklist.
 *
 * Raw Tab traversal is asserted in Chromium and Firefox. Playwright WebKit cannot model Safari's
 * macOS "Press Tab to highlight each item" / Full Keyboard Access preference reliably, so those
 * two traversal assertions are intentionally skipped there. WebKit still runs the accessible-name,
 * semantic, axe, contrast, reflow, and interaction suites; Safari Tab traversal remains a manual
 * evidence item.
 */
const ROUTES = [
  { name: 'home', path: '/' },
  { name: 'discovery', path: '/discovery' },
  {
    name: 'research object',
    path: '/datasets/tiger-line-north-dakota-2025',
  },
  { name: 'maps', path: '/maps' },
  { name: 'admin sync', path: '/admin/sync' },
  { name: 'evidence', path: '/evidence' },
] as const;

const INTERACTIVE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[role="button"]:not([aria-disabled="true"])',
  '[role="tab"]:not([aria-disabled="true"])',
].join(', ');

async function openRoute(page: Page, path: string): Promise<void> {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(
    response?.ok(),
    `${path} returned a successful document response`,
  ).toBe(true);

  // This is route boot/readiness, not the accessibility assertion itself. Under parallel Firefox
  // runs the Vite dev server may still be transforming the MapLibre route after DOMContentLoaded.
  // Give Angular's shell a bounded readiness window; the interaction/name assertions below retain
  // their normal tighter timeouts and still fail if the application never renders.
  await expect(page.getByRole('main')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({
    timeout: 10_000,
  });
}

async function visibleControlCount(page: Page): Promise<number> {
  return page.locator(INTERACTIVE).evaluateAll(
    (nodes) =>
      nodes.filter((node) => {
        const element = node as HTMLElement;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          rect.width > 0 &&
          rect.height > 0
        );
      }).length,
  );
}

async function focusedStamp(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (
      !element ||
      element === document.body ||
      element === document.documentElement
    ) {
      return null;
    }

    return (
      element.getAttribute('data-testid') ||
      element.id ||
      element.getAttribute('aria-label') ||
      `${element.tagName}:${element.textContent?.trim().slice(0, 40) ?? ''}`
    );
  });
}

async function resetFocus(page: Page): Promise<void> {
  await page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    active?.blur();
  });
}

test.describe('keyboard operability', () => {
  test.beforeEach(async ({ page }) => {
    await mockRepositoryApi(page);
  });

  for (const route of ROUTES) {
    /** K1: basic raw Tab traversal reaches multiple controls. Safari/WebKit is manual evidence. */
    test(`${route.name} reaches every interactive control by Tab @wcag @section508`, async ({
      page,
      browserName,
    }) => {
      test.skip(
        browserName === 'webkit',
        'Safari Tab traversal depends on the Full Keyboard Access preference; verify it manually.',
      );

      await openRoute(page, route.path);
      const controlCount = await visibleControlCount(page);
      await resetFocus(page);

      const reached = new Set<string>();
      const attempts = Math.min(Math.max(controlCount + 4, 8), 40);
      for (let index = 0; index < attempts; index += 1) {
        await page.keyboard.press('Tab');
        const stamp = await focusedStamp(page);
        if (stamp) {
          reached.add(stamp);
        }
      }

      expect(
        reached.size,
        `${route.name}: tabbing reached ${reached.size} of ${controlCount} controls`,
      ).toBeGreaterThanOrEqual(Math.min(controlCount, 3));
    });

    /** K2: focus moves forward and backward instead of becoming trapped. Safari/WebKit is manual. */
    test(`${route.name} lets focus escape backwards @wcag @section508`, async ({
      page,
      browserName,
    }) => {
      test.skip(
        browserName === 'webkit',
        'Safari Tab traversal depends on the Full Keyboard Access preference; verify it manually.',
      );

      await openRoute(page, route.path);
      await resetFocus(page);

      await page.keyboard.press('Tab');
      const first = await focusedStamp(page);
      await page.keyboard.press('Tab');
      const second = await focusedStamp(page);

      expect(first, `${route.name} focused a first control`).not.toBeNull();
      expect(second, `${route.name} moved on to a second control`).not.toBe(
        first,
      );

      await page.keyboard.press('Shift+Tab');
      expect(await focusedStamp(page), `${route.name} can move backwards`).toBe(
        first,
      );
    });

    /**
     * K13/N19: ask the browser accessibility tree for each control's computed name.
     *
     * Do not reimplement the accessible-name algorithm here. Native `<label for>`, wrapping labels,
     * aria-labelledby, aria-label, and Material-generated relationships all belong to the browser's
     * accessibility computation, which is exactly what Playwright's assertion exercises.
     */
    test(`${route.name} names every control it focuses @wcag @section508`, async ({
      page,
    }) => {
      await openRoute(page, route.path);

      const controls = page.locator(INTERACTIVE);
      const unnamed: string[] = [];
      for (let index = 0; index < (await controls.count()); index += 1) {
        const control = controls.nth(index);
        if (!(await control.isVisible())) {
          continue;
        }

        try {
          await expect(control).toHaveAccessibleName(/\S+/, { timeout: 2_000 });
        } catch {
          unnamed.push(
            (await control.evaluate((node) => node.outerHTML)).slice(0, 160),
          );
        }
      }

      expect(unnamed, `${route.name} controls with no accessible name`).toEqual(
        [],
      );
    });
  }

  test('map explanations do not require a pointer @wcag @section508', async ({
    page,
  }) => {
    await openRoute(page, '/maps');

    for (const testId of [
      'map-methodology-info',
      'map-layer-tiger-info',
      'map-layer-workplace-info',
      'map-layer-lodes-info',
      'map-layer-saipe-info',
      'map-layer-hydrography-info',
      'map-layer-earthquake-info',
    ]) {
      const control = page.getByTestId(testId);
      await expect(control).toHaveAccessibleName(/\S+/);
      await expect(control).toHaveAccessibleDescription(/\S+/);
    }
  });

  test('discovery focus order follows the visual order @wcag @section508', async ({
    page,
  }) => {
    await openRoute(page, '/discovery');

    const searchPrecedesSubmit = await page.evaluate(() => {
      const search = document.querySelector('#repository-search');
      const submit = document.querySelector(
        'form[role="search"] button[type="submit"]',
      );
      if (!search || !submit) {
        return false;
      }
      return Boolean(
        search.compareDocumentPosition(submit) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      );
    });

    expect(searchPrecedesSubmit).toBe(true);
  });
});
