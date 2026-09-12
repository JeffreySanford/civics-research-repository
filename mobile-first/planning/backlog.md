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
- read-only repository steward/status surface (#99 / PR #105);
- compact mobile Research Coverage preview plus lazy interactive `/research-map` route over the bounded spatial sidecar (#106 / PR #107);
- mobile Census-area context/presets using truthful orientation extents rather than claiming exact TIGER/Line geometry (#108 / PR #109);
- Storybook/component evidence and Playwright/axe responsive coverage across representative phone/tablet widths;
- full-stack startup integration.

Historical PR1/scaffold documents remain implementation history, not open tasks.

## #108 — Mobile Census area context and map presets — delivered

Delivered in PR #109:

- [x] Keep the compact search-result preview free of extra Census-area requests and controls.
- [x] Add a compact expanded-map preset control with `Research` as the default.
- [x] Load existing `GET /maps/census-areas` summaries only for the expanded map.
- [x] Allow explicit Census area selection independently of repository search filters.
- [x] Use an exact search-geography match as initial map context when one exists, without weakening or rewriting the search query.
- [x] Render the selected area as a dashed orientation extent and fit the map to it.
- [x] State explicitly that the rectangle is not exact TIGER/Line administrative geometry.
- [x] Keep Research Coverage visible and preserve bounded viewport refresh/semantic evidence.
- [x] Add unit and focused 320px Playwright/axe coverage for preset selection, query preservation, reflow and forced-colors behavior.
- [x] Complete repository validation and merge the #108 implementation PR.

Important data boundary:

- `CensusAreaBoundary` currently provides west/south/east/north/center/defaultZoom summaries, not exact administrative polygon geometry.
- The mobile context layer therefore uses the word **extent** and must not be represented as an official TIGER/Line polygon.
- Exact TIGER geometry requires a separate backend/data-contract increment.

## #110 — Synchronize mobile map feature selection with research list — current

Goal: make the interactive map and its semantic mapped-research list two views of the same selected research state without adding desktop-style popups or a duplicate state model.

Implementation/evidence ready on the #110 branch:

- [x] Own selection with one local `selectedSourceIdentifier` Signal.
- [x] Let pointer clicks on mapped research polygons/points select the corresponding publisher-supplied record.
- [x] Let keyboard-operable semantic-list buttons select the same record with explicit `aria-pressed` state.
- [x] Render the selected record in a compact labelled detail region below the map.
- [x] Provide the authoritative-source link when the selected feature supplies one.
- [x] Use MapLibre feature-state to emphasize selected polygons/points with size/weight/opacity changes rather than color alone.
- [x] Preserve search/filter URL intent; map selection is local presentation state, not a repository search filter.
- [x] Reconcile bounded viewport refreshes by retaining selection only while the selected source identifier remains in the returned feature set.
- [x] Keep the semantic list/detail path usable when WebGL is unavailable.
- [x] Add unit coverage for list/detail synchronization and clear-on-refresh behavior.
- [x] Add focused 320px Playwright evidence proving semantic-list selection, real MapLibre pointer selection, query preservation, reflow and axe checks.
- [ ] Complete repository-wide PR validation and merge #110.

## Next map increments after #110

Promote these only as separate, evidence-backed increments:

1. add exact TIGER administrative geometry through an authoritative backend contract;
2. add a `Community` preset using Census Population Estimates / SAIPE / County Business Patterns;
3. add a `Workforce` preset using LODES workplace employment / commuting flows;
4. add an `Environment` preset using USGS terrain / hydrography / earthquakes.

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