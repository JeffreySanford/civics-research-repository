# Post-main Desktop Search Relevance Adoption

Status: **completed by PR #92**

This document is retained as implementation history for the cross-frontend rank/relevance convergence.

## Delivered outcome

PR #92 promoted the proven mobile search rank/relevance presentation into the existing `shared-ui` library and consumed the same semantics from both Angular frontends.

Delivered behavior:

- global result rank is presented as ordinal position in the server-returned result set;
- query-relative match strength remains server-owned;
- `STRONG`, `GOOD`, `MODERATE`, `WEAK`, and `LOW` bands share one presentational implementation;
- empty repository browse remains unranked/unscored;
- color is supplementary to visible text and forced-colors semantics;
- `discovery-ui` does not calculate relevance, re-sort results or reinterpret raw engine scores as percentages;
- existing desktop facets, URL state, focus management, map/detail navigation and NgRx lifecycle remain intact;
- component and browser/axe evidence cover the shared presentation.

## Current reuse boundary

The cross-frontend presentational boundary is the existing `shared-ui` library. A separate `census-ui` library is not needed for the current architecture.

Async/search-domain state remains owned by each application. Shared UI accepts semantic inputs and does not own routing, NgRx lifecycle or search requests.

## Follow-on

Issue #97 now extends this convergence from badges/rank presentation into the richer shared result-explainability dialog.

The current relevance normalization remains explicitly uncalibrated. Any future threshold/model change should be driven by a judged-query evaluation corpus rather than frontend preference, and should preserve the distinction between engine evidence and probability/confidence.
