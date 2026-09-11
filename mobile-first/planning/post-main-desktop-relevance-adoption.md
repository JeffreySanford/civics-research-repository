# Post-main Desktop Search Relevance Adoption

Status: deferred until the mobile-first relevance stack is merged to `main`.

## Goal

Bring the rank + relevance presentation proven in `apps/census-mobile-frontend` into the existing `apps/discovery-ui` search results without creating a second relevance algorithm or changing engine ranking behavior.

The desktop application should present the same evidence the API already returns:

- global result rank;
- engine-native raw score as diagnostic data, not user-facing percentage copy;
- query-relative normalized score owned by the backend;
- `STRONG`, `GOOD`, `MODERATE`, `WEAK`, and `LOW` bands;
- the same green -> yellow-green -> amber -> orange -> red visual progression;
- visible text for every band so color is never the only meaning;
- forced-colors/high-contrast behavior;
- the same explanation that match labels are query-relative evidence, not absolute percentages.

Empty repository browse (`q` blank / engine `*:*`) remains explicitly unscored.

## Why wait until main

The mobile implementation is the proving ground for this presentation. Keeping the desktop change out of the stacked mobile PRs avoids widening the current review surface and lets the new API contract, score transport, normalization metadata, Storybook states, and 320px browser evidence settle first.

Once that work is on `main`, desktop adoption becomes a small convergence change rather than another branch in the search architecture.

## Implementation sequence

1. **Consume the shared contract as-is**
   - Do not calculate relevance in `discovery-ui`.
   - Preserve `SearchResult.relevance` and `SearchResponse.relevanceModel` through the existing NgRx state/selectors.
   - Preserve engine ordering; rank is the returned global position, not a client-side sort.

2. **Promote the proven badge into shared search presentation**
   - The second real consumer justifies extracting the mobile relevance badge into a small shared Angular library/module.
   - Keep the public input semantic (`STRONG | GOOD | MODERATE | WEAK | LOW`) rather than passing colors into the component.
   - Keep rank visually distinct from match strength. Rank answers _where did the engine place this?_ Match strength answers _how strong is this result relative to the best hit in this query?_

3. **Integrate with `apps/discovery-ui/src/app/pages/discovery-page.html`**
   - Add global rank near the existing result metadata.
   - Add the shared relevance badge only when `result.relevance` exists.
   - Add one concise result-list explanation when `relevanceModel` is present.
   - Do not show a badge or relevance explanation for empty browse results.
   - Do not replace provenance, access-level, content-type, or authoritative-source metadata.

4. **Retain desktop behavior**
   - Keep the existing URL-addressable facets, NgRx search lifecycle, pagination focus management, map links, and result-detail navigation unchanged.
   - Do not re-sort results in the component.
   - Do not expose raw Solr/OpenSearch score as a percentage.

5. **Validate parity**
   - Unit/component tests for all five bands and missing relevance.
   - Storybook states for the shared badge and representative result cards.
   - Existing discovery Playwright coverage plus assertions for rank, text label, forced-colors semantics where supported, and no relevance on empty browse.
   - Axe/Section 508 sweep with the badge present.

## Acceptance criteria

- The same API response produces the same rank and match label in both frontends.
- No frontend owns normalization thresholds or score math.
- Empty browse remains unscored in both frontends.
- Rank and match strength remain separate concepts.
- Color is supplementary; text survives monochrome/forced-colors rendering.
- No user-facing copy implies that a normalized score is an absolute probability or percent relevance.
- Existing desktop search, facets, pagination, focus behavior, and research-detail links remain intact.

## Follow-on calibration

The current normalization remains `calibrated: false`. A later judged-query corpus should use representative natural-language and keyword queries (including North Dakota migration) to measure Precision@10, nDCG@10, and reciprocal rank before changing band thresholds or marking a model calibrated.
