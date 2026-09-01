# Deep Pagination Runtime Hardening

## Purpose

Million-record discovery must not depend on increasingly expensive deep offsets. This workstream adds an opaque, request-bound continuation path while preserving the existing page/offset contract during migration.

It also advances the engineering accessibility target to WCAG 2.2 A/AA while preserving the project's separate Section 508 legal-baseline language.

## Cursor contract

The public contract will eventually expose an opaque continuation token:

```text
GET /search?q=climate&pageSize=25&cursor=<opaque-token>
```

Callers never inspect backend continuation state.

The implemented cursor envelope is bound to:

- deterministic active projection identity;
- normalized query and filters;
- page size;
- search/sort contract version;
- backend identity;
- logical zero-based page;
- backend-native continuation position.

The payload is HMAC-SHA256 signed with `CIVICS_SEARCH_CURSOR_SECRET`. Search authorization never depends on the cursor, but signing prevents callers from editing engine-native positions or request-binding metadata. Changing the configured secret intentionally invalidates outstanding cursors.

## Current implementation status

Implemented:

- `SearchCursorCodec`, `SearchCursorState` and controlled `SearchCursorException`;
- HMAC-signed opaque tokens;
- criteria fingerprints that are invariant to offset page number but include page size and search semantics;
- projection/query/backend mismatch rejection;
- logical page retained inside the continuation state;
- `SearchContinuationExecution` for engine-native continuation results;
- Solr `cursorMark` traversal using `score desc,id asc` so the unique key breaks equal-score ties;
- Solr continuation reuses the existing query/filter/facet/result mapping rather than creating a second search implementation;
- existing offset Solr behavior remains unchanged.

Still required:

- OpenSearch `search_after` parity using the same engine-neutral ordering contract;
- public OpenAPI/controller/service continuation contract;
- binding public cursor validation to `DiscoveryProjectionService.currentProjectionId()`;
- controlled HTTP 400 responses for malformed/stale/mismatched cursors;
- Angular Previous/Next cursor history and focus/status behavior;
- WCAG 2.2 axe/manual evidence uplift;
- bounded live C2 traversal evidence for both engines.

## Engine mapping

### Solr

Cursor mode uses:

```text
cursorMark=<position>
sort=score desc,id asc
rows=<pageSize>
```

The normal offset path continues to use `start` during migration. Cursor mode never sends `start`.

### OpenSearch

Planned cursor mode uses the equivalent ordered pair:

```text
sort: [_score desc, id asc]
search_after: [lastScore, lastId]
```

OpenSearch remains the comparison projection rather than being mislabeled as a second public browser backend.

## Compatibility

Offset paging is not removed in this PR. Existing bookmarks and consumers remain valid while the UI moves to cursor traversal for deep result sets.

A continuation token is valid only for the request/projection state it was created for. The API must reject incompatible continuation rather than restarting silently.

## Accessibility

Pagination is a user workflow, not merely a backend optimization. The final UI must provide:

- keyboard-operable Previous/Next controls;
- meaningful accessible names and disabled states;
- sensible focus placement after page changes;
- polite result-range/status announcements without stealing focus;
- visible focus that is not obscured;
- WCAG 2.2 target-size treatment;
- no drag/pointer-only dependency.

## C2 evidence boundary

Ordinary PR CI proves deterministic fixtures and contracts. It must not rebuild or traverse the entire million-record corpus on every pull request.

Manual/evidence-grade C2 validation will record:

- exact active projection identity;
- criteria and page size;
- page/window count;
- duplicate-ID count;
- skipped-ID/order evidence where independently checkable;
- Solr and OpenSearch continuation behavior separately.

## Non-goals

This workstream does not remove offset pagination immediately, mutate the C2 Gold Master, add Kubernetes, add vector/hybrid search, make search indexes authoritative, or claim Section 508 certification from automated scans.
