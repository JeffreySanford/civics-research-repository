# Mobile-First Census Frontend Backlog

Status: active continuation after the search-to-research delivery

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
- Storybook/component evidence and Playwright/axe responsive coverage across representative phone/tablet widths;
- full-stack startup integration.

Historical PR1/scaffold documents remain implementation history, not open tasks.

## #97 — Shared result explainability dialog

Goal: give both Angular frontends one consistent, truthful `Why this matched` experience.

Tasks:

- Add shared presentational information-control/dialog content to the existing `shared-ui` library.
- Keep query/filter context and dialog orchestration in each application.
- Present global ordinal rank separately from match strength.
- Present server-owned relevance model/version/calibration metadata and caveats.
- Render typed field/term match evidence.
- Avoid raw Solr/OpenSearch explain/debug payloads in the browser contract.
- Support mobile near-full-screen and larger-screen modal layouts through one semantic dialog contract.
- Add keyboard open/close/Escape/focus-return coverage.
- Add 320px reflow, forced-colors, Storybook, Playwright and axe evidence in both apps.

Acceptance:

- Both frontends explain the same API-owned ranking evidence consistently.
- No client-side relevance formula or probability claim is introduced.
- Focus behavior and narrow-width behavior are proven automatically.
- Automated accessibility evidence is not described as manual AT verification.

## #98 — Design lifecycle evidence

Goal: make the frontend design/decision path reviewable rather than showing only final code/tests.

Tasks:

- Select one representative mobile-first search/discovery slice.
- Capture a low-fidelity wireframe or equivalent design-intent artifact.
- Add an annotated component/interaction specification.
- Link Storybook states and responsive breakpoints.
- Link production implementation and automated browser/accessibility evidence.
- Document touch-target, focus, breakpoint/reflow, rank-vs-match-strength, forced-colors, async-state and reuse/maintenance decisions.
- Use Figma only if it improves the artifact; do not add it as a runtime dependency.

Acceptance:

- One complete design lifecycle is visible from intent through implementation/evidence.
- Design annotations point to real components/tests rather than generic UX claims.
- No user-research or assistive-technology findings are fabricated or implied.

## #99 — Read-only repository steward/status surface

Goal: demonstrate an internal operational workflow without widening into privileged administration work.

Tasks:

- Inventory existing API data for corpus/profile identity, projection identity, Solr/OpenSearch parity/status, synchronization/adapters and automated evidence state.
- Define a concise read-only steward workflow distinct from existing Admin mutation flows.
- Reuse the generated OpenAPI/client boundary.
- Add API fields only where current contracts cannot truthfully express required status.
- Present authority boundaries, stale/degraded/fallback states and timestamps where available.
- Keep secrets, credentials and operator-only diagnostics out of the browser contract.
- Add loading, empty, degraded and error states.
- Add responsive/component/browser/axe evidence.

Acceptance:

- A repository steward can understand current system/corpus/search status without privileged actions.
- The surface does not duplicate Admin solely for portfolio breadth.
- Authority/provenance and degraded-state wording remain explicit.

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