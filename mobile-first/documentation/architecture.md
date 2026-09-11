# Mobile-First Census Frontend Architecture

Status: proposed

## Summary

The mobile-first Census frontend should be a new Angular application in the Nx workspace, located at `apps/census-mobile-frontend`. It should run independently from the existing `apps/discovery-ui` application while consuming the same backend API and the repository's existing generated API-client library.

This gives the project a clean surface for mobile-first federal search UX while preserving the existing application and avoiding a second frontend data-access stack.

## Target Workspace Shape

```text
apps/
  discovery-ui/
    Existing Angular application.

  census-mobile-frontend/
    New mobile-first Census/Civics discovery app.

libs/
  repository/api-client/
    Existing generated OpenAPI types, RepositorySearchApi,
    search models, and REPOSITORY_API_BASE_URL token.

  census-ui/
    Optional future shared presentational components only if
    real reuse emerges across both frontends.

  ui-theme/
    Existing theme library, reused where it supports the mobile design.
```

The boundary should remain:

- apps own routing, page composition, product-specific UX, and app-level state
- `repository-api-client` remains the shared frontend contract and HTTP boundary
- a future UI library is created only after components are genuinely shared
- backend owns search semantics, filtering, pagination, provenance, and result counts

Do not create parallel `census-api-contracts` or `census-search-client` libraries in the initial implementation. The repository already exposes `SearchQuery`, `SearchResponse`, `SearchResult`, `FacetGroup`, `FacetValue`, `RepositorySearchApi`, and `REPOSITORY_API_BASE_URL` from `repository-api-client`.

## Runtime Model

```text
Existing app on 4200
        |
        | repository-api-client
        v
Existing backend/API on localhost:8080/api
        ^
        | repository-api-client
        |
Mobile-first app on 4300
```

Both frontends should be able to run at the same time in development.

The new app should inject and reuse the same `RepositorySearchApi` and `REPOSITORY_API_BASE_URL` configuration as `discovery-ui`. The existing token defaults to `http://localhost:8080/api`, so the mobile app should reuse that API boundary rather than creating a proxy or gateway solely for the new frontend.

## Angular Application Shape

The new app should deliberately remain independent from the existing app shell while staying conventional for this workspace.

Initial preferences:

- Angular application under `apps/census-mobile-frontend`
- SCSS
- routing enabled
- module-based Angular composition (`standalone=false`)
- Vitest/repository-standard Angular unit-test target
- ESLint
- serve port `4300`
- Storybook port `4500`
- no new backend service

The existing `discovery-ui` can remain standalone-based. The two apps do not need identical bootstrap style to share the API client or neutral libraries.

## Search Boundary

The mobile app should send search intent to the existing API:

```text
q=population migration
program=ACS
sourceSystem=CENSUS
vintageYear=2025
page=0
pageSize=25
```

The API remains authoritative for:

- query parsing
- facet counts
- paging and cursors
- provenance
- source-system behavior
- result totals
- authorization or restricted-result handling

The mobile app is responsible for:

- search form UX
- active-filter display
- mobile filter drawer
- result cards
- loading, empty, and error states
- accessible focus behavior
- URL query state
- responsive layout

## State Management

Use Observable-first Angular state management. Do not introduce Angular Signals for this app's search or UI state.

| Concern                        | Recommended Tool                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| HTTP search requests           | `RepositorySearchApi` inside NgRx effects                                                         |
| Search query/results/facets    | NgRx store, reducers, selectors, effects                                                          |
| URL query synchronization      | Angular Router + NgRx/RxJS                                                                        |
| Request cancellation           | RxJS `switchMap` in effects                                                                       |
| Filter drawer/open-close state | RxJS/component observable state; promote to NgRx only if cross-component coordination warrants it |
| Display mode and ephemeral UI  | RxJS/component observable state                                                                   |
| Layout responsiveness          | CSS first; CDK `BreakpointObserver` only for behavior changes                                     |

Starting with NgRx for the search workflow is justified here because query text, repeatable facets, pagination, URL state, loading/error state, and request cancellation already form one coherent state machine. Keep purely local presentation state local rather than putting every interaction in the global store.

## Initial Search State

A first-pass feature state can stay small:

```text
query
selectedPrograms[]
publisher
sourceSystem
geography
contentType
vintageYear
page
pageSize
results[]
facets[]
totalResults
loading
error
```

Selectors should derive:

- active-filter count
- active-filter chips
- current result range
- whether previous/next pagination is available
- compact search-summary inputs from server-returned facets

Effects should own API orchestration and cancellation. Components should not manually coordinate competing search subscriptions.

## Component Model

Initial components:

| Component                         | Responsibility                                      |
| --------------------------------- | --------------------------------------------------- |
| `MobileDiscoveryPage`             | Route container and feature composition             |
| `DiscoverySearchBarComponent`     | Search input, submit, clear                         |
| `DiscoveryFilterTriggerComponent` | Mobile filter button and active count               |
| `DiscoveryFiltersComponent`       | Facet groups and selected facet state               |
| `DiscoveryActiveFiltersComponent` | Removable selected-filter chips                     |
| `DiscoveryResultsHeaderComponent` | Result count, range, loading status                 |
| `ResearchResultCardComponent`     | One accessible research result                      |
| `DiscoveryResultsComponent`       | Result collection and empty/error/loading states    |
| `DiscoveryPaginationComponent`    | Previous/current/next controls and focus behavior   |
| `DiscoverySearchSummaryComponent` | Optional compact server-facet visualization summary |
| `DiscoveryShellComponent`         | Drawer/sidebar layout composition                   |

Keep presentational components input/output driven where possible so Storybook can render them without booting the full search workflow.

## Responsive Behavior

The design target is mobile-first:

- 320px: complete reflow without horizontal document scrolling
- 390px/430px: primary phone widths
- 768px: tablet portrait
- 1024px: tablet landscape and possible persistent filters
- 1440px: desktop review

The filter experience should start as an accessible drawer on phones. At larger widths it can progressively become a persistent side panel using the same facet component.

The DOM and component hierarchy should remain stable across breakpoints where practical. CSS should change presentation before TypeScript changes behavior.

## Visualization Boundary

Visualizations are secondary search aids, not a dashboard layer.

The first implementation may visualize only bounded data already returned by the search response or its server-provided facets, for example:

- result type mix
- top programs
- year distribution/range
- source-system mix
- filter impact before/after a refinement

Do not fetch the corpus separately to build charts. Do not calculate a misleading global distribution from one paged result slice. If the API does not provide sufficient aggregate data, the visualization should be omitted or labeled explicitly as page-local.

Every visual summary requires a text/table equivalent and must remain useful with color disabled.

## Accessibility Architecture

Accessibility should be built into the component contracts:

- filter drawer traps focus while open
- Escape closes the drawer
- focus returns to the Filters button on close
- search status uses a polite live region
- search errors use alert semantics
- active-filter remove controls have descriptive accessible names
- pagination is wrapped in a named navigation landmark
- page/result replacement moves focus to the results heading when appropriate
- selected facets use native checkbox semantics or a documented equivalent
- touch controls meet target-size expectations
- forced colors do not rely on color-only states
- reduced motion is honored
- charts have equivalent text/table content and do not become the only source of information

## Storybook Role

Storybook should be the main workspace for mobile-first component design.

Recommended story groups:

- result card: normal, long title, long metadata, restricted, external source, missing optional metadata
- filters: no selection, one selection, multiple selections, long facet names, large counts, empty facets
- results: loading, populated, empty, failure, one result, many results
- search summary: text-only, type mix, programs, year range, missing aggregate data
- full shell: 320px, phone, tablet, desktop, filters open

Storybook should prove component states. Browser E2E should prove the assembled app and real API boundary.

## Non-Goals

- No second backend.
- No duplicate search index.
- No duplicate API-contract library.
- No client-side scanning/filtering of the full corpus.
- No separate mobile-only data model unless the API deliberately adds one.
- No rewrite of the existing Angular app as a prerequisite.
- No requirement to converge the two frontends before the mobile-first approach has evidence.
