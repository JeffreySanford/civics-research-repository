import axe from 'axe-core';

/**
 * Runs axe against a rendered component, in the unit-test DOM.
 *
 * <p>This complements the Playwright scans rather than repeating them, and the difference is worth
 * stating precisely because it decides what these tests can honestly claim.
 *
 * <p>jsdom has no layout engine. Nothing has a position, a size, or a computed colour against a
 * painted background, so every rule that needs to see the page as rendered is disabled below.
 * Colour contrast, target size and reflow are checked by the Playwright suite, in a real browser,
 * where they mean something. A component test reporting "no contrast violations" from jsdom would
 * be reporting that the rule never ran.
 *
 * <p>What is left is the structural half, and it is the half that regresses most often while
 * refactoring a template: a control that loses its label, an ARIA attribute pointing at an id that
 * no longer exists, a heading level skipped, a list whose items stop being list items. Those are
 * cheap to check here and slow to reach through a browser, because reaching them needs the
 * component in a particular state.
 *
 * <p>State is the reason these exist at all. An error panel, an empty result set, a restricted
 * object: all trivial to render directly and awkward to drive through a running application.
 */
const LAYOUT_DEPENDENT_RULES = [
  // Needs computed colours against what is actually painted.
  'color-contrast',
  'color-contrast-enhanced',
  // Needs element geometry.
  'target-size',
  // Needs a viewport.
  'meta-viewport',
  'meta-viewport-large',
];

export type AxeOptions = {
  /** Rules to disable for this component, each with a reason. */
  readonly disabledRules?: Readonly<Record<string, string>>;
};

/**
 * Asserts a rendered element has no axe violations under the WCAG 2.1 AA rule sets.
 *
 * @param element the component's host element, usually `fixture.nativeElement`
 */
export async function expectNoAxeViolations(
  element: HTMLElement,
  options: AxeOptions = {},
): Promise<void> {
  const disabled = Object.keys(options.disabledRules ?? {});

  const results = await axe.run(element, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
    },
    rules: Object.fromEntries(
      [...LAYOUT_DEPENDENT_RULES, ...disabled].map((rule) => [
        rule,
        { enabled: false },
      ]),
    ),
  });

  if (results.violations.length > 0) {
    // The rule id and the failing markup, not just a count. A violation reported as
    // "1 violation found" costs the reader a debugging session to learn what axe already knew.
    const detail = results.violations
      .map(
        (violation) =>
          `${violation.id}: ${violation.help}\n` +
          violation.nodes
            .map((node) => `    ${node.html}`)
            .slice(0, 3)
            .join('\n'),
      )
      .join('\n');

    throw new Error(
      `Expected no axe violations, found ${results.violations.length}:\n${detail}`,
    );
  }
}
