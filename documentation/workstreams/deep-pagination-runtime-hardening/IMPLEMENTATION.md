# Implementation

## Completed foundation

1. Added an engine-neutral cursor envelope and controlled `SearchCursorException`.
2. Bound cursor state to normalized query/filter/page-size/sort semantics plus active projection and backend identity.
3. HMAC-SHA256 signed the opaque payload with `CIVICS_SEARCH_CURSOR_SECRET` so callers cannot edit backend-native positions or request-binding metadata.
4. Added logical page state to the continuation envelope while deliberately excluding legacy offset page from the criteria fingerprint.
5. Added `SearchContinuationExecution` as a continuation-only result type without changing existing comparison timing contracts.
6. Implemented Solr `cursorMark` traversal in the existing `SolrSearchClient` using `score desc,id asc` and the same filters/facets/result mapper as offset search.
7. Preserved the current Solr offset path unchanged during migration.
8. Added deterministic HTTP-fixture tests proving cursor mode omits `start`, advances `cursorMark`, uses the unique-ID tie breaker and terminates on a partial or repeated-mark final page.

## Next implementation slices

### OpenSearch comparison parity

- Add `search_after` continuation to the existing `OpenSearchProjectionClient` rather than creating a second query mapper.
- Use the engine-neutral order `_score desc, id asc`.
- Serialize only the last hit's returned `sort` array as the backend-native cursor position.
- Keep OpenSearch explicitly a comparison projection, not a second public browser backend.

### Public API/service contract

- Add optional cursor-mode request semantics without breaking existing `page`/`pageSize` bookmarks.
- Return opaque `nextCursor`/`hasMore` metadata.
- Bind token validation to `DiscoveryProjectionService.currentProjectionId()`.
- Reject malformed, wrong-query, wrong-page-size, wrong-backend and stale-projection cursors with HTTP 400; never silently restart traversal.
- Define and test the migration rule that decides when an initial request uses cursor-compatible ordering versus legacy offset ordering.

### Angular workflow

- Treat cursors as opaque strings.
- Keep a browser-side history stack for Previous while Next consumes `nextCursor`.
- Preserve filters/query when paging.
- Announce result-range changes politely without moving focus.
- Keep visible/keyboard focus on the paging control or an intentional results heading according to the tested workflow.

### Accessibility/evidence

- Add `wcag22aa` to the centralized axe tag set where supported.
- Add deterministic/browser checks for focus not obscured, target size and large-result keyboard flow.
- Preserve 320 px reflow, 200% zoom and forced-colors evidence.
- Run bounded C2 traversal evidence separately from normal CI and record projection identity, criteria, page size, duplicate count and engine continuation behavior.
