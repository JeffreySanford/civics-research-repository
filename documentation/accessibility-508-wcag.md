# Section 508 and WCAG Plan

## Accessibility Position

Automation provides repeatable release evidence, but it does not replace manual assistive-technology testing. The project should treat accessibility evidence as part of the engineering artifact, especially for search, facets, dataset detail pages, dialogs, forms, and maps.

## Baseline

Federal Section 508 currently incorporates WCAG 2.0 Level A and AA. The project should target WCAG 2.1/2.2 AA practices where practical while documenting the required 508 baseline separately.

## Automated Evidence

Planned automated checks:

- axe-core accessibility scans.
- Keyboard interaction tests.
- Focus-visible verification.
- Dialog focus trapping and restoration tests.
- Form label and error association checks.
- Color contrast checks.
- Responsive reflow checks at high zoom.
- Forced-colors or high-contrast mode smoke tests.

## Manual Evidence

Planned manual checks:

- Keyboard-only navigation.
- NVDA smoke test.
- JAWS smoke test where available.
- Screen-reader announcement review for status changes.
- Map feature-list equivalence review.
- Cognitive workflow review for search, filtering, and download.

## Key UI Requirements

- All controls are reachable and operable by keyboard.
- Focus order follows the visual and workflow order.
- Focus indicators are visible.
- Search filters communicate selected state and result count changes.
- Dataset tabs expose correct semantics.
- Download and citation actions have clear accessible names.
- Map controls have accessible labels.
- Map data has a non-map representation.
- Errors identify affected fields and suggest correction.
- Status messages are announced without stealing focus.

## Evidence Folder Direction

When implementation begins, create:

```text
documentation/accessibility-evidence/
├── automated-scans/
├── keyboard-tests/
├── screen-reader-notes/
└── release-checklists/
```
