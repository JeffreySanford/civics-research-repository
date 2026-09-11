# Post-PR4 Mobile Search Refinement Plan

Status: active planning reconciliation

## Why this document exists

Two implementation sessions produced related but different PR4 lines:

- **PR #84** — routed/faceted mobile search vertical slice with URL persistence, filter drawer, active chips, pagination, focus management, and the larger `SearchPageComponent`.
- **PR #86** — scalable pagination/ranking work developed from the simpler search branch, including cursor-oriented traversal, visible engine rank, summaries, and top-ranked visual cues.

Do not treat both branches as independently canonical implementations. The next work should converge the useful behavior deliberately rather than merging two parallel page architectures wholesale.

## Canonical convergence direction

Use the richer PR #84 vertical-slice architecture as the interaction/container baseline because it already proves:

```text
search
-> results
-> URL-addressable state
-> filter drawer
-> facet selection
-> active filters
-> focus behavior
```

Then port or reimplement the valuable PR #86 concepts into that line:

- scalable cursor traversal where the shared API contract supports it cleanly;
- visible global rank;
- result summaries that help explain lexical matches;
- accessible ranking cues;
- the North Dakota migration acceptance query;
- follow-on score/relevance evidence described in `search-relevance-plan.md`.

Do not merge two independent NgRx/search state machines or duplicate API contracts merely to preserve branch history.

## Immediate hardening before abstraction

1. **CI trigger correctness**
   - branch-specific mobile validation must run on ordinary branch pushes;
   - lint, unit test, and production build remain the minimum branch gate.
2. **Behavioral tests before extraction**
   - protect URL hydration/serialization, drawer Escape/focus return, filter-chip removal, pagination focus, loading/empty/error states, and malformed URLs.
3. **Route query safety**
   - replace runtime enum casts with explicit parsing/guards.
4. **Preserve rank**
   - keep rank visible while the richer relevance model is developed.

## Extraction sequence

Only after the above behaviors are protected:

### 1. `SearchRouteQueryAdapter`

Own:

- URL -> `SearchQuery` parsing;
- `SearchQuery` -> URL serialization;
- runtime guards for `SourceSystem` and `ResearchObjectType`;
- page/year numeric validation;
- repeatable program normalization.

This keeps malformed or hand-edited URLs from entering store state through unchecked TypeScript casts.

### 2. Filter drawer presentational component

Move drawer rendering and facet presentation into a Storybook-friendly module-declared component with explicit inputs/outputs.

Keep orchestration/search ownership in `SearchPageComponent`.

### 3. Result card / result list presentation

Extract once rank and relevance semantics are settled enough to provide stable component inputs.

This becomes the main Storybook surface for:

- rank badge;
- result metadata;
- summary/excerpt;
- Strong / Good / Moderate / Weak / Low relevance states;
- forced-colors behavior.

### 4. Keep `SearchPageComponent` as container

It should ultimately coordinate:

- route lifecycle;
- NgRx dispatch;
- page-level focus transitions;
- local drawer state;
- component composition.

It should not remain the permanent home for every route parser, facet presentation rule, result-card rendering rule, and relevance display rule.

## Proposed next PR sequence

### PR A — behavioral hardening + route adapter

- fix/retain reliable branch validation;
- expand component tests;
- add `SearchRouteQueryAdapter`;
- reject malformed URL enum values safely;
- preserve current immediate facet-search behavior.

### PR B — Storybook component extraction

- filter drawer component;
- result card/result list component;
- Storybook on the planned mobile Storybook port;
- 320px stories;
- axe coverage;
- loading/empty/error/result states.

### PR C — ranking evidence API

- additive OpenAPI fields for rank/raw score/normalized relevance metadata;
- generated TypeScript update;
- Solr score transport;
- OpenSearch `_score` transport;
- no production `explain=true`/full Solr debug payloads;
- backend normalization contract versioned but initially marked uncalibrated if necessary.

### PR D — calibrated relevance UI

- repository-owned query judgments;
- include `Where are people migrating from North Dakota to?` and `North Dakota migration` as paired acceptance queries;
- Precision@10 and nDCG@10 baseline;
- five accessible relevance bands;
- rank remains independently visible;
- unit + Storybook/axe + Playwright coverage.

### PR E — filter application UX experiment

Measure current immediate search:

```text
tap filter -> request -> facet/results update
```

against staged apply:

```text
select filters -> review -> Show N results -> one request
```

Use actual Solr/OpenSearch latency, request counts, task completion, focus stability, and live-region announcement behavior to decide whether to change the interaction.

## Testing ownership

### Unit / component

Protect pure parsing, reducer/selectors, rank/band mapping, focus behavior where practical, and page behavior with mocked store/router boundaries.

### Storybook

Use extracted presentational components, not the entire routed page, for responsive state matrices and axe.

### Playwright

Use the assembled app for URL, keyboard/focus, filter/search, pagination/cursor, 320px reflow, rank/relevance semantics, and malformed URL behavior.

### Search-quality harness

Keep ranking-quality evaluation separate from browser tests and separate from raw performance timing. Human relevance judgments and metrics are evidence about search quality; Playwright is evidence about application behavior.

## Library decision

Do not add a UI dependency just for relevance colors. Existing SCSS/design tokens are sufficient.

Do not add a production ranking dependency before using the score evidence Solr/OpenSearch already provide. Prefer the native OpenSearch Ranking Evaluation API where useful, Solr score/debug evidence for diagnostics, and a repository-owned cross-engine judged-query harness. Evaluate third-party relevance tooling only as development infrastructure after compatibility and maintenance cost are clear.

## Definition of ready for the next architecture review

The mobile search should have:

- one canonical routed search implementation;
- reliable branch CI on code changes;
- safe URL parsing;
- protected accessible drawer/pagination behavior;
- extracted Storybook-ready drawer/results components;
- visible rank;
- additive API score evidence;
- calibrated or explicitly experimental relevance bands;
- query-quality regression evidence;
- a measured decision on immediate versus staged filter application.
