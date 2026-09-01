# Deep Pagination Runtime Hardening

## Purpose

This workstream closes a remaining PI-1 runtime gap: million-record discovery must not depend on increasingly expensive deep offsets.

The existing offset/page contract remains available during migration, but the preferred traversal path becomes an opaque cursor that the Angular client never interprets.

This workstream also advances the engineering accessibility target from WCAG 2.1 A/AA to WCAG 2.2 A/AA while preserving the legal Section 508 baseline distinction documented by the project.

## Scope

### Cursor/search-after contract

Add a cursor-capable discovery contract that can safely traverse large result sets.

The public API should expose an opaque continuation token, for example:

```text
GET /search?q=climate&pageSize=25&cursor=<opaque-token>
```

A response should expose the next continuation token without leaking Solr/OpenSearch implementation details.

The cursor must bind to the effective search state, including:

- query text;
- filters;
- sort;
- deterministic tie-breaker;
- active projection identity;
- search contract/version;
- page size where required for stable engine behavior.

A cursor created for one projection or query state must not silently continue against another.

### Engine mapping

The engine-neutral cursor service may encode engine-specific continuation state internally:

- Solr: `cursorMark` plus a deterministic unique-id tie-breaker;
- OpenSearch: `search_after` plus the same engine-neutral ordering contract.

The encoded token is an API implementation detail. Angular and external callers consume it only as an opaque string.

### Compatibility

The existing offset/page behavior remains available during migration so current bookmarks, browser evidence and consumers do not break abruptly.

New tests must prove that offset and cursor paths agree on the same bounded result sequence where both contracts apply.

## Accessibility and keyboard behavior

Pagination is a user workflow, not only a backend optimization.

The cursor UI must preserve:

- fully keyboard-operable Previous/Next controls;
- meaningful accessible names;
- deterministic focus placement after a page transition;
- a polite result-range/status announcement without stealing focus;
- visible focus that is not obscured by sticky or floating UI;
- adequate pointer target size and spacing;
- no drag/pointer-only dependency.

The engineering target becomes WCAG 2.2 A/AA. Section 508 remains documented separately as the federal legal baseline currently incorporating WCAG 2.0 A/AA.

Relevant WCAG 2.2 additions for this repository include:

- 2.4.11 Focus Not Obscured (Minimum);
- 2.5.7 Dragging Movements;
- 2.5.8 Target Size (Minimum);
- 3.2.6 Consistent Help where applicable;
- 3.3.7 Redundant Entry where applicable;
- 3.3.8 Accessible Authentication (Minimum) when authentication exists.

## Evidence

Required automated evidence:

- unit tests for cursor encoding/decoding and invalidation;
- Solr traversal tests with no duplicates or gaps;
- OpenSearch traversal tests with no duplicates or gaps;
- parity tests for stable ordering/tie-breaks;
- invalid/tampered cursor -> controlled client error;
- cursor from old projection -> controlled invalidation;
- browser tests for keyboard paging, announcements and focus behavior;
- WCAG 2.2-tagged axe coverage where supported;
- 320 px reflow, 200% zoom and forced-colors regression coverage.

Required live C2 evidence:

- traversal on the exact active `FEDERATED_1M` projection;
- no duplicate IDs across measured page windows;
- no skipped IDs within the measured deterministic window;
- projection identity recorded with the run;
- Solr/OpenSearch continuation semantics captured separately from latency evidence.

## Planning truth pass

This PR also reconciles planning after PRs #12-#14. The following are already delivered and must no longer appear as open work:

- named live `quality:scale` / `scale:evidence:check`;
- versioned large-corpus semantic matrix;
- API/native p50/p95/p99 evidence;
- result-set and top-N overlap;
- rank-movement evidence;
- facet-bucket difference evidence;
- execution-order metadata/invariance checks;
- structured publisher and source-system filters;
- exact local-ID and DOI comparison probes.

## Non-goals

This workstream does not:

- remove offset pagination immediately;
- change the C2 retained corpus;
- change the C2 composition or projection identities;
- introduce Kubernetes topology;
- add vector/hybrid search;
- claim Section 508 certification from automated checks.

## Exit criteria

The workstream is complete when:

1. cursor traversal is the preferred deep-discovery path;
2. offset compatibility remains covered;
3. cursor tokens are projection/query bound and safely invalidated;
4. both engines traverse without duplicate/skip defects in evidence windows;
5. browser paging is keyboard accessible and announced correctly;
6. WCAG 2.2 A/AA is the documented engineering target;
7. planning reflects what PRs #12-#14 actually delivered.
