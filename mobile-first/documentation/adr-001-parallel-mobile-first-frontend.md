# ADR-001: Parallel Mobile-First Census Frontend

Status: proposed

Date: 2026-09-11

## Context

The project needs a mobile-first Census/Civics research discovery experience. The existing Angular app should remain functional while this new UX is explored and validated.

The desired mobile experience has different priorities from the current desktop-oriented application:

- 320px-first layout
- mobile filter drawer
- federal accessibility evidence
- Storybook viewport matrix
- focused search/results flow
- clean portfolio narrative around real API reuse

At the same time, the search API and repository backend should remain authoritative. The repository already provides a generated OpenAPI-backed `repository-api-client` with `RepositorySearchApi`, search models, and `REPOSITORY_API_BASE_URL`. Creating another backend or parallel client/contract layer would add avoidable complexity and weaken the architecture story.

## Decision

Create a new Angular app under `apps/` for the mobile-first Census frontend while keeping the existing Angular app intact.

Suggested app name:

```text
apps/census-mobile-frontend
```

Suggested local ports:

```text
apps/discovery-ui                 4200
apps/census-mobile-frontend       4300
discovery-ui storybook            4400
mobile storybook                  4500
```

The new app will:

- consume the existing backend through `repository-api-client`
- use the existing generated search types rather than duplicate contracts
- use module-based Angular composition (`standalone=false`)
- use Observable-first RxJS/NgRx state management
- add shared UI libraries only when genuine cross-app reuse is demonstrated

## Consequences

Positive:

- The existing app remains stable.
- Mobile-first work can proceed without broad regression risk.
- The Census frontend can have a clean information architecture.
- Both frontends share one typed API boundary.
- Storybook and accessibility evidence can be developed around focused components.
- The backend remains the single source of search truth.

Tradeoffs:

- Two frontend apps must be maintained.
- The new app and existing app may use different Angular bootstrap styles.
- Shared contracts still require discipline even though the generated client removes most copy/paste risk.
- Design-system decisions must be explicit so the apps do not diverge accidentally.
- E2E coverage needs to cover both the current app and the mobile-first app.

## Alternatives Considered

### Enhance the Existing `/discovery` Route Only

This is architecturally elegant when an existing Discovery route already exists and is safe to refactor. It reduces duplication but increases risk if the current app is still needed as-is.

This remains a future convergence option.

### Create New `census-api-contracts` and `census-search-client` Libraries

Rejected for the initial implementation. The repository already has a generated API-client library that owns the relevant search contracts and HTTP service. New libraries would duplicate an existing seam without adding capability.

A future `census-ui` library remains possible if presentational components prove reusable across both frontends.

### Create a Separate Backend

Rejected. The backend should continue to own search semantics, facets, pagination, provenance, and authorization behavior.

### Build a Static Demo

Rejected. The goal is a credible repository extension, not a throwaway prototype.

## Acceptance Criteria

- Existing Angular app still serves on its current port.
- New Angular app serves independently on a separate port.
- New app can call the existing API through `repository-api-client` and the shared base URL token.
- No new search backend is introduced.
- No duplicate search contract/client library is introduced.
- Search state is Observable-first and does not depend on Angular Signals.
- First vertical slice works at 320px with no horizontal document scroll.
