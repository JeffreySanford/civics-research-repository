# Acceptance Criteria

## Cursor integrity and compatibility

- Cursor tokens are opaque to Angular and external callers.
- Cursor payloads are HMAC-signed with a configurable stable secret.
- Cursor state is bound to effective query/filter/page-size/sort/backend/projection identity.
- Legacy offset page number is not part of the criteria fingerprint, but the logical cursor page is retained for response/navigation state.
- Malformed, edited, wrong-query, wrong-page-size, wrong-backend and stale-projection cursors fail with controlled client errors rather than restarting silently.
- Offset pagination remains covered during migration.

## Engine traversal

- Solr cursor mode uses `cursorMark` with deterministic `score desc,id asc` ordering and no `start` parameter.
- OpenSearch comparison cursor mode uses the equivalent `_score desc,id asc` plus `search_after`.
- Bounded traversal tests contain no duplicate or skipped IDs under the defined ordering contract.
- Offset and cursor paths preserve the same query/filter/facet semantics; pagination mechanics do not create a second search language.

## Public/API behavior

- The active cursor is bound to the same deterministic projection identity already owned by `DiscoveryProjectionService`.
- Public response metadata makes continuation/truncation explicit without exposing backend-native positions.
- Existing bookmarks/offset consumers continue to work during migration.

## Accessibility

- Previous/Next controls are keyboard operable with meaningful accessible names and disabled states.
- Page/result status changes are announced without stealing focus.
- Focus remains visible and is not obscured.
- Paging controls satisfy the project's WCAG 2.2 target-size intent.
- 320 px reflow, 200% zoom and forced-colors behavior remain usable.
- WCAG 2.2 A/AA is the engineering target while Section 508 remains separately described as the federal legal baseline.

## Evidence boundary

- The exact C2 retained corpus/composition identity is unchanged by pagination work.
- Heavy million-record traversal remains explicit evidence work, not normal PR CI.
- C2 evidence records projection identity, criteria, page size, measured traversal window and duplicate/skip outcomes for each engine.
