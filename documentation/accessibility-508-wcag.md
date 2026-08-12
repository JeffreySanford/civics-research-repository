# Section 508 and WCAG Plan

## Accessibility Position

Automation provides repeatable release evidence, but it does not replace manual assistive-technology testing. The project should treat accessibility evidence as part of the engineering artifact, especially for search, facets, dataset detail pages, dialogs, forms, and maps.

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

No run has been recorded yet. Until one is, this project has automated-scan results rather than Section 508 evidence, and should be described that way.

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
