# PR 1 Description Draft

## Summary

This PR documents the planned mobile-first Census/Civics frontend architecture.

It proposes a new Angular app under `apps/census-mobile-frontend` that runs beside the existing Angular app, uses port `4300` locally, and consumes the existing backend through `repository-api-client` rather than introducing a second backend or duplicate search client. It also defines the first implementation sequence, module-based Angular direction, hybrid Signals + RxJS/NgRx state boundaries, validation strategy, accessibility expectations, and a visualization/engagement plan.

No runtime app or backend code changes are included.

## Why

The existing Angular application should remain functional while the mobile-first Census discovery experience is designed, scaffolded, and validated. A parallel frontend app gives the project a clean mobile-first surface without forcing broad changes into the current app.

The new frontend should demonstrate:

- Angular/Nx frontend architecture
- module-based Angular composition for the new app
- Angular Signals used appropriately for local synchronous UI state
- NgRx/RxJS for asynchronous/shared search state and effects
- mobile-first responsive design
- federal accessibility expectations
- direct reuse of the generated repository API client and types
- real API-backed search behavior
- Storybook-driven component review
- targeted infographics and visual summaries that improve search comprehension

## What Changed

- Added mobile-first planning index.
- Added architecture plan for a parallel frontend app.
- Added ADR for the parallel mobile-first app decision.
- Added experience and engagement strategy.
- Added infographics and data visualization plan.
- Added implementation plan.
- Added backlog.
- Added validation plan.
- Added PR 1 baseline checklist and readiness note.

## Architecture Decision

Create:

```text
apps/census-mobile-frontend
```

Keep:

```text
apps/discovery-ui
```

Development ports:

```text
apps/discovery-ui                 4200
apps/census-mobile-frontend       4300
discovery-ui storybook            4400
mobile storybook                  4500
```

The new app will reuse `RepositorySearchApi`, `REPOSITORY_API_BASE_URL`, and generated search types from `repository-api-client`. It will not introduce a second search backend, duplicate index, duplicate API-contract/client library, or client-side corpus search.

## Angular State Direction

Use the right primitive for the state being modeled:

- NgRx/RxJS for search requests, effects, cancellation, results, facets, loading/error state, pagination, and URL-linked state.
- Angular Signals for appropriate local synchronous UI state such as filter-drawer open/close and compact summary disclosure state.
- `computed()` for small local derivations when their source state is already signal-based.
- Do not independently store the same source of truth in both NgRx and Signals.

The new app should prefer module-based Angular composition (`standalone=false`); using Signals does not require adopting standalone components.

## Visualization Direction

The plan allows infographics and data visualizations where they support the search workflow:

- result type mix
- top programs
- year range/distribution
- source-system mix
- geography coverage where supported by authoritative aggregate data
- provenance indicators
- filter impact summaries

The plan explicitly avoids a dashboard-first mobile layout, decorative infographics, and client-side analysis beyond trustworthy bounded API data. A paged result slice must not be presented as a corpus-wide distribution, and every visualization requires a text/table equivalent.

## Baseline Checks

| Check                           | Current Evidence                                                                |
| ------------------------------- | ------------------------------------------------------------------------------- |
| `pnpm install`                  | User reported complete on 2026-09-11                                            |
| `pnpm approve-builds`           | User reported complete; setup-only package change excluded from PR 1            |
| `pnpm start:all`                | User reported reaching the expected running state                               |
| Existing `discovery-ui` project | Repository-verified                                                             |
| Existing app port `4200`        | Repository-verified                                                             |
| Existing Storybook port `4400`  | Repository-verified                                                             |
| Repository API base URL         | Repository-verified default `http://localhost:8080/api`                         |
| Existing search client/types    | Repository-verified `RepositorySearchApi` and generated search contract surface |

User-reported local checks are recorded as such rather than represented as independently reproduced CI evidence.

## Validation

PR 1 is documentation-only. Repository CI still applies, including formatting. Runtime implementation and app-specific build/test evidence begin with PR 2.

## Follow-Up

PR 2 should scaffold `apps/census-mobile-frontend` with:

- module-based Angular generation
- routing
- SCSS
- repository-standard lint/test/build targets
- serve port `4300`
- existing `repository-api-client` importability
- minimal mobile discovery shell

PR 3 should then add the shared search-domain NgRx/RxJS foundation plus appropriate component-local Signal state.
