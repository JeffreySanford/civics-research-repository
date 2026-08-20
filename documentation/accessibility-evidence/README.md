# Accessibility Evidence

Dated evidence artifacts for each release or evidence-backed demo. The checklists themselves live in [../accessibility-manual-evidence.md](../accessibility-manual-evidence.md); this directory holds completed automated and manual runs.

```text
accessibility-evidence/
├── automated-scans/      Latest machine-readable automated run plus saved scan output
├── keyboard-tests/       Completed Checklist 1 runs
├── screen-reader-notes/  Completed NVDA and JAWS runs, with AT versions
└── release-checklists/   One dated summary per recorded evidence run
```

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

Manual evidence is deliberately preserved unchanged. `evidence:refresh` never marks the keyboard, NVDA, JAWS, map-equivalence, or cognitive checklists as passed.

Regenerate the manifest from the latest recorded evidence without running tests:

```bash
pnpm run evidence:generate
```

Verify that the committed manifest matches the latest evidence record:

```bash
pnpm run evidence:check
```

`evidence:check` is part of `quality:all`, so generated evidence drift fails the quality gate in the same way as OpenAPI or fixture drift.

The checked-in `automated-scans/latest.json` initially migrates the 2026-08-12 baseline. Run `pnpm run evidence:refresh` on the current commit to replace it with fresh evidence for today's platform.

## Manual evidence remains required

Automated evidence is reproducible and useful, but it does not establish screen-reader usability or complete Section 508 conformance. Before presenting a release as evidence-backed, record the applicable keyboard, NVDA/JAWS, and map-equivalence checks described in `documentation/accessibility-manual-evidence.md`.
