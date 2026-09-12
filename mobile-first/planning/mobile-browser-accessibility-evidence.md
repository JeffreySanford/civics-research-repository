# Mobile Browser and Accessibility Evidence

## Purpose

The mobile Census experience now has a complete search-to-research journey, including search ranking evidence, filters, research detail, typed research-package relationships, related research navigation and shared result explainability. This evidence slice verifies that the journey remains usable across representative mobile and tablet widths and under accessibility-related browser media settings.

Automated browser evidence is engineering evidence. It does not replace manual assistive-technology review and must not be described as completed manual Section 508, Trusted Tester, NVDA, JAWS or VoiceOver verification.

Issue #49 is closed **not planned**, so manual AT execution is not a current completion gate. The manual protocol remains available as a future template if a later claim or delivery context requires human verification.

## Automated responsive matrix

The targeted Playwright evidence exercises the same search and research-detail journey at:

- 320 × 800 — narrow supported baseline;
- 390 × 844 — common modern phone width;
- 430 × 932 — larger phone width;
- 768 × 1024 — tablet / expanded mobile layout.

At each width the evidence verifies:

- query hydration and search results render;
- rank and textual relevance evidence remain visible;
- the query-wide result-type summary remains available;
- the page has no horizontal document overflow;
- axe reports no configured WCAG 2.0/2.1/2.2 A/AA or best-practice violations;
- a research record can be opened;
- focus moves to the research-detail heading;
- research-package context remains available;
- the detail page has no horizontal document overflow;
- axe remains clean on the detail surface.

The result-explainability slice adds browser evidence that the `Why this matched` dialog opens with the expected API-owned evidence and returns focus to its invoking control when closed.

## Media and keyboard evidence

Additional browser checks cover:

### Forced colors

The browser is placed in forced-colors mode and the search surface must retain visible textual semantics for:

- ordinal rank;
- Strong/Good/Moderate/Weak/Low match label;
- the explanation that match evidence is query-relative rather than a percentage.

Color is therefore supplementary rather than the only carrier of meaning.

### Reduced motion

The browser is placed in `prefers-reduced-motion: reduce`. The filter dialog must remain operable and Escape must close the filter surface and restore focus to the trigger.

The current mobile application does not depend on animation for state or meaning. If motion is introduced later, this evidence should be extended to assert that nonessential motion is suppressed.

### Keyboard entry

The first Tab stop is the `Skip to main content` link. Activating it must focus the main application region. Search submission remains keyboard-operable and the resulting page is rechecked with axe.

The explainability browser evidence also verifies focus entry/close/focus-return behavior for the shared dialog.

## Existing complementary evidence

This matrix is additive to existing tests that cover:

- search URL hydration and shareable filter state;
- filter selection/removal and Escape focus restoration;
- loading, empty, error, ranking, match-evidence and query-wide summary states;
- shared result explainability in both Angular frontends;
- result-to-detail navigation and Back-to-results restoration;
- direct federated detail deep links;
- typed research-package traversal;
- broader related-research traversal;
- detail-to-detail focus movement.

## Manual protocol boundary

The repository retains [the manual accessibility validation protocol](../documentation/accessibility/manual-validation-protocol.md) as a test template. It is intentionally unexecuted unless future work explicitly schedules human validation.

If manual verification is later required, the protocol includes scenarios for:

- NVDA + Chromium keyboard/read-order review;
- JAWS + Chromium or Edge where available;
- VoiceOver + Safari/mobile Safari where available;
- 200% and 400% zoom/reflow inspection;
- Windows High Contrast / forced-colors visual inspection;
- visible focus through search, filters, results, explainability, detail, package links, related research and Back-to-results;
- status/error announcement behavior with a real screen reader;
- touch-target and orientation inspection on representative hardware/emulation.

No result is implied until an actual test record exists with environment/version/date/outcome evidence.

## Acceptance

The automated browser-evidence slice is complete when:

1. all four responsive widths pass the search/detail overflow and axe checks;
2. forced-colors retains textual ranking/relevance meaning;
3. reduced-motion mode does not impair filter interaction or focus restoration;
4. the skip-link path is keyboard-operable;
5. result explainability retains truthful semantics and focus return;
6. the existing narrow mobile suite remains green;
7. production and Storybook builds remain green; and
8. automated accessibility results remain explicitly separated from any future manual AT/conformance claim.
