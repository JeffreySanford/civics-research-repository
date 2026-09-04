# Accessibility Evidence

Dated evidence artifacts for each release or evidence-backed demo. The canonical checklist lives in [../accessibility-manual-evidence.md](../accessibility-manual-evidence.md); this directory holds completed automated and manual runs plus the reusable procedure/template used to record human evidence.

Manual-run resources:

- [Manual run procedure](manual-run-procedure.md) — commit-bound execution order for keyboard, NVDA, JAWS, Maps, Evidence, Search Lab and WCAG 2.2 manual checks.
- [Manual run template](manual-run-template.md) — copy to a dated evidence record; all results begin as `Not run` and require human execution.

```text
accessibility-evidence/
├── automated-scans/      Latest machine-readable automated run plus saved scan output
├── keyboard-tests/       Completed keyboard-only runs
├── screen-reader-notes/  Completed NVDA and JAWS runs, with AT/browser versions
├── release-checklists/   One dated summary per recorded evidence run
├── manual-run-procedure.md
└── manual-run-template.md
```

The evidence directories may remain absent/empty until a real manual run is recorded. Do not create placeholder `Pass` files merely to populate the structure.

## Refreshing the evidence manifest

The API serves `apps/repository-api/src/main/resources/accessibility-evidence-manifest.json`. That file is generated from the latest recorded automated evidence plus the existing manual-review statuses; do not update its automated entries by hand.

Run the full automated accessibility evidence and record a new baseline:

```bash
pnpm run evidence:refresh
```

The command runs:

- `pnpm run a11y:components`
- `pnpm run e2e:reports` (storyboard, WCAG, and Section 508 tagged browser suites)

Only after both commands pass does it update `automated-scans/latest.json`, regenerate the API manifest, and write a dated automated release record. A failing run leaves the previous known-good evidence untouched.

Manual evidence is deliberately preserved unchanged. `evidence:refresh` never marks keyboard, NVDA, JAWS, map-equivalence, Evidence, Search Lab or cognitive review as passed.

Regenerate the manifest from the latest recorded evidence without running tests:

```bash
pnpm run evidence:generate
```

Verify that the committed manifest matches the latest evidence record:

```bash
pnpm run evidence:check
```

`evidence:check` is part of `quality:all`, so generated evidence drift fails the quality gate in the same way as OpenAPI or fixture drift.

## Manual evidence recording rule

Every manual result is tied to:

- application commit SHA;
- date/tester;
- operating system;
- browser/version;
- assistive technology/version where applicable;
- viewport/zoom where relevant;
- `Pass`, `Fail`, `N/A` or `Not run` per check;
- issue/remediation/rerun evidence for failures.

“Mostly works” is a failure with an observation. An unavailable JAWS license/environment is `N/A` with reason, never an implied pass.

The current mature manual scope explicitly includes:

- Discovery search/facets/deep navigation;
- research-object detail/provenance;
- Maps visual/nonvisual equivalence and MapLibre focus path;
- Admin status/workflow behavior;
- Evidence, including certified C2 dense tables and scientific claim boundary;
- Search Lab form/status/projection-parity/two-engine result workflow;
- WCAG 2.2 focus-not-obscured, dragging-alternative and target-size checks.

## Safari keyboard evidence

The Playwright WebKit project intentionally does **not** treat raw `Tab` / `Shift+Tab` traversal as automated Safari evidence. Safari keyboard traversal depends on the macOS/Safari Full Keyboard Access (“Press Tab to highlight each item”) preference, and Playwright WebKit cannot reliably reproduce that user setting.

WebKit still runs deterministic browser-semantic coverage: accessible names/descriptions, axe, structure, contrast, reflow and supported interactions. Raw K1/K2 traversal remains a manual Safari check. Record the macOS version, Safari version and Full Keyboard Access/Tab-highlighting state so another reviewer can reproduce the result.

A Chromium or Firefox Tab pass must never be used as a proxy for Safari keyboard evidence.

## Forced colors

Forced-colors/high-contrast checks are implemented in Chromium automation. Firefox/WebKit do not emulate the media feature reliably in this suite, so those specific automated cases are skipped rather than reported as passes.

## Manual evidence remains required

Automated evidence is reproducible and useful, but it does not establish screen-reader usability or complete Section 508 conformance. Before presenting a release as manually evidence-backed, record the applicable keyboard, NVDA/JAWS, Maps, Evidence and Search Lab checks described by the procedure/template.
