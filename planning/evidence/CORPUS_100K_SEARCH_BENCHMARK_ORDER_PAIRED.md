# 100K Search Comparison — Execution-Order Paired Evidence

Captured on 2026-08-31 against the proven `FEDERATED_100K` projection.

This evidence strengthens the earlier fixed-order baseline by running the same deterministic corpus and the same adaptive filtering workload twice: once with Solr executed first and once with OpenSearch executed first. The purpose is to test whether the earlier Solr latency lead was merely an execution-order/cache artifact.

## Corpus identity

```text
profile        FEDERATED_100K
retained       100000 federated records
projected      100181 documents
projectionId   125fc791065fd8c68806f62a52c2203c2ce74a083954ce469f3e0cd627015024
parity         true
evidence       valid
violations     none
```

The projection ID is the same deterministic SHA-256 reproduced after prior complete stack recreation and reactivation.

## Adaptive filtering workload

The selective program was discovered once and reused unchanged for both execution orders:

```text
field          program
value          U.S. Department of Commerce, U.S. Census Bureau, Geography Division, Geographic Customer Services Branch
matches        1419 documents
selectivity    1.42%
```

## Method

Two paired passes were captured without changing the active projection:

1. quick paired diagnostic: 3 warmups + 20 measured samples per scenario and execution order,
2. full paired evidence: 5 warmups + 100 measured samples per scenario and execution order.

Execution orders:

```text
SOLR_FIRST
OPENSEARCH_FIRST
```

Scenarios:

- `FULL_TEXT_RELEVANCE` — query `North Dakota workforce`,
- `FACETED_SEARCH` — unqualified facet/aggregation workload,
- `FILTERING_SELECTIVE_PROGRAM` — the 1.42% Census program filter above.

Application elapsed time is the primary comparable boundary. Solr `QTime` and OpenSearch `took` remain useful secondary diagnostics but are not treated as identical vendor timing semantics.

## Quick paired pass — 20 measured samples

### SOLR_FIRST — API elapsed p50 / p95 / p99

| Scenario                    | Solr       | OpenSearch  |
| --------------------------- | ---------- | ----------- |
| Full-text relevance         | 6 / 7 / 7  | 11 / 13 / 15 |
| Faceted search              | 6 / 8 / 16 | 13 / 14 / 14 |
| Selective program filtering | 4 / 5 / 5  | 10 / 11 / 12 |

### OPENSEARCH_FIRST — API elapsed p50 / p95 / p99

| Scenario                    | Solr      | OpenSearch |
| --------------------------- | --------- | ---------- |
| Full-text relevance         | 4 / 5 / 6 | 7 / 9 / 9  |
| Faceted search              | 5 / 6 / 6 | 11 / 12 / 13 |
| Selective program filtering | 4 / 5 / 5 | 8 / 9 / 9  |

The quick pass showed Solr leading p50 and p95 in all three workloads under both execution orders.

## Full paired evidence — 100 measured samples

### SOLR_FIRST — API elapsed p50 / p95 / p99

| Scenario                    | Solr      | OpenSearch |
| --------------------------- | --------- | ---------- |
| Full-text relevance         | 3 / 3 / 4 | 6 / 6 / 6  |
| Faceted search              | 4 / 5 / 5 | 11 / 12 / 13 |
| Selective program filtering | 2 / 3 / 3 | 7 / 8 / 9  |

### OPENSEARCH_FIRST — API elapsed p50 / p95 / p99

| Scenario                    | Solr      | OpenSearch |
| --------------------------- | --------- | ---------- |
| Full-text relevance         | 2 / 2 / 2 | 4 / 5 / 6  |
| Faceted search              | 4 / 4 / 5 | 9 / 10 / 12 |
| Selective program filtering | 2 / 2 / 3 | 6 / 6 / 7  |

## Order robustness

The benchmark runner reported:

```text
FULL_TEXT_RELEVANCE
  Solr leads p50 both orders = true
  Solr leads p95 both orders = true

FACETED_SEARCH
  Solr leads p50 both orders = true
  Solr leads p95 both orders = true

FILTERING_SELECTIVE_PROGRAM
  Solr leads p50 both orders = true
  Solr leads p95 both orders = true
```

## Interpretation

The principal ordering confound did not explain the earlier result:

- Solr retained lower API p50 and p95 in every workload when Solr executed first.
- Solr retained lower API p50 and p95 in every workload when OpenSearch executed first.
- Reversing order improved both engines in the second pass, consistent with additional warming, but it did not reverse the ranking.
- Faceting and selective filtering continue to show the largest separation.
- The result is now substantially stronger than the original fixed-order baseline because the same corpus, filter, warmup/sample counts, and feature semantics were tested under both call orders.

A defensible repository-specific statement is now:

> On this 100,181-document federal metadata corpus, under the repository's matched-feature single-node configuration, Solr consistently delivered lower p50/p95 application-boundary latency than OpenSearch across the tested full-text, faceting, and selective-filter workloads, and that lead persisted when engine execution order was reversed.

This remains a local single-topology result. It is not evidence that Solr is universally faster than OpenSearch across other workloads, mappings, shard layouts, hardware, JVM settings, or distributed production deployments.

## Configuration context

The OpenSearch projection uses one shard and zero replicas. Both engines receive the same normalized deterministic projection. OpenSearch implements the application's self-excluding facet behavior with scoped filter aggregations plus a post-filter, while Solr uses tagged filter queries and excluded facets. Those different implementations of equivalent user-facing semantics are plausible contributors to the observed faceting/filtering gap.

## Next steps

1. Keep the 100K corpus fixed while contracting the now-proven admin/progress/evidence endpoints in OpenAPI.
2. Preserve these paired results as the 100K local performance baseline.
3. If deeper performance work is desired, measure CPU/heap/container allocation and consider query-plan/profile diagnostics before increasing corpus scale.
4. Do not treat a future 1M run as necessary to validate the current finding; 100K already produced a clear, repeatable separation.
