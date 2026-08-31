# 100K Search Comparison — Fixed-Order Baseline

Captured on 2026-08-31 against the proven `FEDERATED_100K` projection.

This evidence records the first repeatable 100K Solr/OpenSearch search-performance baseline. It is intentionally labeled **fixed-order** because `SearchComparisonService` executed Solr before OpenSearch for every comparison request at the time of capture. The result is useful diagnostic evidence, not a universal engine-performance claim.

## Corpus identity

```text
profile        FEDERATED_100K
retained       100000 federated records
projected      100181 documents
projectionId   125fc791065fd8c68806f62a52c2203c2ce74a083954ce469f3e0cd627015024
parity         true
```

The same deterministic projection ID had already been reproduced after a complete stack recreation before this benchmark was run.

## Adaptive filtering workload

The benchmark did not use `contentType=DATASET` as the filtering workload because Data.gov normalizes every harvested record as a dataset. Instead, it selected a live program facet with identical Solr/OpenSearch counts and useful selectivity:

```text
field          program
value          U.S. Department of Commerce, U.S. Census Bureau, Geography Division, Geographic Customer Services Branch
matches        1419 documents
selectivity    1.42%
```

## Method

Two passes were run without changing the projection:

1. quick diagnostic: 3 warmups + 20 measured samples per scenario,
2. evidence pass: 5 warmups + 100 measured samples per scenario.

Scenarios:

- `FULL_TEXT_RELEVANCE` — query `North Dakota workforce`,
- `FACETED_SEARCH` — unqualified facet/aggregation workload,
- `FILTERING_SELECTIVE_PROGRAM` — the 1.42% Census program filter above.

Application elapsed time is the primary comparable boundary. Solr `QTime` and OpenSearch `took` are retained as secondary engine diagnostics, but their vendor semantics are not assumed to be identical.

## Quick 20-sample pass

### API elapsed p50 / p95 / p99

| Scenario                    | Solr       | OpenSearch  |
| --------------------------- | ---------- | ----------- |
| Full-text relevance         | 6 / 7 / 7  | 11 / 14 / 15 |
| Faceted search              | 6 / 8 / 14 | 14 / 16 / 18 |
| Selective program filtering | 4 / 5 / 5  | 10 / 12 / 12 |

### Engine-reported p50 / p95 / p99

| Scenario                    | Solr QTime | OpenSearch took |
| --------------------------- | ---------- | --------------- |
| Full-text relevance         | 2 / 2 / 2  | 6 / 9 / 9       |
| Faceted search              | 3 / 4 / 9  | 9 / 10 / 11     |
| Selective program filtering | 1 / 1 / 1  | 6 / 6 / 7       |

The quick pass already showed Solr ahead at p50 and p95 for all three workloads.

## Full 100-sample evidence pass

### API elapsed p50 / p95 / p99

| Scenario                    | Solr        | OpenSearch |
| --------------------------- | ----------- | ---------- |
| Full-text relevance         | 3 / 4 / 14  | 6 / 8 / 9  |
| Faceted search              | 4 / 5 / 5   | 11 / 12 / 13 |
| Selective program filtering | 3 / 3 / 4   | 7 / 10 / 13 |

### Engine-reported p50 / p95 / p99

| Scenario                    | Solr QTime | OpenSearch took |
| --------------------------- | ---------- | --------------- |
| Full-text relevance         | 1 / 1 / 1  | 3 / 3 / 4       |
| Faceted search              | 2 / 3 / 3  | 8 / 9 / 9       |
| Selective program filtering | 1 / 1 / 1  | 4 / 5 / 8       |

## Initial interpretation

The 20-sample and 100-sample passes agree on the main ordering:

- Solr has lower API p50 and p95 in every tested workload.
- The largest median/tail separation appears in faceting and selective filtering.
- Engine-reported timing shows the same broad direction, so the gap is not explained solely by Spring or HTTP serialization overhead.
- Full-text Solr p99 reached 14 ms in the 100-sample pass while OpenSearch p99 was 9 ms, so Solr showed one notable tail-latency exception even though its full-text p50/p95 remained lower.

At this point the defensible statement is:

> In this repository's matched-feature, single-node, 100,181-document configuration, the fixed-order diagnostic showed materially lower Solr p50/p95 latency than OpenSearch for the tested full-text, faceting, and selective-filter workloads.

It is **not yet** defensible to claim that Solr is inherently or universally faster than OpenSearch.

## Important configuration context

The OpenSearch projection already uses:

```text
number_of_shards    1
number_of_replicas  0
```

so the local result is not explained by an obviously excessive OpenSearch shard count.

OpenSearch reproduces the application's self-excluding facet semantics with multiple scoped filter aggregations and a post-filter. Solr uses tagged filter queries and facet exclusions. Those equivalent user-facing semantics are implemented differently by the engines and may contribute to the observed faceting/filtering gap.

## Next experiment

Remove the largest remaining benchmark confound by measuring the exact same corpus and adaptive filter twice:

```text
SOLR_FIRST
OPENSEARCH_FIRST
```

For each order, repeat the same warmup/sample counts and scenarios. A p50/p95 lead that survives both execution orders is stronger evidence that the observed gap is not simply an order/cache effect.
