# Accessibility Evidence

Dated evidence artifacts for each release or evidence-backed demo. The checklists themselves live in [../accessibility-manual-evidence.md](../accessibility-manual-evidence.md); this directory holds the completed runs.

```text
accessibility-evidence/
├── automated-scans/      Saved output from wcag:report and section508:report
├── keyboard-tests/       Completed Checklist 1 runs
├── screen-reader-notes/  Completed NVDA and JAWS runs, with AT versions
└── release-checklists/   One dated summary per release: YYYY-MM-DD-<commit-sha>.md
```

No runs have been recorded yet. The first completed run is a prerequisite for presenting this project as Section 508 evidence rather than as automated-scan results — see the Known Limitations table in the checklist document.

Automated evidence is reproducible on demand and does not need to be committed except when capturing a specific release:

```bash
pnpm run wcag:report
```

```bash
pnpm run section508:report
```
