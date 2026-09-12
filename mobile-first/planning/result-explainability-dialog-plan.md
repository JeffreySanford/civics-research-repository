# Result Explainability Dialog Plan

Status: active as issue #97

## Goal

Give every search result in both Angular frontends a consistent, discoverable way to answer:

> Why did this result match this query, and what does its ranking evidence actually mean?

This is search-engine evidence presented in a user-comprehensible way. It must remain truthful about what the backend can prove and must not turn engine scores into probabilities.

## Current reuse boundary

The mobile stack is already converged to `main`, and PR #92 established the existing `shared-ui` library as the cross-frontend presentational reuse boundary.

Use that existing boundary rather than creating a new `census-ui` library.

A good split is:

- shared presentational information button;
- shared dialog content component;
- shared dialog data interface;
- app-specific adapter/orchestration that supplies query/filter context and opens the dialog.

Do not move NgRx search state, routing or app-specific workflow ownership into `shared-ui`.

## Entry point

Each result card/listing should expose a small information control associated with the result.

Recommended accessible name:

`Why this result matched: <result title>`

The visible control may use an information icon, but the accessible name must not depend on the glyph.

## Interaction model

Use a modal dialog rather than a tooltip.

A tooltip is appropriate only for short supplemental text. The intended explanation can contain multiple evidence sections, ranking context, caveats and model/version metadata. A dialog gives keyboard and screen-reader users a stable reading surface.

Mobile may visually present the dialog as a near-full-screen sheet, while larger screens may use a centered modal. Both surfaces should share the same semantic dialog contract and content model.

Required dialog behavior:

- framework-equivalent accessible dialog semantics (`role="dialog"` / `aria-modal="true"` when modal);
- visible heading such as `Why this matched`;
- focus moves into the dialog when opened;
- focus remains within the modal while open;
- Escape and an explicit Close button dismiss it;
- focus returns to the invoking information control;
- long content scrolls inside the dialog without document-level horizontal overflow at 320px;
- forced-colors/high-contrast mode retains boundaries and controls;
- no color-only ranking meaning.

## Initial content model

The first implementation should reuse evidence already owned by the API rather than infer ranking in Angular.

### Search context

- submitted query text;
- active filters that materially constrained the result set, when available.

### Result position

- global ordinal rank in the returned search ordering;
- plain-language explanation that rank is an ordering position, not a percentage or probability.

### Match-strength evidence

When `SearchResult.relevance` is present:

- relevance band (`Strong`, `Good`, `Moderate`, `Weak`, `Low`);
- normalized score only when the product language remains explicit that it is bounded search-engine evidence, not probability/confidence;
- raw engine score only as an advanced/developer detail if retained at all, never as the primary user-facing number.

When `SearchResponse.relevanceModel` is present:

- engine;
- normalization/version identifier;
- whether the model is calibrated;
- explicit calibration caveat when `calibrated=false`.

### Field-match evidence

Render the existing typed `matchEvidence[]` data:

- field label;
- matched term(s)/phrase(s).

Example:

- Title — `migration`;
- Geography — `North Dakota`;
- Program — `ACS`.

This describes where query evidence occurred. It does **not** prove each field's numerical contribution to final BM25/eDisMax scoring.

## Future ranking-factor contract

If a later product need requires a more verbose ranking explanation, extend the backend contract rather than parsing raw Solr/OpenSearch debug/explain output in the browser.

Possible additive shape:

```text
SearchResult
  rankingExplanation?
    summary?             string
    factors[]
      kind               FIELD_MATCH | PHRASE_MATCH | FIELD_BOOST | OTHER
      field?             SearchMatchField
      label              string
      detail             string
      contribution?      number

SearchResponse
  relevanceModel
    engine
    normalization
    calibrated
    rankingModelVersion?
```

`contribution` should be added only if the backend can derive a stable, defensible quantity. Otherwise the dialog should use qualitative evidence and clearly say exact contribution is unavailable.

Raw engine explain trees remain diagnostic/admin evidence, not a browser contract.

## Validation

Required automated evidence:

- component tests for conditional sections and truthful caveats;
- Storybook states for strong/weak/uncalibrated/no-evidence cases;
- keyboard open/close/Escape/focus-return tests;
- 320px Playwright reflow test;
- axe scan with the dialog open;
- forced-colors visual/semantic checks where automation is practical;
- equivalent semantics in both `census-mobile-frontend` and `discovery-ui`.

Manual assistive-technology testing is **not** a completion requirement for #97. Automated evidence must not be described as manual NVDA/JAWS/VoiceOver validation or complete Section 508 conformance.

## Explicit non-goals

- no frontend-created relevance formula;
- no `95% relevant` language unless a future calibrated probability model genuinely supports it;
- no tooltip containing the full verbose explanation;
- no raw Solr/OpenSearch debug or explain payload rendered to general users;
- no new shared UI library solely for this feature;
- no migration of application search state/routing into `shared-ui`.