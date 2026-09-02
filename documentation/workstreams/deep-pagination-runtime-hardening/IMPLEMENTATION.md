# Implementation

## Backend and contract

1. `SearchCursorCodec` signs opaque HMAC-SHA256 tokens and binds them to normalized criteria, page size, sort contract, backend and active projection identity.
2. `SearchCursorService` resolves the current projection through `DiscoveryProjectionService.currentProjectionId()` before cursor traversal can begin.
3. `/search/cursor` is declared in OpenAPI and returns `SearchCursorPage { search, nextCursor }`; generated TypeScript types are the client source of truth.
4. Cursor-mode requests never accept/send the legacy offset `page` parameter. Logical page remains inside the signed continuation state for response/navigation semantics.
5. Invalid signatures, stale projections, criteria mismatch and backend mismatch fail explicitly instead of restarting.

## Engine mapping

### Solr public discovery

Public cursor traversal reuses the existing Solr query/filter/facet/result mapper with:

```text
cursorMark=<position>
sort=score desc,id asc
rows=<pageSize>
```

The unique `id` tie breaker stabilizes equal-score ordering. Cursor mode does not send `start`; the legacy `/search` offset path remains available for compatibility.

### OpenSearch comparison parity

The existing OpenSearch comparison client implements:

```text
sort: [_score desc, id asc]
search_after: [lastScore, lastId]
```

Only the returned hit `sort` tuple becomes continuation state. OpenSearch remains a comparison projection; `/search/cursor` is intentionally the public Solr path.

## Angular / NgRx workflow

Cursor mechanics live in NgRx rather than component-local state:

- page-zero search/filter submissions dispatch `cursorSearchSubmitted`;
- successful cursor pages retain the opaque cursor used to enter each visited logical page plus the current `nextCursor`;
- Next can use only the current backend-provided continuation;
- Previous can replay only a retained visited-page cursor;
- requests outside retained cursor history fail explicitly;
- direct/reloaded `?page=N` links dispatch the offset-compatible search path;
- pager clicks are mode-neutral `searchPageRequested` actions;
- cursor tokens never enter Angular router query parameters.

A page-zero cursor startup `SERVICE_UNAVAILABLE` may explicitly fall back to offset paging. The fallback has its own NgRx action and persistent user-visible status. Invalid/stale cursors and established cursor traversal never use that fallback.

## Browser fixture architecture

The pre-existing large repository API fixture is reused unchanged as `repository-api-mocks-base.ts`. The stable `repository-api-mocks.ts` facade preserves existing test imports and adds the more-specific `/api/search/cursor` transport fixture after the legacy handlers so Playwright route precedence matches production semantics.

## Accessibility uplift

- Shared Axe engineering tags now include `wcag22aa`.
- Cursor-browser evidence verifies keyboard-operable native buttons, `aria-current`, target size, intentional focus movement and focus remaining inside the viewport.
- The fallback explanation uses a polite status region rather than an alert.
- Existing reflow, zoom, forced-colors and Section 508 evidence remain separate evidence streams.

## C2 evidence harness

`tools/scripts/cursor-traversal-evidence.mjs` is a read-only explicit evidence command exposed as:

```bash
pnpm research:cursor:evidence
```

For the default `FEDERATED_1M` run it performs two complete cursor passes, keeps a Set of visited IDs per pass for duplicate detection, computes an ordered-ID SHA-256 instead of writing a million IDs to disk, compares returned/unique counts to the active projection object count, and verifies projection identity did not change during the run.

The harness implementation is covered by small Node fixtures in normal CI. The full C2 traversal is intentionally not part of ordinary PR CI.
