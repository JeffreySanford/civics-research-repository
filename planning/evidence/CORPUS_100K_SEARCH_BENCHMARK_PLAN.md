# Federated 100K Solr/OpenSearch Benchmark Plan

This evidence plan defines the first controlled search comparison on the proven `FEDERATED_100K` corpus. It is intentionally separate from corpus activation evidence: activation proves identity/parity; this benchmark measures local diagnostic behavior on that already-proven projection.

## Required corpus checkpoint

The benchmark must run only when the read-only corpus evidence checker reports the 100K profile as valid.

Expected checkpoint for the first run:

```text
profile             FEDERATED_100K
retained federation 100000
curated objects     181
projected total     100181
projectionId        125fc791065fd8c68806f62a52c2203c2ce74a083954ce469f3e0cd627015024
target parity       true
violations          []
```

The matrix script refuses to record samples when the live evidence checker is invalid or when the projection ID changes during collection.

## Measurement boundary

Primary comparison: application-observed elapsed time around each engine HTTP request.

Secondary diagnostics:

- Solr `responseHeader.QTime`,
- OpenSearch `took`.

`QTime` and `took` are retained as useful engine-native diagnostics, but they are not treated as directly equivalent vendor metrics.

The current comparison service executes Solr first and OpenSearch second. That fixed order is an acknowledged confound. Results are therefore local diagnostic evidence, not proof that either engine is inherently faster in production.

## Workloads

### Full-text relevance

```json
{
  "scenario": "FULL_TEXT_RELEVANCE",
  "query": "North Dakota workforce",
  "page": 0,
  "pageSize": 10
}
```

Purpose: compare weighted text matching and ranking over the same normalized document set.

### Faceted search

```json
{
  "scenario": "FACETED_SEARCH",
  "query": "",
  "page": 0,
  "pageSize": 10
}
```

Purpose: compare Solr field facets with OpenSearch terms aggregations across the full 100K projection. This is expected to be more revealing than a narrow lookup because both engines must compute discovery aggregations over a materially larger corpus.

### Filtering

```json
{
  "scenario": "FILTERING",
  "query": "",
  "contentType": "DATASET",
  "page": 0,
  "pageSize": 10
}
```

Purpose: compare filter execution plus self-excluding discovery facets on the same corpus.

## Sampling

Default matrix:

```text
warmups per scenario   5
measured samples       100
scenarios              3
measured API requests  300
engine queries         600
```

Warmups are excluded from distributions.

For each engine and scenario, capture:

- minimum,
- mean,
- p50,
- p95,
- p99,
- maximum.

Capture both application elapsed and engine-reported timing distributions.

## Reproducibility context

The artifact records host logical CPU count, total host memory, operating-system platform and architecture. These are host facts only; they must not be presented as Docker CPU/memory allocation unless container limits are separately measured.

Do not restart, rebuild, harvest, activate another profile or reindex while samples are being collected.

## Execution

First validate the deterministic harness:

```bash
pnpm format:check
pnpm performance:test
pnpm build:all
```

Then run the live matrix while `FEDERATED_100K` remains active:

```bash
node tools/scripts/search-comparison-100k-matrix.mjs
```

Generated artifact:

```text
browser-evidence-artifacts/search-comparison-100k-matrix.json
```

## Interpretation

Use application elapsed distributions as the primary same-boundary diagnostic. Look for:

1. p50 difference — typical warm-query behavior,
2. p95/p99 difference — tail stability,
3. scenario sensitivity — whether text, aggregations or filtering changes the relative behavior,
4. engine-native timing versus API elapsed — possible network/serialization/application overhead,
5. errors/timeouts — a performance result is incomplete if one engine cannot reliably serve the workload.

A meaningful difference at 100K is useful evidence for architecture discussion, but should not be generalized beyond this local Docker Compose topology without repeated runs, order randomization/alternation, explicit container resource capture and larger-scale evidence.
