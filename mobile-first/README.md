# Mobile-First Census Frontend

Status: proposed

This directory captures the plan for a new mobile-first Census/Civics frontend that lives beside the existing Angular application in the Nx workspace.

The intent is to build a focused mobile-first discovery experience without destabilizing the existing Angular frontend. The new app should consume the existing repository search API through the existing `repository-api-client`, while the current application remains available on its existing development port.

## Working Decision

Create an additional Angular app under `apps/` for the mobile-first Census frontend.

Suggested development ports:

| Surface                       | Purpose                                        | Port   |
| ----------------------------- | ---------------------------------------------- | ------ |
| `apps/discovery-ui`           | Existing Angular application                   | `4200` |
| `apps/census-mobile-frontend` | New mobile-first Census/Civics frontend        | `4300` |
| `discovery-ui` Storybook      | Existing component state and responsive review | `4400` |
| Mobile Storybook              | New mobile-first component review              | `4500` |

The new frontend is a separate shell over the same backend capability. It is not a new backend, a duplicate search engine, a duplicate API client, or a throwaway mock.

## Why This Direction

The existing app can remain functional while the new Census experience develops independently. That lets the mobile-first work move quickly, keep its own information architecture, and prove Section 508/WCAG behavior at 320px without forcing broad changes into the current desktop-oriented application.

This also creates a clear portfolio story:

> Built a mobile-first federal research discovery frontend in Angular, backed by the existing Civics Research Repository API, with responsive Storybook evidence and accessibility-focused browser validation.

## Guiding Principles

- Keep the existing Angular app working.
- Reuse `RepositorySearchApi`, generated OpenAPI types, and `REPOSITORY_API_BASE_URL` from `repository-api-client`.
- Do not add a second search backend, duplicate index, or duplicate search-contract library.
- Prefer module-based Angular composition for the new app (`standalone=false`).
- Use NgRx/RxJS for asynchronous search workflows, effects, cancellation, URL synchronization, and shared feature state.
- Embrace Angular Signals where they simplify local synchronous UI state and local computed presentation state.
- Do not duplicate the same source of truth between Signals and NgRx.
- Create new shared UI libraries only after real reuse across the two frontends is demonstrated.
- Treat 320px reflow, keyboard access, focus management, touch targets, and screen-reader semantics as first-class requirements.
- Use Storybook for isolated responsive states and Playwright for assembled app behavior.
- Keep search semantics server-owned; the frontend expresses search intent and renders bounded responses.
- Preserve search-engine rank as evidence, and treat score-based relevance bands as calibrated API data rather than client-invented percentages.
- Never use relevance color as the only meaning; pair green/yellow/orange/red states with text labels and accessible semantics.
- Use infographics/data visualization only when they improve comprehension and are backed by trustworthy server-provided aggregate data or clearly labeled page-local data.

## Planned Documents

- [Architecture](documentation/architecture.md)
- [Architecture Decision Record](documentation/adr-001-parallel-mobile-first-frontend.md)
- [Experience and Engagement Strategy](documentation/experience-engagement-strategy.md)
- [Infographics and Data Visualization Plan](documentation/infographics-and-data-visualization.md)
- [PR 1 Baseline Checklist](planning/pr1-baseline-checklist.md)
- [PR 1 Readiness Note](planning/pr1-readiness-note.md)
- [PR 1 Description Draft](planning/pr1-description-draft.md)
- [Implementation Plan](planning/implementation-plan.md)
- [Post-PR4 Refinement Plan](planning/post-pr4-refinement-plan.md)
- [Search Relevance and Ranking Plan](planning/search-relevance-plan.md)
- [Backlog](planning/backlog.md)
- [Validation Plan](planning/validation-plan.md)
