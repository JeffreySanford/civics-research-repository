/*
 * A diagnostic, not a gate: it reports rather than asserts, and it waits a fixed moment for the
 * map and tabs to settle because there is no single "done" signal to await across six pages.
 * Both rules are right for tests and wrong for this file.
 */
/* eslint-disable playwright/expect-expect, playwright/no-wait-for-timeout */
import { test } from '@playwright/test';
import { mockRepositoryApi } from './support/repository-api-mocks';

/**
 * Diagnostic, not a gate: lists the widest elements on each page at 320px.
 *
 * The reflow check reports that a page overflows but not what pushed it, which is the part you
 * need. Tagged so it never runs in the tagged suites; run it directly when reflow fails:
 *   npx playwright test --config=apps/discovery-ui-e2e/playwright.config.mts \
 *     --grep @diagnostic --project=chromium
 */
const PAGES = [
  '/',
  '/discovery',
  '/datasets/tiger-line-north-dakota-2025',
  '/maps',
  '/admin/sync',
  '/evidence',
];

test.describe('reflow overflow diagnostic', () => {
  test('lists elements past the right edge of a 320px viewport @diagnostic', async ({
    page,
  }) => {
    await mockRepositoryApi(page);
    await page.setViewportSize({ width: 320, height: 720 });

    for (const path of PAGES) {
      await page.goto(path);
      await page.waitForTimeout(750);

      const offenders = await page.evaluate(() => {
        const found: { tag: string; cls: string; width: number }[] = [];
        for (const element of Array.from(document.querySelectorAll('*'))) {
          const rect = element.getBoundingClientRect();
          // Right edge, not width: an element narrower than the viewport still scrolls the page
          // when it is positioned or shifted past the right edge.
          if (rect.right > document.documentElement.clientWidth + 0.5) {
            found.push({
              tag: element.tagName.toLowerCase(),
              cls: (element.getAttribute('class') ?? '').slice(0, 60),
              width: Math.round(rect.right),
            });
          }
        }
        return found
          .sort((left, right) => right.width - left.width)
          .slice(0, 12);
      });

      console.log(
        `\n${path} — ${offenders.length} element(s) past the right edge`,
      );
      for (const offender of offenders) {
        console.log(
          `  right=${String(offender.width).padStart(5)}px  ${offender.tag}.${offender.cls}`,
        );
      }
    }
  });
});
