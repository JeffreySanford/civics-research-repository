# Mobile-First Census Frontend Backlog

Status: active mobile geospatial discovery continuation

## Delivered baseline

The original PR1–PR7 planning sequence is complete and has been superseded by the implemented stack on `main`.

Delivered capabilities now include:

- `apps/census-mobile-frontend` on port `4300` beside `apps/discovery-ui` on `4200`;
- generated repository API client reuse with no duplicate backend/search contract;
- NgRx/RxJS search and research-detail state;
- local Signals for appropriate synchronous presentation state;
- shareable query/filter URL intent and accessible mobile filtering;
- scalable cursor traversal, global rank and server-owned relevance evidence;
- query-wide result-type summary and typed field/term match evidence;
- mobile research detail with return-to-search/focus behavior;
- typed research-package relationships and related-research traversal;
- shared rank/relevance presentation across both Angular frontends;
- shared `Why this matched` explainability across both Angular frontends (#97 / PR #103);
- one documented mobile search design lifecycle from wireframe through Storybook, production implementation and automated evidence (#98 / PR #104);
- Storybook/component evidence and Playwright/axe responsive coverage across representative phone/tablet widths;
- full-stack startup integration.

Historical PR1/scaffold documents remain implementation history, not open tasks.

## #99 — Read-only repository steward/status surface

Goal: demonstrate an internal operational workflow without widening into privileged administration work.

Tasks:

- [x] Inventory existing API data for corpus/profile identity, projection identity, Solr/OpenSearch parity/status, synchronization/adapters and automated evidence state.
- [x] Define a concise read-only steward workflow distinct from existing Admin mutation flows.
- [x] Reuse the generated OpenAPI/client boundary without adding a backend schema for facts the current contract already exposes.
- [x] Present authority boundaries, stale/degraded/fallback states and timestamps where available.
- [x] Keep secrets, credentials and operator-only diagnostics out of the browser contract.
- [x] Add loading, empty, degraded and error states.
- [x] Add responsive/component/browser/axe evidence.
- [x] Complete repository validation and merge the #99 implementation PR (#105).

Implementation boundary:

- `/steward` is a lazy read-only route in `discovery-ui`;
- existing corpus-storage, DSpace/source-inventory, synchronization and evidence clients provide status facts;
- the existing non-mutating Solr/OpenSearch projection-parity component is reused rather than duplicated;
- Admin Sync retains sync/apply/reindex controls and is linked separately from the steward view.

Acceptance:

- A repository steward can understand current system/corpus/search status without privileged actions.
- The surface does not duplicate Admin solely for portfolio breadth.
- Authority/provenance and degraded-state wording remain explicit.
- Narrow-width and axe evidence remain clean.

## #106 — Mobile research coverage map preview

Goal: make spatial research coverage discoverable from the mobile search journey without turning the initial screen into a miniature desktop map workspace.

Tasks:

- [x] Reuse the bounded `GET /maps/research-coverage` contract and current mobile `SearchQuery` intent.
- [x] Add a compact non-interactive MapLibre preview after a populated query.
- [x] Keep semantic matching/mapped/unmapped/truncation counts outside WebGL.
- [x] Preserve query/filter state into a lazy `/research-map` route.
- [x] Add MapLibre worker/style plumbing without changing backend contracts.
- [x] Keep publisher/institution location inference out of the map.
- [x] Add a first interactive research-coverage route with semantic in-view records; richer context layers remain follow-up work.
- [ ] Complete repository validation and merge the #106 implementation PR.

Next map increments after #106:

1. synchronize selected mapped research with a mobile bottom sheet/list;
2. add TIGER/Line boundary as the first contextual layer;
3. introduce explicit Community / Workforce / Environment layer presets rather than copying the desktop toggle tree.

## Deferred / optional work

The following remain optional and should be promoted only when a concrete question justifies them:

- additional map layers from repository issue #69;
- NASA CMR/PubMed/OpenAlex federation breadth after durable identity rules;
- vector/hybrid search experiments;
- local Kubernetes/search clustering;
- AWS/IaC deployment work.

## Accessibility boundary

Issue #49 is closed **not planned**. Existing manual accessibility/usability protocols remain reference templates only.

Continue automated keyboard/focus/reflow/forced-colors/axe evidence where it directly supports implementation quality, but do not label it as completed manual Section 508, Trusted Tester, NVDA, JAWS or VoiceOver validation.
