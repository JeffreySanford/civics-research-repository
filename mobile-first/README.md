# Mobile-First Census Frontend

Status: implemented; Open Science alignment continuation active

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
- a compact non-interactive Research Coverage preview and lazy interactive `/research-map` route over the existing bounded spatial sidecar (#106 / PR #107);
- semantic mapped/unmapped/truncation evidence outside WebGL plus useful fallback content when map rendering is unavailable;
- mobile `Research` and `Research + Census area context` presets using existing Census-area summary extents without misrepresenting them as exact TIGER/Line geometry (#108 / PR #109);
- synchronized MapLibre feature selection, semantic-list selection and compact selected-research detail over one local state model (#110 / PR #111);
- `Community · Population growth` using Census Population Estimates, authoritative county geometry, source/geometry vintage evidence, provenance links and semantic county values (#112 / PR #113);
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

## Two experiences over one authority model

The two Angular applications should not converge into copies of one another.

The full discovery UI can carry denser researcher/steward evidence, while the mobile-first UI can use progressive disclosure and concise explanations for users who need less information at once. Both must continue to resolve the same research objects, access rules, metadata, relationships, search semantics, and provenance through the generated application boundary.

That architecture is useful for future user-segmentation/usability work without introducing a second backend or contradictory metadata model.

## Active continuation

The original scaffold/search/evidence PR sequence is complete. Shared result explainability is complete through PR #103, design lifecycle evidence through PR #104, the read-only steward/status surface through PR #105, the first mobile Research Coverage map slice through PR #107, Census-area context/presets through PR #109, synchronized map/list/detail research selection through PR #111, and the first real Community population context through PR #113.

The primary continuation is no longer "add more maps." It is the repository-wide Open Science interoperability/reproducibility sequence documented in [Open Census Alignment Roadmap](../documentation/open-census-alignment-roadmap.md):

1. **#114 — authoritative artifact version identity/provenance — current**
2. **#115 — Open Census metadata profile + structured exports**
3. **#116 — reproducibility trail across research artifacts**
4. **#117 — Steward metadata-quality findings**
5. **#118 — real Census CODE/replication package**
6. **#119 — shareably reproducible analytical/map context**

The mobile frontend participates where progressive disclosure, citation/export, reproducibility/access guidance, or shareable analytical state materially improves the mobile research journey. Repository-domain rules remain backend-owned and shared with `discovery-ui`.

Additional Community/Workforce/Environment map layers are deferred to issue #69 or a future requirement rather than treated as the automatic next sequence.

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
- [Role Alignment Roadmap](planning/post-pr88-role-alignment-roadmap.md) — historical role-alignment planning before the post-#113 Open Census sequence
- [Open Census Alignment Roadmap](../documentation/open-census-alignment-roadmap.md) — current repository-wide continuation

Historical PR1/scaffold planning documents remain useful implementation history, but they are not the current backlog.