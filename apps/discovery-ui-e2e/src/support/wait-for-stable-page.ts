import type { Page } from '@playwright/test';

/**
 * Waits until nothing on the page is still animating.
 *
 * Contrast and axe checks read computed colours, and a control caught mid-transition reports the
 * colour it is passing through rather than the one it settles on. That made the `/admin/sync`
 * checks flaky: its Material tab panel animates in, the heading is visible before the animation
 * finishes, and lazy-loading the route widened the window between the two.
 *
 * Animations are first collapsed to zero duration, then the page is held until none are running.
 * Waiting alone was not enough: Angular starts the tab panel's enter animation after the heading
 * renders, so a check could slip into the gap and measure a colour the element is passing through.
 * Evidence should describe the state a user reads, which is the settled one.
 */
export async function waitForStablePage(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
    }`,
  });

  await page.waitForFunction(
    () =>
      document
        .getAnimations()
        .every((animation) => animation.playState !== 'running'),
    undefined,
    { timeout: 10_000 },
  );
}
