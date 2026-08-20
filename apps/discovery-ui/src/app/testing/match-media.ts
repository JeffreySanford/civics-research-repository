/**
 * Gives jsdom a `window.matchMedia`.
 *
 * <p>jsdom implements no media queries, so any component asking whether the user prefers reduced
 * motion throws rather than getting an answer. That is a gap in the test environment, not a defect
 * in the component: a browser always provides this, and guarding production code against an
 * environment that only exists in tests would be the wrong repair.
 *
 * <p>Returns `false` for every query by default, which is the honest neutral: no reduced-motion
 * preference, no forced colours, no dark scheme. Tests that care about one of those pass it
 * explicitly, and the browser suite covers the rendered behaviour either way.
 */
export function installMatchMediaStub(
  matches: (query: string) => boolean = () => false,
): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: matches(query),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}
