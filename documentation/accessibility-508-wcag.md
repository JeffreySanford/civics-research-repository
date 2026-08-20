# Section 508 and WCAG Evidence

## Position

Accessibility evidence is part of the platform, not a release-note claim. The repository distinguishes four things that are often collapsed incorrectly:

1. prevention through linting and design-system rules,
2. automated structural and browser evidence,
3. manual assistive-technology and workflow evidence,
4. a legal or organizational conformance determination.

The project implements the first two and provides executable checklists for the third. It does not label itself “Section 508 certified” or treat an axe pass as complete conformance.

Federal Section 508 currently incorporates WCAG 2.0 Level A and AA. The application deliberately exercises WCAG 2.1 A/AA tags and newer practices where useful, while keeping the required federal baseline conceptually separate.

## Evidence layers

### 1. Angular template lint

Angular accessibility lint rules prevent common template regressions before rendering:

- missing alternative text,
- controls with no content or label,
- labels without associated controls,
- invalid ARIA,
- roles missing required ARIA,
- click handlers without keyboard behavior,
- interactive elements that cannot receive focus,
- positive `tabindex` values.

### 2. Component-state accessibility tests

```bash
pnpm run a11y:components
```

Vitest/jsdom renders states that a normal route-level browser scan often misses:

- loading and progress states,
- failed requests,
- empty results,
- publications and related-research states,
- restricted objects with no public files,
- sync and evidence workflow states.

These tests are structural. jsdom has no real layout or painted color model, so contrast, reflow, zoom, and target-size rules belong to Playwright rather than being reported as if they ran in a component DOM.

This layer has already found real issues, including unnamed Material progressbars that disappeared before the browser suite began its normal loaded-state scan.

### 3. Browser evidence

```bash
pnpm run wcag:report
pnpm run section508:report
pnpm run e2e:reports
```

The Playwright matrix covers the six primary routes:

- `/`
- `/discovery`
- `/datasets/tiger-line-north-dakota-2025`
- `/maps`
- `/admin/sync`
- `/evidence`

Automated coverage includes:

- axe-core scans tagged for WCAG 2.0/2.1 A and AA plus best practice,
- unique page titles, one `h1`, unbroken heading structure and landmarks,
- no positive `tabindex`,
- browser-computed accessible names and descriptions,
- skip-link, facet, tab, checkbox, alert and live-region semantics,
- map legend, map region, equivalent feature tables/lists and synchronized selection,
- 320px reflow and 200% discovery zoom,
- isolated AA color-contrast scans,
- dark-mode scans,
- forced-colors selection and meaning checks,
- keyboard preconditions and deterministic interactions.

### 4. Manual evidence

The executable checklists remain in [accessibility-manual-evidence.md](accessibility-manual-evidence.md):

- Keyboard-only: K1–K31
- NVDA: N1–N20
- JAWS: N1–N20 plus J1–J8 where a license is available
- Map equivalence: M1–M15
- Cognitive/workflow review: C1–C9

A manual run records the application commit, browser, operating system, assistive-technology version, tester, outcome, failures, and accepted limitations. Passing automation does not silently promote any manual status.

## Accessible-name and tooltip contract

The browser suites use Playwright's computed accessibility model instead of reconstructing the accessible-name algorithm. Native `<label for>`, wrapping labels, `aria-labelledby`, `aria-label`, Material-generated relationships, and control text are therefore judged by the browser accessibility tree.

Seven map information controls expose explanations through accessible descriptions. Tests assert both a meaningful name and the expected description. The contract is the assistive-technology description, not whether a visual tooltip happens to animate after a programmatic focus call.

## Forced colors and dark mode

Forced-colors coverage is implemented, not planned.

Windows High Contrast can discard author backgrounds and box-shadows while preserving outlines. The tests verify that:

- selected flow rows retain a visible marker,
- selected facets retain a visible marker,
- the map legend remains understandable without swatches,
- restricted access remains textual,
- supported routes have no detectable axe violations under forced colors,
- supported routes have no detectable axe violations under a dark color scheme.

Playwright's forced-colors emulation is reliable only in Chromium for this suite. Firefox and WebKit skip those specific checks rather than claiming evidence from an inactive media feature.

## Safari/WebKit keyboard boundary

Raw `Tab` and `Shift+Tab` traversal is automated in Chromium and Firefox. Playwright WebKit cannot reliably model Safari's macOS Full Keyboard Access / “Press Tab to highlight each item” preference, so raw traversal is not treated as automated Safari evidence.

WebKit still runs deterministic semantic, name/description, axe, reflow, contrast, and supported interaction checks. Safari K1/K2 evidence must be recorded manually with the Safari version, macOS version, and keyboard-access preference.

A Chromium or Firefox keyboard pass is never used as a proxy for Safari behavior.

## Map accessibility

MapLibre's WebGL canvas is not itself the information model. The accessible model is the shared NgRx state that drives both the visual marks and the equivalent tables/lists.

Implemented:

- every displayed layer has textual controls and explanatory content,
- LODES workplace jobs and commuting flows have table equivalents,
- selecting a table row updates map selection without stealing focus,
- map-originated selection has a matching list target and announcement path,
- hiding a layer clears incompatible selection,
- unrelated layers do not clear each other's selection,
- legend and status meaning do not rely on color alone,
- map information controls do not require hover.

Still manual:

- trusted pointer interaction from a rendered WebGL feature to the matching list focus target,
- whole-workflow map equivalence under Checklist 4,
- screen-reader judgment of whether the canvas remains non-disruptive.

## Evidence lifecycle

The API evidence manifest is generated from a recorded automated result rather than hand-edited.

```bash
pnpm run evidence:refresh   # run suites; write only when all pass
pnpm run evidence:generate  # regenerate manifest from recorded evidence
pnpm run evidence:check     # fail when manifest and record drift
```

`evidence:refresh` runs component accessibility and the shared browser report suites. If any suite fails, the previous known-good evidence remains untouched. Manual keyboard, NVDA, JAWS, map-equivalence, and cognitive statuses are always preserved unchanged.

The generated status page at [platform-status.md](platform-status.md) reports the currently recorded evidence date and capabilities. An old evidence date is visible as an old evidence date; documentation must not translate it into “current pass.”

## Section 508 report naming

`section508:report` selects the tests tagged for Section 508-oriented evidence. Many of those tests are intentionally dual-tagged with WCAG because the technical criteria overlap. The command is not an independent implementation of every procedure in the federal ICT Testing Baseline and is not a certification mechanism.

Appropriate claim:

> The application has extensive automated WCAG 2.1 and Section 508-oriented evidence, with manual keyboard and assistive-technology evidence tracked separately.

Inappropriate claim:

> The application is Section 508 certified.

## Remaining work

- Record an end-to-end mouse-free keyboard run.
- Record NVDA evidence with Firefox and Chrome.
- Record JAWS evidence or an explicit N/A licensing reason.
- Complete the trusted map-click/map-to-list manual check and the remaining map-equivalence checklist.
- Decide whether a `contentinfo` landmark improves each route.
- Add the complete browser evidence run to CI or a scheduled workflow and decide whether it becomes a required check.
