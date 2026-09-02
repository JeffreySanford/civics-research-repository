# Acceptance Criteria

## Cursor integrity and compatibility

- [x] Cursor tokens are opaque to Angular and external callers.
- [x] Cursor payloads are HMAC-signed with a configurable stable secret.
- [x] Cursor state is bound to effective query/filter/page-size/sort/backend/projection identity.
- [x] Legacy offset page number is excluded from the criteria fingerprint while logical cursor page is retained inside signed continuation state.
- [x] Malformed, edited, wrong-query, wrong-page-size, wrong-backend and stale-projection cursors fail explicitly rather than restarting silently.
- [x] `/search` offset pagination remains supported for shared/deep-linked pages during migration.
- [x] Established cursor traversal never falls back to offsets.
- [x] Page-zero `SERVICE_UNAVAILABLE` compatibility fallback is explicit and user-visible.

## Engine traversal

- [x] Solr cursor mode uses `cursorMark` with deterministic `score desc,id asc` ordering and no `start` parameter.
- [x] OpenSearch comparison continuation uses equivalent `_score desc,id asc` plus `search_after`.
- [x] Offset and continuation paths reuse the same query/filter/facet/result semantics rather than creating another search language.
- [x] Engine fixture tests cover continuation advance and termination.

## Public/API behavior

- [x] `/search/cursor` is represented in OpenAPI and generated TypeScript client types.
- [x] Cursor validation uses the deterministic active projection identity already owned by `DiscoveryProjectionService`.
- [x] Public cursor responses expose only opaque `nextCursor`, never backend-native position state.
- [x] Cursor requests omit offset `page`; existing `/search?page=N` consumers remain valid.
- [x] Cursor tokens never enter browser URLs/history.

## Angular and accessibility

- [x] Previous/Next controls are keyboard-operable native buttons with meaningful disabled states.
- [x] Current page uses `aria-current="page"`.
- [x] Page changes intentionally move focus to the replaced results heading.
- [x] Browser evidence checks focused heading remains inside the viewport.
- [x] Page-zero fallback is announced through a polite status region.
- [x] Pager controls are verified at a minimum 24 × 24 CSS pixels for the WCAG 2.2 target-size intent.
- [x] Shared Axe scans include the `wcag22aa` engineering tag.
- [x] Existing 320 px reflow, zoom and forced-colors evidence remains in place.
- [x] WCAG 2.2 A/AA remains an engineering target while Section 508 is separately described as the federal legal baseline.

## Evidence boundary

- [x] Pagination work does not mutate the exact C2 corpus/composition/projection model.
- [x] `pnpm research:cursor:evidence` provides a read-only two-pass full-projection traversal harness.
- [x] Normal CI tests the harness only with small deterministic fixtures.
- [ ] Run the full harness against the exact active C2 `FEDERATED_1M` projection and retain the generated JSON/Markdown evidence.
- [ ] Confirm the final normal CI and Browser Evidence runs are green on the completed PR head before marking ready for review.
