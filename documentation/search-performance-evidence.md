# Search Performance Evidence

The Solr/OpenSearch comparison lab treats performance as evidence with explicit measurement boundaries rather than as a single-engine race.

## Measurement layers

Every comparison request records two distinct timing layers for each engine:

1. **API elapsed** — elapsed time measured by the Spring comparison service around the engine HTTP request. This includes local request/response transport, serialization/deserialization and engine work. It excludes browser-to-repository-API latency.
2. **Engine reported** — timing parsed from the same engine response that produced the search results:
   - Solr `responseHeader.QTime`
   - OpenSearch top-level `took`

No second timing-only request is issued. Result content and engine-reported timing therefore describe the same execution.

Solr `QTime` and OpenSearch `took` are not presented as semantically identical measurements. Their vendor definitions differ, so they are useful diagnostic boundaries rather than a basis for an unqualified cross-engine winner claim.

## Repeated benchmark protocol

The live Browser Evidence workflow uses the same normalized comparison request and requires both engines to report the same deterministic projection before timing samples are accepted.

The current protocol is:

- scenario: `FULL_TEXT_RELEVANCE`
- query: `North Dakota workforce`
- warm-up runs: 5, discarded
- measured runs: 100
- percentiles: nearest-rank p50, p95 and p99
- additional statistics: minimum, maximum and mean
- engine execution order: Solr followed by OpenSearch
- comparative performance claim: disabled

The benchmark rejects partial engine availability, projection mismatch, projection changes during collection, invalid timing values and HTTP failures rather than publishing incomplete performance evidence.

## First repeated API-boundary baseline

Before engine-native timing was added, Browser Evidence captured a 100-sample API-boundary baseline on the 181-object local CI projection after five discarded warm-up runs:

| Engine                 |  Min |   p50 |   p95 |   p99 |   Max |     Mean |
| ---------------------- | ---: | ----: | ----: | ----: | ----: | -------: |
| Solr API elapsed       | 3 ms |  8 ms | 13 ms | 16 ms | 18 ms |  8.35 ms |
| OpenSearch API elapsed | 7 ms | 13 ms | 20 ms | 23 ms | 23 ms | 13.90 ms |

These values describe one GitHub Actions container topology and a fixed Solr-then-OpenSearch execution order. They do **not** establish that either product is inherently faster in production.

The same live evidence pipeline now also captures distributions for Solr `QTime` and OpenSearch `took`, allowing application/transport overhead to be distinguished from each engine's own reported timing.

## Interpretation guardrails

Performance evidence should always retain the context required to interpret it:

- deterministic projection ID and object count,
- warm-up and measured sample counts,
- scenario and query,
- execution order,
- API elapsed and engine-reported timings as separate series,
- local/container topology,
- shard/replica/node configuration when scale testing begins,
- no claim that OpenSearch or Solr is inherently faster based on this small local index.

Future performance work should increase index size and vary concurrency/topology before making scaling conclusions. Useful checkpoints remain approximately 10,000, 100,000 and 1,000,000 documents, with the same projection and measurement discipline preserved at each scale.
