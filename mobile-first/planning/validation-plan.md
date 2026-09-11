# Mobile-First Census Frontend Validation Plan

Status: proposed

## Validation Goals

The new frontend should prove six things:

1. The existing app still works.
2. The new app can run independently.
3. The new app uses the existing API client and backend.
4. The state architecture uses Signals and RxJS/NgRx according to clear ownership boundaries.
5. The mobile-first UI is accessible and responsive from 320px upward.
6. Search rank and any future relevance bands are evidence-backed, accessible, and regression-tested rather than cosmetic client guesses.

## Baseline Validation

Before scaffolding:

```bash
pnpm install
pnpm nx run discovery-ui:build
pnpm nx run discovery-ui:test
```

If the workspace uses another current validation path, prefer the repo-standard script over direct tooling.

## New App Validation

After scaffolding:

```bash
pnpm nx run census-mobile-frontend:build
pnpm nx run census-mobile-frontend:test
pnpm nx run census-mobile-frontend:lint
```

The branch-specific mobile validation workflow must run for ordinary code pushes to the mobile branch, not only when its own workflow YAML changes. A narrow `push.paths` filter must never make application, generated-client, shared-config, or dependency changes invisible to validation.

When the mobile app gains E2E coverage, use the generated/repository-standard E2E target rather than assuming a target name before generation.

## Angular Composition Validation

PR 2 should verify the new application was generated in the intended module-based form.

Checks:

- application bootstrap uses the generated NgModule-based structure
- generated components are not silently converted to standalone by later generator defaults
- routing is module-based unless a later ADR intentionally changes the decision
- Signals may still be used inside module-declared components; standalone components and Signals are independent architecture choices

## Port Validation

Expected local behavior:

| Check              | Expected                               |
| ------------------ | -------------------------------------- |
| Existing app       | `http://localhost:4200`                |
| Mobile app         | `http://localhost:4300`                |
| Existing Storybook | `http://localhost:4400`                |
| Mobile Storybook   | `http://localhost:4500`                |
| Repository API     | `http://localhost:8080/api` by default |

Both apps should be able to run at the same time.

## State Architecture Validation

The implementation should test behavior at the state boundary rather than merely assert which primitive was used.

NgRx/RxJS checks:

- search actions cause deterministic reducer transitions
- effects use the existing `RepositorySearchApi`
- stale searches are cancelled through RxJS orchestration
- loading/error/result/facet/pagination state has one shared source of truth
- URL-linked search state round-trips predictably

Signal checks:

- local Signal state updates synchronously and predictably
- `computed()` values derive only from their declared Signal sources
- filter drawer/disclosure Signals produce the correct DOM and ARIA state
- local Signals are not independently mirrored into NgRx without a demonstrated ownership need

Integration boundary checks:

- NgRx selectors may be bridged to Signals for component/template ergonomics without creating a second writable source of truth
- local Signal state can cause user actions that dispatch NgRx actions, but the returned search-domain data remains store-owned
- tests prefer externally observable behavior over implementation-coupled assertions where possible

## Route Query Validation

Route-to-`SearchQuery` conversion must validate runtime input rather than relying on TypeScript casts.

Checks:

- supported `SourceSystem` values hydrate correctly
- unsupported `sourceSystem` query-string values are ignored or normalized safely
- supported `ResearchObjectType` values hydrate correctly
- unsupported `type` values are ignored or normalized safely
- `vintageYear` accepts only the agreed positive-integer range
- page values are non-negative integers
- repeatable program values are trimmed and blank values removed
- serialization round-trips a valid query without losing repeatable filters

A dedicated `SearchRouteQueryAdapter` is the preferred extraction once the existing behavior is protected by tests.

## Responsive Validation

Required viewport checks:

|  Width | Purpose             |
| -----: | ------------------- |
|  320px | WCAG reflow minimum |
|  390px | common phone        |
|  430px | large phone         |
|  768px | tablet portrait     |
| 1024px | tablet landscape    |
| 1440px | desktop             |

Assertions:

- no document-level horizontal scrolling at 320px
- search field remains operable
- filter trigger remains visible
- drawer content remains reachable
- result cards wrap long content cleanly
- pagination controls remain reachable and named
- rank and relevance labels do not overflow result cards at 320px
- optional search-summary content does not push primary results out of a usable first-screen flow

## Accessibility Validation

Automated:

- axe checks in Storybook or E2E where practical
- keyboard interaction tests for filter drawer
- Escape closes the drawer and restores focus to the trigger
- focus movement after pagination/page replacement where appropriate
- accessible names for filter removal controls
- tests proving Signal-driven local state updates the same accessible DOM semantics expected from any implementation
- rank and relevance meaning remains present when color is unavailable

Manual:

- keyboard-only walkthrough
- browser zoom at 200% and 400%
- forced-colors mode
- reduced-motion mode
- screen-reader smoke test with NVDA or equivalent

## Search Page Behavioral Test Matrix

The routed page has moved beyond a smoke-test-only stage. Protect these behaviors before or during component extraction:

- search landmark and labeled query field
- filter dialog semantics
- Escape-close + focus restoration
- URL hydration into query/filter state
- URL updates after search/filter changes
- active filter-chip removal
- pagination request plus results-heading focus
- loading state
- empty state
- error state
- populated results state
- malformed URL values
- rank badge rendering
- relevance text-label rendering when relevance metadata becomes available

## API Validation

The mobile app should prove that search behavior remains server-owned and uses the repository's existing generated client.

Checks:

- `RepositorySearchApi` is imported from `repository-api-client`
- query text serializes into API request parameters
- selected facets serialize into API request parameters
- paging uses server-provided result metadata
- facet counts come from the response
- provenance renders from the response
- no duplicate mobile-specific search contract/client is introduced
- no full-corpus filtering occurs in the browser

When relevance evidence is added:

- OpenAPI/generated TypeScript types expose the optional relevance fields
- raw engine score is preserved as engine evidence, not labeled as a probability
- normalized score/band semantics are versioned and documented
- existing clients remain compatible with absent optional relevance fields
- expensive Solr/OpenSearch explain payloads are not enabled for ordinary production search traffic

## Rank and Relevance Validation

Use `mobile-first/planning/search-relevance-plan.md` as the canonical relevance contract.

Required evidence layers:

1. **Rank behavior**
   - global/visible rank remains stable across pagination or cursor traversal
   - rank labels are unit-tested and rendered in Storybook/E2E
2. **Score transport**
   - backend parser preserves native score evidence
   - generated API types retain score metadata
3. **Band mapping**
   - five discrete text-labeled states: Strong, Good, Moderate, Weak, Low
   - deterministic boundary tests
   - no color-only semantics
4. **Judged search quality**
   - repository-owned relevance judgments include the North Dakota migration acceptance query
   - record at least Precision@10 and nDCG@10
   - use Reciprocal Rank/MRR for answer-seeking query sets where appropriate
5. **Regression protection**
   - ranking-quality metric floors are reproducible and changes require explicit evidence updates

Raw Solr/OpenSearch scores must not be compared across unrelated queries as though they shared an absolute scale.

## Storybook Validation

Prefer stories around extracted presentational components rather than Storybooking the entire routed page.

Required first matrix:

- filter drawer: default, selected, loading, empty/long facets
- result card: each relevance band plus rank badge
- result list: mixed relevance bands
- results: loading, empty, error, populated
- 320px ranked-results story
- forced-colors/high-contrast evidence where supported

Representative stories must run axe.

## Playwright / E2E Validation

At minimum cover:

- 320px search journey with axe
- query submission and ordered rank labels
- relevance text remains meaningful without CSS color
- filter apply/remove updates URL and results
- Escape-close and focus restoration
- pagination/result-heading focus
- loading/empty/error journeys
- malformed query-string values remain harmless

When the staged-filter experiment begins, capture request count and perceived/observed latency for immediate-search versus Apply/Show-results behavior.

## Filter Interaction Experiment Validation

Keep immediate facet-search behavior until evidence supports a change.

Compare:

```text
tap facet -> request -> facets/results update -> tap next facet
```

with:

```text
select several filters -> review -> Show N results -> one search
```

Measure request count, task completion time, focus stability, announcement volume, and realistic Solr/OpenSearch latency. Treat the existing search-performance work as input to the UX decision.

## Data Visualization Validation

Any search-summary visualization should prove its data scope before it is accepted.

Checks:

- corpus-wide labels are used only for server-provided aggregate/facet data that support that claim
- page-local calculations are clearly labeled as page-local
- no second full-corpus request is introduced merely to draw a chart
- text/table equivalent exposes the same substantive information
- chart interaction is keyboard accessible when interaction exists
- color is not the sole encoding
- chart remains understandable in forced-colors/high-contrast contexts

## Evidence to Capture

Each implementation PR should capture:

- command output summary
- screenshots or Storybook links for affected viewports
- known limitations
- accessibility checks completed
- API contract assumptions
- state-boundary decisions introduced or changed
- ranking/relevance metric evidence when search scoring changes

Manual accessibility results must remain explicitly separate from automated axe/Playwright/Storybook evidence.
