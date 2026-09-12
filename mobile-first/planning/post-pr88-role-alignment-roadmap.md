# Census UI Role Alignment Roadmap

Status: active continuation after PR #95

## Principle

Keep the repository focused on demonstrable Angular/federal UI engineering rather than adding new technologies for novelty. The mobile-first frontend and desktop discovery frontend already demonstrate Angular, NgRx/RxJS, local Signals, generated REST/OpenAPI contracts, Solr-backed discovery, DSpace authority boundaries, responsive design and extensive automated accessibility/browser evidence.

The highest-value continuation is now explainability, design-process evidence and an internal steward workflow.

## Delivered stack

The mobile-first line has converged to `main`:

- PR #81 — architecture/planning baseline;
- PR #82 — `census-mobile-frontend` scaffold;
- PR #85/#86 — API-backed search, scalable traversal and rank presentation;
- PR #87 — server-owned relevance evidence, Storybook/browser evidence and full-stack startup;
- PR #88 — query-wide result-type summary;
- PR #89 — typed field/term match evidence;
- PR #90 — traceability and explicit manual/usability protocol boundaries;
- PR #91 — shareable search/filter intent and accessible filter dialog;
- PR #92 — shared rank/relevance primitives adopted by both Angular frontends through the existing `shared-ui` library;
- PR #93 — authority-neutral mobile research detail navigation;
- PR #94 — typed research-package and related-research context navigation;
- PR #95 — expanded responsive/accessibility browser evidence.

The earlier proposal to create a separate `census-ui` library is superseded. Cross-app presentational reuse now belongs in the existing `shared-ui` library unless a later architectural need proves otherwise.

## Active continuation

### #97 — Shared result explainability dialog

See [result-explainability-dialog-plan.md](result-explainability-dialog-plan.md).

- Add a consistent information control for search results in both frontends.
- Use a real accessible modal/dialog rather than a tooltip for verbose search evidence.
- Present query/filter context, ordinal rank, match-strength evidence, relevance-model/version/calibration metadata and typed field/term match evidence.
- Keep exact ranking contribution backend-owned and additive only if a stable contract becomes available later.
- Never expose raw Solr/OpenSearch debug/explain trees as a general browser contract.
- Reuse `shared-ui` for presentational dialog content/entry primitives; keep NgRx/routing/application orchestration app-specific.

### #98 — Design lifecycle evidence

- Capture one representative slice from low-fidelity design intent through annotated component specification, Storybook states, production implementation and automated evidence.
- Record breakpoint/reflow, touch-target, filter/dialog focus, rank-vs-match-strength, forced-colors, async-state and maintenance/reuse decisions.
- Use Figma only when it materially improves the collaboration artifact; do not make it a runtime dependency.
- Do not imply participant usability or assistive-technology findings that were not collected.

### #99 — Read-only repository steward/status workflow

- Add a focused internal status surface using existing repository authority, synchronization, corpus/projection and search-health data.
- Prefer existing generated OpenAPI/client contracts and add fields only where needed for truthful status.
- Keep the initial workflow read-only; no privileged mutation is required.
- Preserve explicit authority/provenance and degraded/fallback language.
- Add responsive/browser/axe evidence without implying manual AT verification.

## Accessibility boundary

Issue #49 is closed **not planned**.

Automated template, Storybook, Playwright, axe, reflow, keyboard/focus and forced-colors evidence remains part of engineering quality. It is not a substitute for or claim of completed manual NVDA/JAWS/VoiceOver testing, Trusted Tester execution or Section 508 certification.

The existing manual validation documents remain templates/reference material only.

## Explicitly deferred

- semantic/vector search solely for novelty;
- additional OpenSearch sophistication without a concrete user/research question;
- client-owned relevance algorithms;
- local Kubernetes/search clustering without a deployment/resilience question;
- AWS/IaC without an actual deployment requirement.

Those are lower-value for the current UI-engineering story than explainability, design evidence, shared UI discipline and an internal operational workflow.
