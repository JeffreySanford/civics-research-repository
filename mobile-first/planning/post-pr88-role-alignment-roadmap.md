# Post-PR88 Census Role Alignment Roadmap

Status: active continuation plan after the relevance/startup and search-summary slices.

## Principle

Keep the existing mobile-first roadmap, but bias new work toward the remaining UI/federal-engineering evidence rather than adding another major search technology. The repository already demonstrates Angular, NgRx/RxJS, Signals, REST/OpenAPI, Solr, DSpace, Spring, PostgreSQL, responsive design, and automated accessibility deeply. The highest-value additions now make the human and requirements process equally visible.

## Current stack

- PR #87: query-relative relevance evidence, rank presentation, 320px browser evidence, and full-stack startup.
- PR #88: query-wide result-type summary backed by server-provided facet counts.
- PR #89: engine-provided field/term match evidence with an accessible `Why this matched?` disclosure.
- PR #90: requirements traceability plus manual accessibility and usability-study protocols.

## Active mobile-first continuation

### PR #91 — Shareable search/filter intent + accessible mobile filter drawer

- Hydrate supported search/filter intent from URL query parameters.
- Validate controlled source-system/content-type URL values instead of casting arbitrary strings into generated API types.
- Serialize reproducible query/filter intent back to the URL after search or immediate facet changes.
- Keep cursor traversal history session-owned rather than pretending a deep cursor page can be reconstructed from a URL alone.
- Add active filter chips and immediate facet filtering backed by server-provided facets.
- Add a modal mobile filter drawer with focus trapping, Escape close, explicit close action, and focus return to its trigger.
- Validate the open drawer with axe and prove 320px reflow, URL reconstruction, immediate filter update, and focus restoration in Playwright.

## Post-convergence / post-main work

### Shared `census-ui` primitives + desktop relevance adoption

Do this after the mobile stack reaches `main` with explicit approval rather than extracting shared UI from an unresolved stack.

- Extract only components with demonstrated cross-app reuse.
- First candidates: relevance badge, result explainability entry point/dialog, result metadata/rank primitives, match-evidence presentation, and pagination/search input only where interfaces truly align.
- Keep async/search-domain state in each app; shared UI stays presentational.
- Consume the same server-owned rank/relevance/match-evidence contract from both Angular applications.
- Preserve existing `discovery-ui` facets, URL state, focus management, map/detail navigation, and NgRx lifecycle.

### Result explainability dialog

See `result-explainability-dialog-plan.md`.

- Add an information control at the lower-right of every result listing in both mobile-first and `discovery-ui` frontends.
- Use a real accessible modal/dialog rather than a tooltip because the intended ranking/search evidence is verbose.
- Present query/filter context, ordinal rank, match-strength evidence, relevance-model/version/calibration metadata, and typed field/term match evidence.
- Keep exact ranking-factor/contribution detail backend-owned and additive if it becomes available later.
- Never expose raw Solr `debug/explain` trees as a general browser contract.

### Design lifecycle evidence

- Capture wireframe -> annotated component specification -> Storybook states -> production implementation.
- Record breakpoint, touch-target, drawer, focus, rank-vs-match-strength, forced-colors, and maintenance decisions.
- Add Figma only when it improves the design collaboration artifact; do not make Figma a runtime dependency.

### Repository steward/internal workflow

- Add a small internal-facing status/steward surface using existing repository authority, synchronization, projection, and search-health data.
- Keep privileged mutations separate and explicitly protected; a read-only status slice is sufficient first.

## Explicitly deferred

- Semantic/vector search.
- Additional OpenSearch sophistication solely for novelty.
- Client-owned relevance algorithms.

Those are lower-value for the current Census UI-engineering alignment than explainability, traceability, design evidence, user feedback, shared UI discipline, and an internal workflow.
