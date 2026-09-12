# Mobile-First Census Frontend

Status: implemented; continuation work active

This directory documents the mobile-first Census/Civics frontend that lives beside the existing Angular application in the Nx workspace.

The app is no longer a proposal. `apps/census-mobile-frontend` is a working second Angular frontend over the same repository API and search infrastructure as `apps/discovery-ui`.

## Current architecture

| Surface                       | Purpose                                       | Port   |
| ----------------------------- | --------------------------------------------- | ------ |
| `apps/discovery-ui`           | Existing full discovery/research application  | `4200` |
| `apps/census-mobile-frontend` | Mobile-first Census/Civics discovery frontend | `4300` |
| Repository API                | Shared Spring/OpenAPI application boundary    | `8080` |
| `discovery-ui` Storybook      | Existing component/evidence review            | `4400` |
| Mobile Storybook              | Mobile-first component/responsive review      | `4500` |

The mobile frontend is a separate shell over the same backend capability. It is not a second backend, duplicate search engine, duplicate API client or throwaway mock.

## Implemented journey

The delivered mobile experience includes:

- module-based Angular composition (`standalone=false`);
- NgRx/RxJS for asynchronous/shared search and research-detail state;
- Signals only for appropriate local synchronous presentation state;
- search backed by `repository-api-client`;
- shareable query/filter URL intent;
- scalable cursor traversal and global result rank;
- server-owned query-relative relevance evidence;
- query-wide result-type summary from server facets;
- typed field/term match evidence;
- one shared `Why this matched` explanation model across both Angular frontends;
- accessible modal mobile filters and active filter chips;
- authority-neutral `/research/:researchId` detail navigation;
- preservation of the originating search/filter URL and focus behavior;
- typed research-package relationship navigation;
- broader related-research navigation kept semantically distinct from package assertions;
- shared rank/relevance/explainability components consumed by both Angular frontends;
- responsive browser/axe evidence at 320, 390, 430 and 768px plus forced-colors, reduced-motion and keyboard-entry checks.

Automated evidence is intentionally separate from manual assistive-technology verification. Issue #49 is closed **not planned**; these automated checks must not be described as completed manual Section 508, Trusted Tester, NVDA, JAWS or VoiceOver verification.

## State and ownership rules

- Reuse `RepositorySearchApi`, generated OpenAPI types and `REPOSITORY_API_BASE_URL` from `repository-api-client`.
- Keep search/research domain state in NgRx/RxJS when it is asynchronous, shared or effect-driven.
- Use Signals for local synchronous UI state only when they simplify presentation without creating a second source of truth.
- Keep search ranking/relevance semantics server-owned.
- Keep both frontends behind the generated application API; browsers do not call DSpace, Solr, OpenSearch or publishers directly.
- Promote presentational components to the existing `shared-ui` library only after demonstrated cross-app reuse.
- Treat 320px reflow, keyboard access, focus management, touch targets and non-color semantics as first-class engineering requirements.
- Use Storybook for isolated states and Playwright for assembled behavior.

## Active continuation

The original scaffold/search/evidence PR sequence is complete. Shared result explainability is complete through PR #103, and design lifecycle evidence is complete through PR #104. Current work is tracked through repository issues:

1. **#99 — Read-only repository steward/status surface (current)**: compose existing authority, corpus/projection, synchronization, search-health and retained-evidence facts into a focused internal status workflow without privileged mutation.

## Evidence and planning documents

- [Architecture](documentation/architecture.md)
- [ADR-001 — Parallel Mobile-First Frontend](documentation/adr-001-parallel-mobile-first-frontend.md)
- [ADR-002 — Mobile Search Interaction and Shared Evidence Model](documentation/adr-002-mobile-search-interaction-and-evidence-model.md)
- [Mobile Search Design Lifecycle Case Study](documentation/design/mobile-search-design-lifecycle.md)
- [Experience and Engagement Strategy](documentation/experience-engagement-strategy.md)
- [Infographics and Data Visualization Plan](documentation/infographics-and-data-visualization.md)
- [Mobile Search Requirements-to-Evidence Traceability](documentation/requirements/mobile-search-traceability.md)
- [Manual Accessibility Validation Protocol](documentation/accessibility/manual-validation-protocol.md) — reference/template only; manual execution is not an active completion gate
- [Mobile Search Usability Study Protocol](documentation/usability/mobile-search-study-protocol.md) — protocol only; do not imply participant findings that were not collected
- [Mobile Browser and Accessibility Evidence](planning/mobile-browser-accessibility-evidence.md)
- [Result Explainability Dialog Plan](planning/result-explainability-dialog-plan.md) — completed implementation plan for #97 / PR #103
- [Current Mobile Backlog](planning/backlog.md)
- [Role Alignment Roadmap](planning/post-pr88-role-alignment-roadmap.md)

Historical PR1/scaffold planning documents remain useful implementation history, but they are not the current backlog.
