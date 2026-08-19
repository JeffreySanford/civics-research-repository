/*
 * A diagnostic, not a gate: reports where the debug toggle actually sits once the panel is open.
 */
/* eslint-disable playwright/expect-expect */
import { test } from '@playwright/test';
import { mockRepositoryApi } from './support/repository-api-mocks';

test.describe('debug toggle placement diagnostic', () => {
  test('reports the toggle position relative to the viewport @diagnostic', async ({
    page,
  }) => {
    await mockRepositoryApi(page);
    await page.goto('/maps');

    const controls = page.getByRole('group', { name: 'Map layer controls' });
    for (const name of [
      'TIGER/Line boundary',
      'LODES commuting flows',
      'SAIPE county poverty',
      'USGS 3HP hydrography',
      'USGS earthquake overlay',
    ]) {
      await controls.getByRole('checkbox', { name }).check();
    }

    await page.getByTestId('map-debug-toggle').click();

    for (const label of ['before scrolling', 'after scrolling to the panel']) {
      if (label.startsWith('after')) {
        await page
          .getByTestId('map-debug-panel')
          .scrollIntoViewIfNeeded()
          .catch(() => undefined);
        await page.mouse.wheel(0, 600);
      }

      const report = await page.evaluate(() => {
        const toggle = document.querySelector(
          '[data-testid="map-debug-toggle"]',
        );
        const panel = document.querySelector('[data-testid="map-debug-panel"]');
        const rect = toggle?.getBoundingClientRect();
        const panelRect = panel?.getBoundingClientRect();
        const style = toggle ? getComputedStyle(toggle) : null;
        return {
          viewportHeight: window.innerHeight,
          toggleTop: rect ? Math.round(rect.top) : null,
          toggleBottom: rect ? Math.round(rect.bottom) : null,
          toggleVisibleInViewport: rect
            ? rect.bottom > 0 && rect.top < window.innerHeight
            : false,
          toggleZIndex: style?.zIndex ?? null,
          toggleColor: style?.color ?? null,
          toggleBackground: style?.backgroundColor ?? null,
          panelTop: panelRect ? Math.round(panelRect.top) : null,
          panelBottom: panelRect ? Math.round(panelRect.bottom) : null,
          panelHeight: panelRect ? Math.round(panelRect.height) : null,
          panelMaxHeight: panel ? getComputedStyle(panel).maxHeight : null,
          stageBottom: (() => {
            const stage = panel?.closest('.map-stage');
            return stage
              ? Math.round(stage.getBoundingClientRect().bottom)
              : null;
          })(),
          stageHeight: (() => {
            const stage = panel?.closest('.map-stage');
            return stage
              ? Math.round(stage.getBoundingClientRect().height)
              : null;
          })(),
        };
      });

      console.log(`\n${label}: ${JSON.stringify(report, null, 1)}`);
    }
  });
});
