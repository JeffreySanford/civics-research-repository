# Section 508 and WCAG Plan

## Accessibility Position

Automation provides repeatable release evidence, but it does not replace manual assistive-technology testing. The project should treat accessibility evidence as part of the engineering artifact, especially for search, facets, dataset detail pages, dialogs, forms, and maps.

## Forced Colors And Dark Mode

Windows High Contrast replaces the author's palette outright: background colours, box-shadows and
border colours are discarded and replaced with the user's own. Outlines and border widths survive.

That makes it a machine-checkable class of defect that neither a screen reader nor an ordinary axe
scan finds. State carried by a background simply stops being visible, while the markup still says
the element is selected. `forced-colors.spec.ts` asserts that selection markers survive, that the
map legend reads without its swatches, that the restricted badge is a word rather than a colour, and
that axe reports no violations under both forced-colors and a dark scheme.

Two findings from writing it, both recorded because they are the kind of thing that recurs:

- **The selected flow row and selected facets were marked with a background and a box-shadow.** Both
  are discarded in forced-colors, so a high-contrast user saw no selection at all. They now also
  carry an `outline` under `@media (forced-colors: active)`, using the `Highlight` system colour so
  the mark matches whatever the user chose.
- **`test.use({ forcedColors: 'active' })` did not apply.** `matchMedia('(forced-colors: active)')`
  stayed false, so the suite would have passed against the ordinary palette while reporting that it
  had checked high contrast. The spec uses `page.emulateMedia` instead, which was verified to flip
  the media query.

These run on Chromium only. Firefox and WebKit do not implement the emulation, and a test that
passes because a feature is absent is worse than one that does not run.

## Baseline

Federal Section 508 currently incorporates WCAG 2.0 Level A and AA. The project should target WCAG 2.1/2.2 AA practices where practical while documenting the required 508 baseline separately.

## Automated Evidence

Implemented, and run as part of `quality:all`:

- axe-core scans across all six routes (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `best-practice`).
- Keyboard interaction tests for search filters, result navigation, dataset tabs, and map layer controls.
- Isolated AA color contrast checks per route.
- Responsive reflow checks at 320px, plus a 200% zoom check on discovery.
- Storyboard checks covering the primary demo workflows and repository API failure states.

Still planned:

- Focus-visible verification as an explicit assertion rather than a manual observation.
- Dialog focus trapping and restoration tests, once any dialog exists.
- Form label and error association checks as a dedicated assertion.
- Forced-colors and high-contrast mode smoke tests.

Run them directly:

```bash
pnpm run wcag:report
```

```bash
pnpm run section508:report
```

## Manual Evidence

Automated scans establish the absence of detectable violations. They do not establish that the workflow is usable, and for the map component the difference is decisive: a canvas can pass every rule and remain unusable with a screen reader.

Executable checklists are in [accessibility-manual-evidence.md](accessibility-manual-evidence.md):

- Keyboard-only navigation, 31 checks across all routes.
- NVDA smoke test, 20 checks.
- JAWS smoke test, the NVDA set plus 8 JAWS-specific checks, where a license is available.
- Map equivalence, 15 checks — the determining test for the map component.
- Cognitive and workflow review, 9 checks.

An automated baseline is recorded in [accessibility-evidence/release-checklists/](accessibility-evidence/release-checklists/), covering every precondition a machine can settle: titles, heading outline, landmarks, tab order, accessible-name resolution, control state, live regions, and feature-list completeness. It also records three findings for the manual run.

No assistive technology has been operated. Until an NVDA run exists, this project has automated results plus a structural baseline, not Section 508 evidence, and should be described that way.

## Key UI Requirements

- All controls are reachable and operable by keyboard.
- Focus order follows the visual and workflow order.
- Focus indicators are visible.
- Search filters communicate selected state and result count changes.
- Dataset tabs expose correct semantics.
- Download and citation actions have clear accessible names.
- Map controls have accessible labels.
- Map data has a non-map representation.
- Map and feature list share one selection, settable from either side, with the selected feature announced. Specified in [mapping-visualization.md](mapping-visualization.md#map-and-feature-list-synchronization); not yet implemented, and the main reason the map cannot yet be claimed as accessible.
- Errors identify affected fields and suggest correction.
- Status messages are announced without stealing focus.

## Evidence Folder Direction

Completed runs are recorded in [accessibility-evidence/](accessibility-evidence/README.md):

```text
documentation/accessibility-evidence/
├── automated-scans/      Saved wcag:report and section508:report output
├── keyboard-tests/       Completed keyboard checklist runs
├── screen-reader-notes/  Completed NVDA and JAWS runs, with AT versions
└── release-checklists/   One dated summary per release
```

The recording template is in [accessibility-manual-evidence.md](accessibility-manual-evidence.md#recording-results).
