# ADR-001: Parallel Mobile-First Census Frontend

Status: accepted and implemented

Decision date: 2026-09-11

Implementation status confirmed: 2026-09-12

## Context

The project needed a mobile-first Census/Civics research discovery experience while the existing Angular application remained functional during exploration and validation.

The desired mobile experience had different priorities from the desktop-oriented application:

- 320px-first layout;
- mobile filter drawer;
- federal accessibility engineering evidence;
- Storybook viewport/state review;
- focused search/results flow;
- clean portfolio narrative around real API reuse.

At the same time, the search API and repository backend needed to remain authoritative. The repository already provided a generated OpenAPI-backed `repository-api-client` with `RepositorySearchApi`, search models and `REPOSITORY_API_BASE_URL`. Creating another backend or parallel client/contract layer would add avoidable complexity and weaken the architecture story.

## Decision

Create a new Angular app under `apps/` for the mobile-first Census frontend while keeping the existing Angular app intact.

Implemented app:

```text
apps/census-mobile-frontend
```

Local ports:

```text
apps/discovery-ui                 4200
apps/census-mobile-frontend       4300
discovery-ui storybook            4400
mobile storybook                  4500
```

The app:

- consumes the existing backend through `repository-api-client`;
- uses the existing generated search types rather than duplicate contracts;
- uses module-based Angular composition (`standalone=false`);
- uses NgRx/RxJS for asynchronous search workflows and shared feature state;
- uses Angular Signals where they simplify local synchronous UI state and local derivation;
- promotes UI into shared libraries only when genuine cross-app reuse is demonstrated.

The state architecture is intentionally hybrid. Signals are not a replacement for RxJS/NgRx, and RxJS/NgRx should not be used merely to avoid Signals where local synchronous state is simpler and clearer with `signal()` or `computed()`.

## Consequences

Positive:

- The existing app remained stable.
- Mobile-first work proceeded without a broad rewrite.
- The Census frontend has its own focused information architecture.
- Both frontends share one typed API boundary.
- Local UI state can use modern Angular primitives without forcing asynchronous search state out of NgRx/RxJS.
- Storybook and accessibility evidence can be developed around focused components.
- The backend remains the single source of search truth.
- Demonstrated cross-app search semantics can converge into `shared-ui` without forcing the two shells to become identical.

Tradeoffs:

- Two frontend apps must be maintained.
- The two apps may use different Angular composition/bootstrap styles.
- Developers must keep Signal and NgRx ownership boundaries explicit to avoid duplicate sources of truth.
- Shared contracts still require discipline even though the generated client removes most copy/paste risk.
- Design-system decisions must be explicit so the apps do not diverge accidentally.
- E2E evidence needs to cover both the current app and the mobile-first app.

## Alternatives considered

### Enhance the existing `/discovery` route only

This is architecturally elegant when an existing Discovery route is safe to refactor. It reduces duplication but would have increased risk while the existing app was still needed as-is.

Future convergence remains possible if a concrete maintenance/product reason justifies it.

### Create new `census-api-contracts` and `census-search-client` libraries

Rejected. The repository already has a generated API-client library that owns the relevant search contracts and HTTP service. New libraries would duplicate an existing seam without adding capability.

A separate `census-ui` library was also unnecessary. Presentational components that later demonstrated cross-app reuse were promoted into the existing `shared-ui` boundary instead.

### Make all UI state NgRx/RxJS

Rejected. Shared search state, effects, cancellation and URL-linked state fit NgRx/RxJS well, but forcing every local drawer/disclosure/synchronous presentation state through observable infrastructure adds ceremony without improving ownership.

### Make all state Signal-based

Rejected. Search requests, cancellation, URL synchronization and shared state transitions already fit RxJS/NgRx and retain those semantics.

### Create a separate backend

Rejected. The backend continues to own search semantics, facets, pagination, provenance and authorization behavior.

### Build a static demo

Rejected. The delivered frontend is a real repository extension over the production-shaped typed API boundary rather than a throwaway prototype.

## Implemented acceptance evidence

The original acceptance criteria are now implemented:

- existing Angular app still serves on its own port;
- mobile Angular app serves independently on a separate port;
- mobile app calls the existing API through `repository-api-client` and the shared base-URL token;
- no new search backend was introduced;
- no duplicate search contract/client library was introduced;
- the mobile app remains module-based;
- shared/asynchronous search state uses NgRx/RxJS;
- appropriate local synchronous UI state uses Signals without duplicating NgRx-owned state;
- the narrow baseline is exercised at 320px with automated no-horizontal-overflow evidence;
- responsive/browser/axe evidence covers representative mobile/tablet widths.

Manual assistive-technology verification is intentionally outside this ADR's completion claim. Issue #49 is closed **not planned**; automated evidence must not be represented as completed manual Section 508/Trusted Tester/AT verification.

The subsequent interaction/shared-evidence decision is recorded in [ADR-002](adr-002-mobile-search-interaction-and-evidence-model.md).
