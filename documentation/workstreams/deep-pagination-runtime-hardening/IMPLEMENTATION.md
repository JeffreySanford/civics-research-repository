# Implementation Sequence

1. Extend OpenAPI with an opaque continuation token while retaining offset compatibility.
2. Add an engine-neutral cursor envelope bound to effective query/filter/sort/projection state.
3. Implement Solr `cursorMark` traversal with a deterministic unique-id tie-breaker.
4. Implement OpenSearch `search_after` traversal with the same ordering contract.
5. Add stale/tampered cursor validation and controlled API errors.
6. Update Angular paging to prefer cursor traversal while preserving current bookmark compatibility.
7. Add keyboard/focus/status evidence and WCAG 2.2-oriented browser assertions.
8. Run bounded C2 traversal evidence against both engines before merge.
