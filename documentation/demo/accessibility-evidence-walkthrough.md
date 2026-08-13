# Accessibility Evidence Walkthrough

How automated and manual Section 508 / WCAG evidence is produced, where it lives, and how to present it in an interview. The `/evidence` route summarizes status; this document is the spoken companion.

## What exists today

| Layer                                        | Status                                                               | Artifact                                                                                                          |
| -------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Automated axe + structural scans             | **Recorded**                                                         | [2026-08-12-automated-baseline.md](../accessibility-evidence/release-checklists/2026-08-12-automated-baseline.md) |
| Demo storyboard (workflows + failure states) | **Recorded**                                                         | Same baseline; 72 checks in `storyboard.spec.ts`                                                                  |
| Keyboard-only checklist (K1–K31)             | Preconditions automated; **end-to-end run not recorded**             | [accessibility-manual-evidence.md](../accessibility-manual-evidence.md)                                           |
| NVDA smoke test (N1–N20)                     | **Not run**                                                          | Checklist 2                                                                                                       |
| JAWS smoke test (J1–J8)                      | **Not run**                                                          | Checklist 3                                                                                                       |
| Map equivalence (M1–M15)                     | Preconditions automated; **M12 (map-to-list) not manually verified** | Checklist 4                                                                                                       |
| Cognitive review (C1–C9)                     | **Not run**                                                          | Checklist 5                                                                                                       |

**Honest claim:** The project has repeatable automated scans plus a structural baseline. It does **not** yet have Section 508 evidence in the program-office sense until assistive-technology runs are recorded.

## Automated evidence

### axe-core scans (`@wcag`, `@section508`)

`apps/discovery-ui-e2e/src/accessibility.spec.ts` runs axe across six routes with tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, and `best-practice`:

| Route                                    | Heading verified                                 |
| ---------------------------------------- | ------------------------------------------------ |
| `/`                                      | Census geospatial discovery with repository sync |
| `/discovery`                             | Find research objects                            |
| `/datasets/tiger-line-north-dakota-2025` | 2025 TIGER/Line - Census Tracts - North Dakota   |
| `/maps`                                  | MapLibre geospatial workspace                    |
| `/admin/sync`                            | Repository sync                                  |
| `/evidence`                              | WCAG and Section 508 status                      |

Both `@wcag` and `@section508` grep tags select the same axe tests today; the duplicate tags keep release reporting explicit for federal reviewers.

### Structural accessibility (`@wcag`, `@section508`)

`accessibility-structure.spec.ts` asserts 39 machine-checkable preconditions per route and globally:

- Distinct page titles, one `h1`, unbroken heading outline
- Banner, navigation, and main landmarks
- No positive `tabindex`; every control has a human accessible name
- Skip link first in tab order, targeting `#main-content`
- Facet `aria-pressed`, tab `aria-selected`, map checkbox labels
- Feature list completeness (place and magnitude for every overlay event)
- Map region and legend semantics; selection announced via `role="status"`
- Failed sync exposed as `role="alert"`

### Reflow and contrast (`@wcag`, `@section508`)

`reflow-contrast.spec.ts` checks 320px reflow without horizontal scroll, 200% zoom operability on discovery, and AA color contrast per route.

### Demo storyboard (`@storyboard`)

`storyboard.spec.ts` and `failure-states.spec.ts` cover primary demo workflows end to end:

- Navigation across all six routes
- Search, facets, keyboard-operable results
- Dataset detail tabs, files, citation, map link
- Map layer toggles, area switching, overlay stale/error states
- Admin sync dry-run, diff, apply
- List-to-map feature selection and URL restore
- Repository API failure states and fixture disclosure

### Map layer tests (`@maps`)

`map-layers.spec.ts` and `map-layer-visibility.spec.ts` verify MapLibre visibility stays synchronized with toggles, legend, and URL. These are **not** included in `pnpm run wcag` or `pnpm run section508`; run them separately when demonstrating map correctness:

```bash
pnpm exec playwright test --config=apps/discovery-ui-e2e/playwright.config.mts --grep @maps
```

## Commands to regenerate evidence

| Command                      | What it runs                                                                      |
| ---------------------------- | --------------------------------------------------------------------------------- |
| `pnpm run wcag`              | All `@wcag`-tagged Playwright tests (starts dev server on :4300 if needed)        |
| `pnpm run section508`        | All `@section508`-tagged tests (same suite as wcag today)                         |
| `pnpm run wcag:report`       | `@wcag` with list reporter (console output)                                       |
| `pnpm run section508:report` | `@section508` with list reporter                                                  |
| `pnpm run accessibility`     | Nx `accessibility` target across projects (discovery-ui-e2e `@wcag`)              |
| `pnpm run storyboard`        | `@storyboard` demo workflow checks                                                |
| `pnpm run e2e:reports`       | storyboard + wcag + section508 against **one** dev server (used by `quality:all`) |
| `pnpm run quality:all`       | Full gate: format, OpenAPI, lint, unit tests, build, then `e2e:reports`           |

Start the live stack with `pnpm run start:all` before manual checklist runs against `http://localhost:4200`. Playwright suites use `http://localhost:4300` with mocked API responses unless you override `BASE_URL`.

## Where reports land

Playwright writes transient artifacts to the repository root (both git-ignored):

- `test-results/` — per-test output, traces on retry
- `playwright-report/` — HTML report when configured

Console reporters (`wcag:report`, `section508:report`, `e2e:reports`) print pass/fail counts to stdout; they do not auto-commit results.

Committed evidence belongs under `documentation/accessibility-evidence/`:

```text
documentation/accessibility-evidence/
├── automated-scans/      Saved wcag:report and section508:report output (optional)
├── keyboard-tests/       Completed Checklist 1 runs
├── screen-reader-notes/  Completed NVDA and JAWS runs
└── release-checklists/   Dated summaries (e.g. 2026-08-12-automated-baseline.md)
```

To capture a release baseline, run the reports, then save stdout or summarize results in a dated file under `release-checklists/` using the template in [accessibility-manual-evidence.md](../accessibility-manual-evidence.md#recording-results).

## Manual evidence still required

Automated scans prove the **absence of detectable violations** and settle structural preconditions. They do not prove usability with assistive technology—especially for the map.

| Checklist           | Focus                                 | Priority open items                                    |
| ------------------- | ------------------------------------- | ------------------------------------------------------ |
| 1 — Keyboard only   | Mouse-free end-to-end pass            | Full K1–K31 run not recorded                           |
| 2 — NVDA            | Browse mode, announcements, landmarks | **Not run**                                            |
| 3 — JAWS            | NVDA set plus JAWS-specific checks    | **Not run** (license)                                  |
| 4 — Map equivalence | List–map parity, non-color legend     | **M12 map-to-list focus** — highest-value manual check |
| 5 — Cognitive       | Task completion without confusion     | Judgement only                                         |

Executable checklists: [accessibility-manual-evidence.md](../accessibility-manual-evidence.md).

Three findings from the automated baseline still need human resolution:

1. **MapLibre canvas tab stop** — feature for keyboard pan/zoom, open question for screen-reader users (N16).
2. **No `contentinfo` landmark** — not a violation, but sparse region navigation.
3. **Map-to-list selection** — implemented, cannot be asserted automatically (Checklist 4, M12).

## Demo stop — `/evidence` route

**URL:** http://localhost:4200/evidence

**Timing:** ~2 minutes; often the closing stop after maps and admin sync.

**Show:**

1. Navigate via primary nav **Evidence** or the home-page card.
2. Heading **WCAG and Section 508 status** with three bullets: automated scans, manual review, next UI step.
3. Explain that automated scans run in CI via `quality:all`; manual checklists exist but are not yet recorded.

**Say:**

> This route is the evidence hub. Today it describes the workflow—we run axe and Playwright on every release, and we have executable NVDA, JAWS, and keyboard checklists. The automated baseline from August 2026 passed 57 axe checks per browser and 72 storyboard checks, but no assistive technology has been operated yet. Passing axe is necessary, not sufficient, for Section 508—especially for the map, where the accessible feature list is the conformance path.

Point reviewers to `documentation/accessibility-evidence/release-checklists/` for the dated baseline and `documentation/accessibility-manual-evidence.md` for what remains.

## Gap honesty

- **axe ≠ full 508 conformance.** axe detects many WCAG violations; it cannot judge whether a screen-reader user can complete a workflow, whether map information is equivalent, or whether focus management feels coherent.
- **Canvas maps need a non-map equivalent.** The feature list satisfies the structural requirement; manual Checklist 4 confirms equivalence in practice.
- **Safari keyboard behavior.** WebKit does not tab to links unless full keyboard access is enabled in Safari preferences—a platform note, not an app defect.
- **Fixture vs repository paths.** Automated tests mock the API; manual evidence should eventually include a repository-backed run with `resultSource: REPOSITORY`.

See also [accessibility-508-wcag.md](../accessibility-508-wcag.md) for the engineering plan and [tradeoffs.md](tradeoffs.md) for what the demo deliberately omits.
