# Post-PR88 Census Role Alignment Roadmap

Status: active continuation plan after the relevance/startup and search-summary slices.

## Principle

Keep the existing mobile-first roadmap, but bias new work toward the remaining UI/federal-engineering evidence rather than adding another major search technology. The repository already demonstrates Angular, NgRx/RxJS, Signals, REST/OpenAPI, Solr, DSpace, Spring, PostgreSQL, responsive design, and automated accessibility deeply. The highest-value additions now make the human and requirements process equally visible.

## Current stack

- PR #87: query-relative relevance evidence, rank presentation, 320px browser evidence, and full-stack startup.
- PR #88: query-wide result-type summary backed by server-provided facet counts.

## Next slices

### PR #89 — Search match evidence / “Why this matched?”

- Use engine highlighting rather than raw Solr `debug/explain`.
- Add an additive typed `matchEvidence[]` API contract.
- Keep evidence server-owned; Angular renders rather than infers it.
- Explain matched indexed fields and terms without claiming exact score contribution.
- Add component, Storybook, backend, 320px Playwright, and axe evidence.

### PR #90 — Requirements traceability + manual accessibility/usability protocol

- Add stable requirement IDs for the mobile search journey.
- Map requirement -> acceptance criterion -> implementation surface -> automated evidence -> WCAG/Section 508 criterion where applicable.
- Add manual keyboard, 200%/400% zoom/reflow, forced-colors, reduced-motion, NVDA/JAWS/VoiceOver evidence templates.
- Add a small real usability-study protocol covering search, filtering, match explanation, and reproducible/shareable search state.
- Do not manufacture results; record observations only when actual participants complete the tasks.

### PR #91 — Shared `census-ui` primitives + desktop relevance adoption

- Extract only components with demonstrated cross-app reuse.
- First candidates: relevance badge, match-evidence disclosure, result metadata/rank primitives, pagination/search input only where interfaces truly align.
- Keep async/search-domain state in each app; shared UI stays presentational.
- Consume the same server-owned rank/relevance/match-evidence contract from both Angular applications.
- Preserve existing `discovery-ui` facets, URL state, focus management, map/detail navigation, and NgRx lifecycle.

### Follow-on — Design lifecycle evidence

- Capture wireframe -> annotated component specification -> Storybook states -> production implementation.
- Record breakpoint, touch-target, drawer, focus, rank-vs-match-strength, forced-colors, and maintenance decisions.
- Add Figma only when it improves the design collaboration artifact; do not make Figma a runtime dependency.

### Follow-on — Repository steward/internal workflow

- Add a small internal-facing status/steward surface using existing repository authority, synchronization, projection, and search-health data.
- Keep privileged mutations separate and explicitly protected; a read-only status slice is sufficient first.

## Explicitly deferred

- Semantic/vector search.
- Additional OpenSearch sophistication solely for novelty.
- Client-owned relevance algorithms.

Those are lower-value for the current Census UI-engineering alignment than explainability, traceability, design evidence, user feedback, shared UI discipline, and an internal workflow.
