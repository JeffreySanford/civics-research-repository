# Deep Pagination Runtime Hardening

## Purpose

Million-record discovery must not depend on increasingly expensive deep offsets. This workstream adds a projection-bound opaque continuation path while preserving the existing offset contract for shared/deep-linked pages during migration.

It also advances the engineering accessibility target to WCAG 2.2 A/AA while preserving the project's separate Section 508 legal-baseline language.

## Public cursor contract

Cursor traversal is a separate public endpoint:

```text
GET /search/cursor?q=climate&pageSize=25&cursor=<opaque-token>
```

The first request omits `cursor`. The response is:

```text
SearchCursorPage
  search: SearchResponse
  nextCursor: string | null
```

Callers never inspect or synthesize backend continuation state. Cursor requests do not send the legacy offset `page` parameter.

The signed cursor is bound to:

- active deterministic projection identity;
- normalized query and filters;
- page size;
- search/sort contract version;
- backend identity;
- logical zero-based page;
- backend-native continuation position.

The payload is HMAC-SHA256 signed with `CIVICS_SEARCH_CURSOR_SECRET`. Search authorization never depends on the cursor, but signing prevents callers from editing engine-native positions or request-binding metadata. Changing the configured secret intentionally invalidates outstanding cursors.

## Implemented runtime behavior

- `SearchCursorCodec`, `SearchCursorState`, `SearchCursorService` and controlled cursor errors.
- HMAC-signed opaque continuation tokens bound to projection/query/filter/page-size/sort/backend state.
- `/search/cursor` in the OpenAPI contract with generated TypeScript client types.
- Solr public traversal through `cursorMark` with deterministic `score desc,id asc` ordering and no `start` parameter.
- OpenSearch comparison-client parity through `_score desc,id asc` plus `search_after`; OpenSearch remains a comparison projection rather than the public browser backend.
- Controlled rejection of malformed, edited, wrong-query, wrong-page-size, wrong-backend and stale-projection cursors.
- NgRx-owned cursor history: Next consumes only the returned `nextCursor`; Previous replays the retained cursor for a visited logical page.
- Established cursor traversal never falls back to offsets.
- Page-zero cursor startup may use the legacy offset path only when the active projection cannot be verified (`SERVICE_UNAVAILABLE`), and that compatibility mode is announced to the reader.
- New page-zero searches use cursor mode. A direct/reloaded `?page=N` URL remains offset compatible.
- Opaque cursors never enter the browser URL/history.

## Browser and accessibility behavior

The Discovery pager keeps native Previous/Next controls and an `aria-current="page"` position. Browser evidence verifies:

- cursor request transport for Next/Previous;
- no offset `page` parameter in cursor requests;
- no cursor token in the URL;
- reloadable offset deep links;
- polite compatibility-status announcement;
- intentional focus placement on the results heading after a page change;
- focused heading remains inside the viewport;
- Previous/Next targets are at least 24 × 24 CSS pixels.

Shared Axe scans include `wcag22aa` alongside the existing WCAG 2.0/2.1 and best-practice tags. Automated scans support the WCAG 2.2 engineering target; they do not constitute a Section 508 certification claim or replace dated manual keyboard/AT evidence.

## C2 traversal evidence

Ordinary PR CI tests the harness with small deterministic fixtures. The full million-record traversal remains explicit/manual or scheduled.

Run:

```bash
pnpm research:cursor:evidence
```

The default evidence run performs two complete passes through the active `FEDERATED_1M` projection at page size 100 and records:

- starting and ending projection identity/object count;
- cursor page count and returned count;
- unique-ID and duplicate-ID counts;
- ordered-ID SHA-256 for each pass;
- deterministic-order equality across passes;
- active scale-evidence/profile validity.

The evidence passes only when the projection remains unchanged, every projected object is returned exactly once per pass, and both ordered-ID hashes are identical.

## Compatibility and non-goals

Offset paging is not removed in this PR. Existing shared links and offset consumers remain valid. Incompatible continuation is rejected rather than silently restarting.

This workstream does not mutate the C2 Gold Master, make a search index authoritative, make OpenSearch the public browser backend, add Kubernetes/vector search, or claim legal conformance from automated scans.
