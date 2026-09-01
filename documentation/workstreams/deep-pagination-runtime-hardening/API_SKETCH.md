# API Sketch

Illustrative contract for implementation review:

```text
GET /search?q=climate&pageSize=25&cursor=<opaque>
```

Response continuation metadata should distinguish `nextCursor` from compatibility page/offset fields. The opaque envelope should carry or validate effective criteria, deterministic sort/tie-break information, projection identity and contract version without exposing Solr/OpenSearch cursor internals to clients.
