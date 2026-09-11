# Mobile-First Search Relevance and Ranking Plan

Status: proposed follow-up to the first mobile search vertical slice

## Purpose

The mobile search experience should do more than return matching repository records. It should help a user understand how strongly each record matches the submitted query, preserve the search engine's ordering evidence, and provide a reproducible way to improve ranking quality over time.

A representative acceptance query is:

```text
Where are people migrating from North Dakota to?
```

This query is intentionally useful because it exposes the difference between:

1. lexical repository retrieval;
2. relevance ranking within that repository result set; and
3. answering a structured demographic question from authoritative Census data.

The relevance work in this plan concerns #1 and #2. A later intent-aware answer layer may translate natural-language questions into structured Census dimensions, but it must not fabricate demographic answers from search ranking alone.

## Current Behavior

The repository search engines already calculate relevance and return results in score order. The mobile UI currently exposes order/rank more clearly than the first slice did, but the generated API contract does not yet expose enough ranking evidence for the UI to distinguish a genuinely strong match from a merely broad lexical match.

Global rank remains valuable and should stay visible. Rank and score must not be treated as interchangeable concepts:

- **rank** answers "where did this result appear?"
- **engine score** answers "how strongly did this engine score this result for this query?"
- **judged relevance** answers "how useful did a human evaluator consider this result for the information need?"

Only the third is direct evidence of actual usefulness. The product should therefore avoid presenting a raw BM25 score as a probability or universal relevance percentage.

## Proposed User-Facing Relevance Bands

Prefer five discrete bands over a continuous rainbow:

| Band           | Visual direction | Meaning                                                            |
| -------------- | ---------------- | ------------------------------------------------------------------ |
| Strong match   | green            | highest-confidence query match for this result set                 |
| Good match     | yellow-green     | clearly related, but weaker than the leading group                 |
| Moderate match | amber/yellow     | relevant enough to inspect, with broader or partial term coverage  |
| Weak match     | orange           | limited lexical/query evidence                                     |
| Low match      | red              | returned by the engine but weakly aligned with the submitted query |

Rules:

- Color is never the only encoding. Every band requires visible text and an accessible name.
- Forced-colors/high-contrast mode must preserve meaning without relying on hue.
- Do not use a continuous 0-100 color gradient in the first implementation. It implies more precision than BM25-style retrieval scores justify.
- Preserve the existing rank badge independently from the relevance band.
- Avoid language such as "95% relevant" unless a later calibrated model can justify that interpretation.

## API Contract Direction

Yes, the API should be adjusted before the UI claims score-based relevance bands.

The browser should not independently reverse-engineer Solr/OpenSearch scoring. The backend should expose optional ranking evidence through the existing generated OpenAPI boundary so both Angular applications can consume the same semantics.

Proposed additive model:

```text
SearchResult
  rank?                 integer
  relevance?
    rawScore?           number
    normalizedScore?    number  // bounded 0..1 within the documented normalization model
    band?               STRONG | GOOD | MODERATE | WEAK | LOW

SearchResponse
  relevanceModel?
    engine              SOLR | OPENSEARCH | FEDERATED | REPOSITORY
    normalization       string/version identifier
    calibrated          boolean
```

Design constraints:

- New fields should be optional/additive so existing consumers remain compatible.
- `rawScore` is engine-native evidence and is not comparable across unrelated queries or necessarily across engines.
- `normalizedScore` is query-relative unless a future calibration model proves otherwise.
- The normalization algorithm must be versioned.
- The backend, not Angular, owns normalization and band assignment once those semantics become product behavior.
- Cursor/offset pagination must preserve a stable global rank when practical.

## Score Collection

### Solr

Return the ordinary score field with search results for normal requests. Use Solr debug/explain output only for diagnostics and relevance-development evidence, not every production request.

### OpenSearch

Return `_score` for ordinary ranked results. Use the Explain API only for targeted diagnostics because explanation output is comparatively expensive.

### Important guardrail

Do not turn on full score explanations for normal mobile search traffic. Score explanations are development evidence; rank/raw score are normal response metadata.

## Normalization and Calibration

Do not initially hard-code arbitrary thresholds such as `>= 0.8 = green` and call them objective relevance.

Recommended sequence:

1. expose rank and raw engine score;
2. capture query-relative normalized scores experimentally;
3. create a small relevance-judgment fixture set;
4. measure ranking quality against those judgments;
5. calibrate band thresholds from observed judged relevance;
6. mark the API model `calibrated: true` only after that evidence exists.

An initial normalization experiment may use a top-score ratio or another bounded query-relative transform, but the UI must label it as relative search-match strength until calibrated.

## Relevance Judgment Fixture

Create a repository-owned test fixture containing representative queries and human judgments.

Example shape:

```text
query: "Where are people migrating from North Dakota to?"
results:
  - id: ...
    rating: 4   # directly useful
  - id: ...
    rating: 3   # strongly related
  - id: ...
    rating: 2   # partially useful
  - id: ...
    rating: 1   # weakly related
  - id: ...
    rating: 0   # not useful for the information need
```

The fixture should eventually include multiple query classes:

- natural-language demographic question;
- concise keyword equivalent (`North Dakota migration`);
- exact phrase;
- rare term;
- broad geography query;
- agency/program query;
- no-result control;
- faceted query.

Recommended ranking metrics:

- Precision@10
- nDCG@10
- Mean Reciprocal Rank / Reciprocal Rank for answer-seeking queries
- optional Recall@20 where a bounded relevant set can be identified

The judged set is quality evidence, not a new search corpus and not a performance-timing workload unless explicitly preregistered for that purpose.

## Tooling / Library Decision

No new Angular runtime library is required for the relevance colors or badges. CSS/design tokens plus typed API data are sufficient.

No new backend ranking library is required for the first score-exposure step either. Solr and OpenSearch already calculate relevance scores.

For evaluation tooling:

- OpenSearch has a native Ranking Evaluation API that accepts document relevance ratings and computes ranking-quality metrics. Prefer using that capability for OpenSearch-side evaluation where it fits the repository harness.
- Solr can expose score/explain evidence directly. A small repository-owned evaluator can calculate the shared metrics from a judged fixture so the Solr/OpenSearch comparison remains explicit and reproducible.
- Rated Ranking Evaluator (RRE) is a possible development-time experiment for Solr/Elasticsearch-style evaluation, but its published support should be verified against the exact OpenSearch version before adoption. Do not add it as a production runtime dependency merely to color search cards.

Preferred first implementation: native engine evidence + repository-owned typed evaluation fixture and metrics. Add a third-party evaluator only if it clearly reduces maintenance without obscuring the experiment.

## Component Architecture Follow-Up

The proven search page is now large enough that the next extraction boundaries are visible. Do not rewrite it before behavior is protected by tests.

Recommended extraction order:

1. `SearchRouteQueryAdapter`
   - parse `ActivatedRoute` query parameters into `SearchQuery`;
   - serialize `SearchQuery` back into URL parameters;
   - validate runtime enum values instead of TypeScript-casting arbitrary URL strings;
   - unit-test malformed/hand-edited URL input.
2. Presentational filter drawer component
   - inputs/outputs only;
   - Storybook-friendly loading/selected/facet states;
   - retain focus/escape behavior either in the component or a small interaction controller with explicit tests.
3. Result card / result list presentation
   - render rank and relevance band;
   - keep search orchestration in the page/container;
   - become the primary Storybook surface for relevance-state testing.
4. Keep `SearchPageComponent` as the routed orchestration/container layer.

Do not extract abstractions merely to reduce line count. Extract after the behavior contract is protected and reuse/testing value is clear.

## Route Input Validation

Runtime URL values must be parsed, not asserted with TypeScript casts.

At minimum validate:

- `sourceSystem` against the supported `SourceSystem` values;
- `type` against supported `ResearchObjectType` values;
- positive integer vintage year;
- non-negative page;
- repeatable program parameters after trimming/empty-value removal.

Malformed values should be ignored or normalized to a safe default rather than entering NgRx state as invalid enum values.

## Filter Application UX Experiment

Keep the current immediate-search behavior for now:

```text
tap facet -> search -> facets/results update
```

Do not assume that is the final mobile interaction model.

Measure it against realistic repository latency and compare with a staged drawer model:

```text
select several filters
-> review selection
-> Show N results
-> close drawer and search
```

Evaluation criteria:

- request count per successful refinement task;
- median/p95 perceived wait between taps;
- accidental selection correction cost;
- focus stability and screen-reader announcement volume;
- task completion time on a phone-sized viewport;
- Solr/OpenSearch latency under realistic filter combinations.

Use the existing search-performance work to inform this UX decision rather than treating performance research and interaction design as unrelated tracks.

## Test Strategy for Rank and Relevance

### Unit tests

- route adapter accepts valid values and rejects malformed enum/year/page inputs;
- rank calculation/preservation across page or cursor transitions;
- normalization function edge cases if normalization is implemented server-side in repository code;
- deterministic relevance-band mapping at calibrated boundaries;
- color token selection is not the only semantic output;
- reducer/selectors preserve relevance metadata without mutating it.

### Angular component tests

Cover at least:

- search landmark;
- filter drawer opens as an accessible dialog;
- Escape closes and focus returns to the trigger;
- URL hydration populates query/filter state;
- URL updates after filtering;
- filter-chip removal;
- pagination/result-heading focus behavior;
- loading, empty, error, and populated states;
- rank badge rendering;
- all five relevance labels render with accessible text independent of color.

### Storybook

Prefer stories around extracted presentational components rather than the entire routed page.

Required stories:

- result card: Strong / Good / Moderate / Weak / Low;
- ranked result list with mixed relevance bands;
- filter drawer default, selected, long-list, empty facet, and loading states;
- results loading / empty / error / populated states;
- 320px viewport story for ranked mixed-relevance results;
- forced-colors story/check where supported.

Run axe against representative stories.

### Playwright / E2E

At minimum:

- 320px search journey with axe;
- submit representative query and verify ordered rank labels;
- verify relevance text survives without relying on CSS color;
- open filter drawer, apply/remove a filter, verify URL and result update;
- Escape-close + focus restoration;
- paginate and verify results-heading focus;
- loading/empty/error journeys;
- malformed query-string values do not break the page;
- compare immediate filter-search behavior against captured request count/latency when the staged-filter experiment begins.

### Search-quality regression test

Run the judged query fixture against the current engine configuration and record ranking metrics. Ranking changes that materially degrade the agreed metric floor should fail or require an explicit evidence update.

This test is separate from ordinary Angular unit tests and from raw latency performance evidence.

## Acceptance Criteria for the First Relevance Slice

The first relevance implementation is complete when:

- rank remains visible and tested;
- API exposes optional score evidence through OpenAPI/generated client types;
- raw engine score is never presented as an absolute percentage;
- at least one documented normalization model exists;
- five text-labeled relevance bands render accessibly;
- a judged relevance fixture includes the North Dakota migration acceptance query;
- unit, Storybook/axe, and Playwright coverage exercise ranking/relevance states;
- search-quality metrics are captured reproducibly;
- production search does not enable expensive full explain payloads;
- malformed URL enum values are safely rejected/normalized;
- mobile validation CI is triggered by ordinary branch code changes.
