# Mobile Browser and Accessibility Evidence

## Purpose

The mobile Census experience now has a complete search-to-research journey, including search ranking evidence, filters, research detail, typed research-package relationships, and related research navigation. This evidence slice verifies that the journey remains usable across representative mobile and tablet widths and under accessibility-related browser media settings.

Automated browser evidence complements, but does not replace, manual assistive-technology review.

## Automated responsive matrix

The targeted Playwright evidence exercises the same search and research-detail journey at:

- 320 × 800 — narrow supported baseline
- 390 × 844 — common modern phone width
- 430 × 932 — larger phone width
- 768 × 1024 — tablet / expanded mobile layout

At each width the evidence verifies:

- query hydration and search results render
- rank and textual relevance evidence remain visible
- the query-wide result-type summary remains available
- the page has no horizontal document overflow
- axe reports no WCAG 2.0/2.1/2.2 A/AA or best-practice violations
- a research record can be opened
- focus moves to the research-detail heading
- research-package context remains available
- the detail page has no horizontal document overflow
- axe remains clean on the detail surface

## Media and keyboard evidence

Additional browser checks cover:

### Forced colors

The browser is placed in forced-colors mode and the search surface must retain visible textual semantics for:

- ordinal rank
- Strong/Good/Moderate/Weak/Low match label
- the explanation that match evidence is query-relative rather than a percentage

Color is therefore supplementary rather than the only carrier of meaning.

### Reduced motion

The browser is placed in `prefers-reduced-motion: reduce`. The filter disclosure must remain operable and Escape must close the filter surface and restore focus to the trigger.

The current mobile application does not depend on animation for state or meaning. If motion is introduced later, this evidence should be extended to assert that nonessential motion is suppressed.

### Keyboard entry

The first Tab stop is the `Skip to main content` link. Activating it must focus the main application region. Search submission remains keyboard-operable and the resulting page is rechecked with axe.

## Existing complementary evidence

This matrix is additive to existing tests that already cover:

- search URL hydration and shareable filter state
- filter selection/removal and Escape focus restoration
- loading, empty, error, ranking, match-evidence, and query-wide summary states
- result-to-detail navigation and Back-to-results restoration
- direct federated detail deep links
- typed research-package traversal
- broader related-research traversal
- detail-to-detail focus movement

## Manual evidence still required

Automated evidence must not be described as proof of full Section 508 conformance. Before calling the mobile experience manually verified, capture at least:

- NVDA + Chromium keyboard/read-order pass
- JAWS + Chromium or Edge keyboard/read-order pass where available
- VoiceOver + Safari/mobile Safari pass where available
- 200% and 400% zoom/reflow inspection
- Windows High Contrast / forced-colors visual inspection
- visible focus inspection through search, filters, results, detail, package links, related research, and Back-to-results
- status/error announcement behavior with a real screen reader
- touch-target and orientation checks on representative mobile hardware or device emulation

Record browser/AT versions, date, scenario, result, and any exception or follow-up issue so the evidence is reproducible rather than anecdotal.

## Acceptance

This slice is complete when:

1. all four responsive widths pass the search/detail overflow and axe checks;
2. forced-colors retains textual ranking/relevance meaning;
3. reduced-motion mode does not impair filter interaction or focus restoration;
4. the skip-link path is keyboard-operable;
5. the existing 320px mobile suite remains green;
6. production and Storybook builds remain green; and
7. manual AT work is explicitly tracked as a separate evidence obligation rather than implied by automation.
