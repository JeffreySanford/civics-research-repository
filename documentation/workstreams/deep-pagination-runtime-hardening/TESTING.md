# Testing

## Repository API / engine fixtures

Cursor codec/service/controller coverage verifies:

- opaque round trip of backend-native continuation state;
- HMAC signature rejection after token editing or secret mismatch;
- projection, criteria, page-size and backend mismatch rejection;
- logical page preservation;
- criteria fingerprint invariance to legacy offset page;
- active-projection requirement;
- controlled cursor client errors rather than silent restart.

Solr continuation fixtures verify:

- initial `cursorMark=*` request;
- `score desc,id asc` deterministic ordering;
- absence of `start` in cursor mode;
- continuation advance;
- partial/repeated-mark final-page termination;
- reuse of normal filters, facets and result mapping.

OpenSearch comparison fixtures verify:

- `_score desc,id asc` ordering;
- absence of `from` during continuation;
- continuation through the last returned `sort` tuple with `search_after`;
- invalid non-array continuation rejection before OpenSearch is called.

## Angular / NgRx unit evidence

Cursor state/effect/selector tests verify:

- page-zero cursor start;
- Next uses only the current `nextCursor`;
- Previous replays retained visited-page cursor state;
- unknown cursor history cannot synthesize an offset fallback;
- page-zero `SERVICE_UNAVAILABLE` may use the announced compatibility path;
- invalid cursor startup does not qualify for compatibility fallback;
- cursor-mode `hasNext` follows backend continuation rather than total-result arithmetic;
- offset-compatible mode retains page-count arithmetic.

## Browser/accessibility evidence

`discovery-cursor-pagination.spec.ts` verifies actual browser requests and UI state:

- initial Discovery request uses `/api/search/cursor` with no `page` or cursor parameter;
- Next sends `cursor=mock-cursor-1` with no offset page;
- Previous replays page-zero cursor state;
- cursor tokens never appear in the browser URL;
- direct `/discovery?page=1` remains `/api/search?page=1` compatible;
- results-heading focus after pagination;
- focused heading is not outside the viewport;
- `aria-current="page"` semantics;
- 24 × 24 CSS-pixel pager target size;
- page-zero 503 fallback announcement and continued offset traversal.

Shared Axe suites use the centralized engineering tags:

```text
wcag2a
wcag2aa
wcag21a
wcag21aa
wcag22aa
best-practice
```

The existing forced-colors, 320 px reflow, zoom and manual accessibility evidence remains complementary. Axe/browser automation does not replace dated keyboard/NVDA/JAWS evidence or create a Section 508 certification claim.

## Explicit live C2 evidence

With the exact C2 stack active and `quality:scale` already green, run:

```bash
pnpm research:cursor:evidence
```

The default command targets `FEDERATED_1M`, page size 100, and two full cursor passes. It writes JSON and Markdown evidence under:

```text
browser-evidence-artifacts/cursor-traversal/
```

A PASS requires:

- valid active `FEDERATED_1M` scale evidence;
- stable projection ID/object count from start through finish;
- cursor-reported total equal to active projection object count;
- returned count equal to active projection object count on every pass;
- unique count equal to returned count with zero duplicates;
- identical ordered-ID SHA-256 across both complete passes.

The harness itself has small Node fixture tests in `performance:test`. The full million-record traversal is intentionally excluded from ordinary PR CI.
