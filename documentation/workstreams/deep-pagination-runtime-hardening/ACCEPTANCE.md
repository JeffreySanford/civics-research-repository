# Acceptance Criteria

- Cursor tokens are opaque to Angular and external callers.
- Cursor state is bound to effective query/filter/sort/projection identity.
- Stale/tampered cursors fail with a controlled client error.
- Solr and OpenSearch use deterministic ordering with a unique tie-breaker.
- Measured traversal windows contain no duplicate or skipped IDs.
- Offset pagination remains covered during migration.
- Previous/Next controls are keyboard operable and preserve sensible focus.
- Result range/status changes are announced without stealing focus.
- WCAG 2.2 A/AA is documented as the engineering target while Section 508 remains separately described.
- C2 corpus/composition identities do not change as a side effect of pagination work.
