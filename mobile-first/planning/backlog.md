# Mobile-First Census Frontend Backlog

Status: proposed

## PR 1: Planning and Workspace Baseline

Goal: document the architectural choice and confirm the current app remains stable.

Tasks:

- Add mobile-first planning docs.
- Add PR 1 baseline checklist.
- Add PR 1 readiness note with repository-verified app/API facts.
- Add experience and engagement strategy.
- Add infographics and data visualization plan.
- Confirm current frontend and Storybook ports.
- Confirm the existing `repository-api-client` search boundary.
- Record the module-based Angular preference.
- Define the Signals versus RxJS/NgRx ownership boundary.
- Record the intended app name, port, Storybook role, and first vertical slice.

Acceptance:

- Docs explain why a second app exists.
- Docs reuse the existing generated API client rather than proposing duplicate search contracts.
- Docs prefer module-based Angular composition for the new app.
- Docs allow Signals for appropriate local synchronous UI state while retaining NgRx/RxJS for shared/asynchronous search state.
- Docs explain how infographics and data visualizations support search without becoming a separate analytics product.
- Existing runtime code is not modified by the planning PR.

## PR 2: Scaffold `census-mobile-frontend`

Goal: create the new Angular app under `apps/` without implementing search behavior yet.

Tasks:

- Generate the app through Nx with module-based Angular composition (`standalone=false`).
- Enable routing and SCSS.
- Configure serve port `4300`.
- Add a minimal mobile discovery shell/route.
- Confirm the existing `repository-api-client` can be imported.
- Add baseline lint/test/build coverage.

Acceptance:

- `apps/discovery-ui` remains unchanged and available on `4200`.
- `apps/census-mobile-frontend` builds and can serve on `4300`.
- No backend changes are required.
- No duplicate API type/client library is created.

## PR 3: Repository API + NgRx/Signals State Foundation

Goal: establish the typed search boundary and state ownership model before building the full UI.

Tasks:

- Reuse `RepositorySearchApi`, `SearchQuery`, `SearchResponse`, `SearchResult`, `FacetGroup`, and `FacetValue` from `repository-api-client`.
- Add search feature actions, reducer, selectors, and effects.
- Use RxJS `switchMap` for stale-request cancellation.
- Define Router query-parameter synchronization for shareable search state.
- Add local Signals for appropriate synchronous UI state such as filter-drawer open/close and summary disclosure state.
- Add tests proving NgRx and Signal state do not independently own the same source of truth.
- Add realistic fixture responses only where component/Storybook testing requires them.

Acceptance:

- Search-domain state has one authoritative NgRx source of truth.
- Local synchronous UI state can use Signals without being mirrored into NgRx unnecessarily.
- Typed search requests use the existing repository API client.
- URL serialization and request cancellation are testable.

## PR 4: Mobile Search Vertical Slice

Goal: deliver the first complete 320px-first discovery workflow.

Tasks:

- Build `DiscoverySearchBarComponent`.
- Build `DiscoveryResultsHeaderComponent`.
- Build `ResearchResultCardComponent`.
- Build `DiscoveryResultsComponent`.
- Build `DiscoveryFilterTriggerComponent`.
- Build `DiscoveryFiltersComponent`.
- Build `DiscoveryActiveFiltersComponent`.
- Build `DiscoveryPaginationComponent`.
- Build the mobile drawer/shell behavior.
- Connect the components to the PR 3 state foundation.

Acceptance:

- The workflow works at 320px without horizontal document overflow.
- Search form is keyboard operable.
- Filter drawer traps focus, supports Escape, and returns focus to the trigger.
- Active filters are removable and result state remains synchronized.
- Loading, empty, error, and populated states are explicit.

## PR 5: Storybook Responsive Matrix

Goal: make mobile/tablet/desktop component states reviewable in isolation.

Tasks:

- Configure mobile Storybook on port `4500`.
- Add viewport presets for 320px, 390px, 430px, 768px, 1024px, and 1440px.
- Add stories for result cards, filters, results, pagination, shell, and search-summary states.
- Add stories for loading, empty, error, long content, missing metadata, restricted, and federated results.
- Add Storybook axe checks where practical.

Acceptance:

- Reviewers can inspect all target widths without running the full application.
- Presentational states are testable independently from live backend availability.
- Signal-driven local state behaves correctly in interactive stories.

## PR 6: Search Summary and Data Visualization

Goal: add the first useful, trustworthy, accessible visual summary of a search result set.

Candidate visualizations:

- result-type mix
- top programs
- year distribution/range
- source-system mix
- filter-impact summary

Tasks:

- Choose one visualization backed by server-provided facets/aggregate data.
- Add `DiscoverySearchSummaryComponent` or equivalent.
- Keep expanded/collapsed summary state local, with a Signal if appropriate.
- Add a text/table equivalent for all visual information.
- Verify color is not the sole encoding.
- Explicitly label any page-local analysis; do not present it as corpus-wide evidence.

Acceptance:

- Visualization answers a real search-comprehension question.
- Data provenance/scope is clear.
- Text/table equivalence is complete.
- The visualization does not displace the primary search/results workflow on mobile.

## PR 7: Browser and Accessibility Evidence

Goal: validate the assembled mobile-first frontend across the key user journeys.

Tasks:

- Add E2E coverage for search, filters drawer, pagination, and URL state.
- Add 320px reflow assertions.
- Add keyboard-flow assertions.
- Add focus restoration assertions.
- Add live-region/status assertions where stable.
- Validate Signal-driven drawer/disclosure state through observable DOM/ARIA behavior rather than implementation details.
- Add Playwright/axe coverage for assembled journeys.
- Record manual keyboard, zoom/reflow, forced-colors, reduced-motion, and screen-reader checks separately from automated evidence.

Acceptance:

- Mobile discovery workflow has automated browser/accessibility evidence.
- Manual accessibility evidence remains clearly distinguished from automated checks.
- Existing `discovery-ui` regressions are not introduced.

## Deferred: Convergence Decision

After the mobile-first app has real implementation evidence, decide whether it remains a parallel frontend or informs a future refactor of `discovery-ui`.

Possible outcomes:

- keep both frontends independent
- promote genuinely shared presentational components to a `census-ui` library
- converge selected mobile-first patterns into the existing app
- eventually replace the older discovery surface if evidence justifies it

Do not make convergence a prerequisite for completing the mobile-first experiment.
