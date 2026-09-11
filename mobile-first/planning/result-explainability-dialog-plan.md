# Result Explainability Dialog Plan

Status: planned for post-convergence implementation; do not implement in the current mobile filter/URL slice.

## Goal

Give every search result in both Angular frontends a consistent, discoverable way to answer:

> Why did this result match this query, and what does its ranking evidence actually mean?

This is developer/search-engine information presented in a user-comprehensible way. It should remain truthful about what the backend can prove and should not turn engine scores into probabilities.

## Entry point

Each result card/listing should expose a small information button anchored at the lower-right edge of the listing.

Recommended accessible name:

`Why this result matched: <result title>`

The visible control can use an information icon, but the accessible name must not depend on the icon glyph.

## Interaction model

Use a modal dialog rather than a tooltip.

A tooltip is appropriate only for short supplemental text. The intended explanation is deliberately richer and can contain multiple evidence sections, ranking context, caveats, and model/version metadata. A dialog also gives keyboard and screen-reader users a stable reading surface.

Mobile may visually present the dialog as a near-full-screen sheet, while larger screens may use a centered modal. Both surfaces should share the same semantic dialog contract and content model.

Required dialog behavior:

- `role="dialog"` / framework-equivalent accessible dialog semantics.
- `aria-modal="true"` when modal.
- visible heading such as `Why this matched`.
- focus moves into the dialog when opened.
- focus is trapped while open.
- Escape and an explicit Close button dismiss it.
- focus returns to the invoking information button.
- long content scrolls inside the dialog without causing document-level horizontal overflow at 320px.
- forced-colors/high-contrast mode retains boundaries and controls.
- no color-only ranking meaning.

## Initial content model

The first implementation should reuse evidence already owned by the API rather than infer ranking in Angular.

### Search context

- submitted query text
- active filters that materially constrained the result set, when available

### Result position

- global ordinal rank in the returned search ordering
- plain-language explanation that rank is an ordering position, not a percentage or probability

### Match-strength evidence

When `SearchResult.relevance` is present:

- relevance band (`Strong`, `Good`, `Moderate`, `Weak`, `Low`)
- normalized score, displayed as a bounded search-engine evidence value only if the product language remains explicit that it is not probability/confidence
- raw engine score as an advanced/developer detail, not the primary user-facing number

When `SearchResponse.relevanceModel` is present:

- engine
- normalization/version identifier
- whether the model is calibrated
- calibration caveat when `calibrated=false`

### Field-match evidence

Render the existing typed `matchEvidence[]` data:

- field label
- matched term(s)/phrase(s)

Example:

- Title — `migration`
- Geography — `North Dakota`
- Program — `ACS`

This describes where query evidence occurred. It does **not** by itself prove each field's numerical contribution to final BM25/eDisMax scoring.

## Future ranking-factor contract

If we later want a genuinely verbose ranking explanation, extend the backend contract rather than parsing raw Solr `debug/explain` output in the browser.

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

`contribution` should be added only if the backend can derive a stable, defensible quantity. Otherwise the dialog should use qualitative evidence and clearly say that exact contribution is unavailable.

Raw Solr explain trees remain diagnostic/admin evidence, not a browser contract.

## Cross-frontend reuse boundary

Implement this only after the mobile stack is converged/merged and the shared `census-ui` boundary is established.

A good reuse split is:

- shared presentational information button
- shared dialog content component
- shared dialog data interface
- app-specific adapter that supplies query/filter context and opens the dialog

Do not move NgRx search state or routing into the shared UI library.

The mobile-first frontend and `discovery-ui` should consume the same server-owned `SearchResult.relevance`, `matchEvidence`, and `SearchResponse.relevanceModel` semantics.

## Validation

Required automated evidence:

- component tests for conditional sections and truthful caveats
- Storybook states for strong/weak/uncalibrated/no-evidence cases
- keyboard open/close/Escape/focus-return tests
- 320px Playwright reflow test
- axe scan with dialog open
- forced-colors visual/semantic check where automation is practical

Required manual evidence:

- NVDA or JAWS desktop smoke test
- VoiceOver mobile smoke test when available
- 200% and 400% zoom/reflow
- keyboard-only reading and dismissal

## Explicit non-goals

- no frontend-created relevance formula
- no `95% relevant` language unless a future calibrated probability model genuinely supports it
- no tooltip containing the full verbose explanation
- no raw Solr `debug` or `explain` payload rendered to general users
- no implementation in PR #91; this document reserves the feature for the post-convergence shared UI/desktop phase
