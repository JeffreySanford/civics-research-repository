# Mobile-First Census Frontend Implementation Plan

Status: proposed

## Phase 0: Confirm Baseline

Purpose: make sure the workspace can safely accept a second Angular app.

Tasks:

- Install dependencies with `pnpm install` if `node_modules` is absent.
- Sync the local branch with `origin/main`.
- Confirm current `apps/discovery-ui` serve/build/test targets.
- Confirm the backend/API startup path and local API port.
- Confirm the generated `repository-api-client` search surface and path alias.
- Confirm the generated app name, route title, and npm scope conventions.
- Confirm Storybook ports and whether any Storybook configuration can be reused safely.

Deliverable:

- Baseline note showing existing app still runs before new app work begins.
- PR 1 documentation set covering architecture, UX engagement, visualization strategy, validation, and scaffold readiness.

## Phase 0.5: Experience Blueprint

Purpose: define the first mobile experience deeply enough that scaffolding does not produce an empty shell.

Tasks:

- Define the first three user journeys.
- Decide which information graphics belong in the search flow.
- Decide which data visualizations belong in result inspection or summary surfaces.
- Define which visual elements are fixture-driven for Storybook and which require live API data.
- Identify accessibility and performance constraints for every visualization.
- Keep all first-pass visual summaries bounded to server-provided facets or clearly labeled page-local data.

Deliverable:

- Experience and visualization plans are ready before PR 2 scaffolding starts.

## Phase 1: Scaffold the New App

Purpose: create the isolated mobile-first frontend without touching the current app behavior.

Proposed app:

```text
apps/census-mobile-frontend
```

Expected configuration:

- Angular application generated through Nx.
- Module-based Angular composition (`standalone=false`).
- Routing enabled.
- SCSS styling.
- Repository-standard Angular/Vitest unit-test target.
- ESLint.
- Serve port set to `4300`.
- Storybook reserved for port `4500` but added only when the first presentational components exist.
- Existing `repository-api-client` available through the workspace path alias.
- Default route renders a minimal mobile discovery shell.

PR 2 scope guardrail:

- no search feature implementation yet
- no duplicate API types
- no new backend
- no new shared library unless the generator requires one
- no modification to `apps/discovery-ui` behavior

Deliverable:

- New app builds/tests/lints independently.
- New app boots on `4300`.
- Existing app remains unchanged and available on `4200`.

## Phase 2: Existing API Client Integration

Purpose: prove the new app can consume the real repository search boundary before building a large UI.

Reuse directly from `repository-api-client`:

- `RepositorySearchApi`
- `REPOSITORY_API_BASE_URL`
- `SearchQuery`
- `SearchResponse`
- `SearchResult`
- `FacetGroup`
- `FacetValue`
- generated OpenAPI schema types

Tasks:

- Import the existing client into the new app.
- Provide `HttpClient` through the module-based app configuration.
- Use the existing API base URL token rather than creating a mobile-specific gateway.
- Add a small repository-safe search fixture for component/Storybook work only if an existing suitable fixture cannot be reused.
- Add a focused API-client integration test around search request orchestration; do not duplicate tests already owned by the shared library.

Deliverable:

- The new app can issue a typed search request against the same backend contract as `discovery-ui`.

## Phase 3: NgRx Search Foundation

Purpose: establish one Observable-first state machine for query, facets, results, pagination, URL state, and cancellation.

Initial state:

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

Tasks:

- Add feature actions for query/filter/page changes and search lifecycle.
- Add reducer state with immutable transitions.
- Add selectors for active filters, result range, paging availability, and summary inputs.
- Add an effect using `RepositorySearchApi` and RxJS `switchMap` so stale searches are cancelled.
- Synchronize shareable search state with Router query parameters.
- Keep drawer/open-close state local unless cross-component coordination demonstrates that it belongs in NgRx.
- Do not introduce Angular Signals.

Deliverable:

- A deterministic, testable search state foundation that can drive both real API behavior and fixture-backed component stories.

## Phase 4: Mobile Discovery Vertical Slice

Purpose: build the first complete mobile-first workflow.

Scope:

- search field
- result count
- loading state
- active filters
- result cards
- filter trigger
- accessible filter drawer
- facet selection
- pagination controls

First visual target:

```text
320px viewport
search -> results -> filters drawer -> select facet -> active chip -> close drawer
```

Deliverable:

- Search UI works with realistic fixture data at 320px, 390px, 430px, 768px, 1024px, and desktop widths.

## Phase 5: Live Search Integration

Purpose: connect the completed vertical slice to the existing API without changing search semantics in the browser.

Tasks:

- Drive `RepositorySearchApi.searchResearchObjects` from the NgRx effect.
- Serialize query text, repeatable program filters, source, publisher, geography, content type, year, page, and page size through the existing `SearchQuery` contract.
- Preserve URL query state.
- Render backend result counts and facet counts without client-side corpus filtering.
- Preserve loading, error, cancellation, and retry behavior.
- Decide whether cursor paging is useful only after normal page-based behavior is complete.

Deliverable:

- Mobile app performs real search through the existing repository backend.

## Phase 6: Search Summary and Data Visualization

Purpose: improve comprehension without turning search into a dashboard.

First candidates:

- result-type mix
- top programs
- year distribution/range
- source-system mix
- filter-impact summary

Rules:

- Use server-provided facet/aggregate data when available.
- Do not infer corpus-wide distributions from one paged result slice.
- If only page-local data are available, label the visualization as page-local or omit it.
- Every chart has an equivalent text/table representation.
- Color is never the sole encoding.
- Summary content is secondary to the result list and may be collapsed on small screens.

Deliverable:

- One useful, accessible summary visualization backed by trustworthy data, plus textual equivalence.

## Phase 7: Storybook Matrix

Purpose: make responsive and accessibility states reviewable without running the whole app.

Viewport presets:

| Name | Width |
| --- | ---: |
| Reflow minimum | 320px |
| Phone | 390px |
| Large phone | 430px |
| Tablet portrait | 768px |
| Tablet landscape | 1024px |
| Desktop | 1440px |

Story coverage:

- `ResearchResultCard`
- `DiscoveryFilters`
- `DiscoveryResults`
- `DiscoveryPagination`
- `DiscoverySearchSummary`
- `DiscoveryShell`
- full mobile discovery composition

Deliverable:

- Storybook on port `4500` demonstrates key mobile/tablet/desktop and error/loading/empty states.

## Phase 8: Accessibility and Browser Evidence

Purpose: prove the assembled app is operable.

Tasks:

- Keyboard-only search and filter drawer flow.
- Focus trap and focus return.
- Escape-to-close behavior.
- Results heading focus after page replacement where appropriate.
- Live-region announcements for result status.
- 320px reflow test.
- Reduced-motion and forced-colors checks.
- Error/empty/loading journeys.
- Touch-target review.
- Chart/text-equivalent parity where visualization is present.
- Storybook axe coverage for component states.
- Playwright/axe coverage for assembled journeys.

Deliverable:

- Automated evidence plus clearly separated manual AT/reflow evidence recorded through the validation plan.

## Phase 9: Convergence Decision

Purpose: decide whether the mobile-first app remains a separate product shell or informs a refactor of the existing frontend.

Decision points:

- Does the mobile app duplicate too much route/app-shell logic?
- Is `repository-api-client` sufficient as the shared data boundary?
- Does the existing app need the same Discovery UX?
- Which presentational components have proved genuinely reusable?
- Should those components move into a shared `libs/census-ui` library?
- Is there appetite to replace or merge the old discovery surface?

Deliverable:

- Follow-up ADR: keep separate, converge, or promote shared UI components.

## Proposed PR Sequence

Keep implementation slices small enough that regressions are obvious:

1. **PR 1 — Documentation and architecture**
   - current planning set
   - no runtime code
2. **PR 2 — App scaffold**
   - `apps/census-mobile-frontend`
   - module-based Angular, SCSS, routing, lint/test/build
   - serve port `4300`
3. **PR 3 — API + NgRx foundation**
   - reuse `repository-api-client`
   - search feature actions/reducer/selectors/effects
   - URL query-state contract
4. **PR 4 — Mobile search vertical slice**
   - search/results/filter drawer/pagination
   - 320px-first layout
5. **PR 5 — Storybook responsive matrix**
   - port `4500`
   - component state and axe coverage
6. **PR 6 — Search summary visualization**
   - first trustworthy accessible infographic/data-viz slice
7. **PR 7 — Browser/accessibility evidence**
   - assembled Playwright/axe/reflow evidence

Do not combine the scaffold, full search workflow, Storybook system, and visualization layer into one large PR.
