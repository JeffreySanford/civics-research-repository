# PR4 Search Acceptance Case

## Purpose

Use a realistic broad Census research question to validate ranking clarity and scalable mobile result traversal.

## Acceptance query

`Where are people migrating from North Dakota to?`

Compare it with the more lexical query `North Dakota migration` to understand how the current keyword-oriented search responds when question words are removed.

## Observed baseline

The first mobile search slice returned 5,881 repository matches for the natural-language query while displaying only the first 10 records. The first page contained broad North Dakota datasets, including geography and TIGER/Line records, and provided no way to traverse the remaining result set.

## PR4 expectations

- Show the displayed result range and logical page number.
- Provide Previous and Next controls backed by cursor traversal for large result sets.
- Preserve offset-compatible paging only when cursor search is unavailable.
- Show the global engine-returned rank for each displayed record.
- Emphasize the top three records with both text and visual treatment so color is never the only signal.
- Display available result summaries to help users understand why a record may match the query.
- Do not claim that rank is an absolute relevance score.
- Do not label records Strong match, Related, or Broad match until engine-derived relevance evidence is exposed through the API and normalized intentionally.

## Follow-up relevance work

Solr and OpenSearch already calculate relevance scores and return results in score order. A later slice can expose engine-derived score evidence or a normalized relevance band through the API contract, with accessible text labels and color used only as a secondary cue.
