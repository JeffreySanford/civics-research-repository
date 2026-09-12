# Result Explainability Dialog Plan

Status: completed by issue #97 / PR #103

## Goal

Give every search result in both Angular frontends a consistent, discoverable way to answer:

> Why did this result match this query, and what does its ranking evidence actually mean?

This is search-engine evidence presented in a user-comprehensible way. It remains truthful about what the backend can prove and does not turn engine scores into probabilities.

## Implemented outcome

PR #103 implemented the plan through the existing `shared-ui` boundary:

- `SearchExplainabilityDialogComponent` owns shared presentational semantics;
- both Angular frontends use the same result-specific `Why this matched` interaction;
- query/filter context remains adapted by each application;
- ordinal rank remains distinct from query-relative match strength;
- relevance model/normalization/calibration metadata is rendered with explicit caveats;
- typed field/term `matchEvidence` is rendered without exposing raw engine explain trees;
- native modal-dialog behavior provides explicit Close/Escape behavior and focus return;
- Storybook/component/browser/axe evidence covers representative explanation states and both frontend consumers.

Manual assistive-technology testing was not a completion requirement and is not implied by the automated evidence.

## Reuse boundary

The mobile stack is converged to `main`, and PR #92 established the existing `shared-ui` library as the cross-frontend presentational reuse boundary.

That existing boundary is used rather than creating a new `census-ui` library.

The split remains:

- shared presentational information button;
- shared dialog content component;
- shared dialog data interface;
- app-specific adapter/orchestration that supplies query/filter context.

NgRx search state, routing and app-specific workflow ownership remain outside `shared-ui`.

## Entry point

Each result card/listing exposes a small information control associated with the result.

Accessible name:

`Why this result matched: <result title>`

The accessible name does not depend on a glyph or repeated generic button label.

## Interaction model

The implementation uses a modal dialog rather than a tooltip.

A tooltip is appropriate only for short supplemental text. The explanation contains multiple evidence sections, ranking context, caveats and model/version metadata. A dialog gives keyboard and screen-reader users a stable reading surface.

Mobile can visually present the dialog as a near-full-screen sheet while larger screens use a centered modal. Both surfaces share the same semantic dialog contract and content model.

Required behavior delivered by the shared component/browser evidence includes:

- accessible native modal-dialog semantics;
- visible `Why this matched` heading;
- focus movement into the dialog when opened;
- modal focus containment through native dialog behavior;
- Escape and an explicit Close button;
- focus return to the invoking information control;
- narrow-screen content wrapping without document-level horizontal overflow;
- forced-colors/high-contrast boundaries and controls;
- no color-only ranking meaning.

## Content model

The implementation reuses evidence already owned by the API rather than inferring ranking in Angular.

### Search context

- submitted query text;
- active filters that materially constrained the result set, when available.

### Result position

- global ordinal rank in the returned search ordering;
- plain-language explanation that rank is an ordering position, not a percentage or probability.

### Match-strength evidence

When `SearchResult.relevance` is present:

- relevance band (`Strong`, `Good`, `Moderate`, `Weak`, `Low`);
- normalized evidence with explicit wording that it is not probability/confidence.

When `SearchResponse.relevanceModel` is present:

- engine;
- normalization/version identifier;
- whether the model is calibrated;
- explicit calibration caveat when `calibrated=false`.

### Field-match evidence

The dialog renders the existing typed `matchEvidence[]` data:

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

## Validation delivered

Automated evidence includes:

- component tests for conditional sections and truthful caveats;
- Storybook states for strong/weak/uncalibrated/no-evidence cases;
- keyboard open/close/focus-return browser assertions;
- narrow/mobile presentation evidence;
- axe scans with the dialog open;
- forced-colors-compatible styling/non-color semantics;
- equivalent semantics in both `census-mobile-frontend` and `discovery-ui`.

Manual assistive-technology testing is **not** a completion requirement for #97. Automated evidence must not be described as manual NVDA/JAWS/VoiceOver validation or complete Section 508 conformance.

## Explicit non-goals retained

- no frontend-created relevance formula;
- no `95% relevant` language unless a future calibrated probability model genuinely supports it;
- no tooltip containing the full verbose explanation;
- no raw Solr/OpenSearch debug or explain payload rendered to general users;
- no new shared UI library solely for this feature;
- no migration of application search state/routing into `shared-ui`.
