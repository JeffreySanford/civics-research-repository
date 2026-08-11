# Agent Instructions

These instructions apply to work inside `civics-research-repository`.

## Product Direction

Civics Research Repository is an independent federal open-science reference implementation. The demo combines:

- Nx workspace orchestration.
- Angular 22 public discovery UI.
- Angular Material 22 using Material Design 3 patterns.
- DSpace repository APIs.
- Apache Solr discovery, facets, and relevance.
- PostgreSQL persistence.
- Census public datasets.
- USGS map overlays.
- WCAG and Section 508 evidence.

## Engineering Defaults

- Use `pnpm nx` for workspace tasks.
- Use Nx generators before hand-creating Angular apps, libraries, components, or e2e projects.
- Use standalone Angular APIs by default.
- Keep route-level code SSR-safe even if the first app is client-rendered.
- Use Angular Material components when they provide correct semantics and keyboard behavior.
- Put shared design tokens and Material overrides in a shared styles library once generated.
- Keep repository/search models typed and isolated from UI components.
- Treat map interactions as progressive enhancement over accessible tabular data.

## Accessibility Defaults

- Target Section 508 baseline and WCAG 2.1/2.2 AA practices where practical.
- Add automated checks for every public workflow.
- Use axe-core and Playwright as the first automated scanning layer.
- Do not treat axe passing as full conformance.
- Keep keyboard, focus, contrast, reflow, and screen-reader behavior explicit in acceptance criteria.
- Every map visualization must have an accessible non-map representation.

## Planned Nx Projects

Initial app and libraries should be generated in this shape:

```text
apps/discovery-ui
apps/discovery-ui-e2e
libs/shared/ui
libs/shared/material
libs/shared/accessibility
libs/repository/api-client
libs/repository/models
libs/maps/visualization
libs/maps/usgs-overlays
libs/data-sources/census
libs/data-sources/usgs
tools/harvester
```

## Verification Expectations

Before finishing implementation work, run the narrowest meaningful Nx checks:

```bash
pnpm nx format:check
pnpm nx affected -t lint,test,build
pnpm nx affected -t e2e,accessibility
```

If the workspace is not generated yet, verify metadata with:

```bash
pnpm install --lockfile-only
pnpm nx --version
```

## Git Hygiene

- Keep generated app code, platform documentation, and planning changes in separate commits when practical.
- Do not check large public datasets into git.
- Store generated accessibility evidence under `documentation/accessibility-evidence/` only when it is small and useful for review.
