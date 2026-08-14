/*
 * A diagnostic, not a gate: it reports what the browser actually requested for the hydrography
 * raster and what came back. It runs against the live API rather than the mocks, because the
 * mocks are exactly what hid this.
 */
/* eslint-disable playwright/expect-expect, playwright/no-wait-for-timeout, playwright/no-conditional-in-test */
import { test } from '@playwright/test';

test.describe('hydrography raster network diagnostic', () => {
  test('reports the tile requests and responses @diagnostic', async ({
    page,
  }) => {
    const seen: string[] = [];

    page.on('response', async (response) => {
      const url = response.url();
      if (!url.includes('hydrography') && !url.includes('map-layers')) {
        return;
      }

      seen.push(
        `${response.status()} ${response.headers()['content-type'] ?? '(no type)'}  ${url.slice(0, 140)}`,
      );
    });

    page.on('console', (message) => {
      if (message.type() === 'error') {
        console.log(`  console.error: ${message.text().slice(0, 160)}`);
      }
    });

    await page.goto('/maps?hydrography=on');
    await page.waitForTimeout(3000);

    // Past the service's scale threshold, where tiles are actually requested.
    await page.evaluate(() => {
      const container = document.querySelector(
        '[data-testid="discovery-map-canvas"]',
      );
      const map = (
        container as HTMLElement & {
          __map?: { zoomTo: (zoom: number, options?: unknown) => void };
        }
      )?.__map;
      map?.zoomTo(11, { duration: 0 });
    });
    await page.waitForTimeout(4000);

    const resolved = await page.evaluate(() => {
      const container = document.querySelector(
        '[data-testid="discovery-map-canvas"]',
      );
      const map = (
        container as HTMLElement & {
          __map?: {
            getSource: (id: string) => { tiles?: string[] } | undefined;
          };
        }
      )?.__map;
      return map?.getSource('usgs-3hp-hydrography')?.tiles ?? null;
    });
    console.log(`\nresolved tile template: ${JSON.stringify(resolved)}`);

    console.log(`\nhydrography responses (${seen.length}):`);
    for (const entry of seen.slice(0, 12)) {
      console.log(`  ${entry}`);
    }
  });
});
