# Mobile-First Census Frontend Validation Plan

Status: proposed

## Validation Goals

The new frontend should prove five things:

1. The existing app still works.
2. The new app can run independently.
3. The new app uses the existing API client and backend.
4. The state architecture uses Signals and RxJS/NgRx according to clear ownership boundaries.
5. The mobile-first UI is accessible and responsive from 320px upward.

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
- optional search-summary content does not push primary results out of a usable first-screen flow

## Accessibility Validation

Automated:

- axe checks in Storybook or E2E where practical
- keyboard interaction tests for filter drawer
- focus restoration tests after drawer close
- focus movement after pagination/page replacement where appropriate
- accessible names for filter removal controls
- tests proving Signal-driven local state updates the same accessible DOM semantics expected from any implementation

Manual:

- keyboard-only walkthrough
- browser zoom at 200% and 400%
- forced-colors mode
- reduced-motion mode
- screen-reader smoke test with NVDA or equivalent

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

Manual accessibility results must remain explicitly separate from automated axe/Playwright/Storybook evidence.
