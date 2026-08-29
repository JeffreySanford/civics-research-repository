# Million-Record Federated Metadata Corpus

## Purpose

Create reproducible metadata corpora at 10K, 100K, 1M and optional larger tiers for realistic search, indexing and topology experiments.

This document belongs to the **federated data project**, not the Kubernetes project. The corpus must be useful against the existing standalone Docker Compose search services before PI-2 moves the same data into clustered SolrCloud/OpenSearch.

Full source binaries are out of scope. The unit of scale is searchable metadata plus provenance and links to authoritative resources.

## Source portfolio

PI-1 plans adapters for all identified sources:

| Source             | Scale role                                  | Primary metadata shape                                                  |
| ------------------ | ------------------------------------------- | ----------------------------------------------------------------------- |
| Data.gov           | federal breadth to hundreds of thousands    | datasets, agencies, tags, distributions                                 |
| DOE OSTI.GOV       | preferred first 1M+ federal corpus          | reports, publications, datasets, software, patents and research outputs |
| NASA Earthdata CMR | controlled 1M+ scientific/geospatial slices | collections and granules                                                |
| PubMed             | 1M+ bibliographic/relevance corpus          | citations, abstracts, authors and publication metadata                  |
| OpenAlex           | optional broad 1M+ scholarly corpus         | works, authors, institutions, topics and citations                      |

Source-specific harvesting is defined in [Source Ingestion Plan](source-ingestion-plan.md).

## Corpus modes

### Federated catalog mode

```text
publisher/API
  -> adapter
  -> federated metadata store
  -> normalized DiscoveryDocument
  -> Solr + OpenSearch
```

This is the normal PI-1 architecture and should drive the Angular discovery UI.

### Curated repository mode

```text
publisher
  -> DSpace-curated object
  -> normalized DiscoveryDocument
  -> Solr + OpenSearch
```

This remains the existing repository path. PI-1 does not remove it.

### Snapshot benchmark mode

```text
federated catalog / deterministic export
  -> normalized snapshot
  -> projection ID
  -> Solr + OpenSearch
```

This mode isolates indexing/search experiments from metadata-store or DSpace throughput. It must be clearly labelled as benchmark/snapshot evidence.

All three modes share the same normalized search-document semantics.

## Checkpoints

### C0 — curated baseline

Current small repository slice.

Purpose:

- preserve known functional behavior,
- preserve demo speed,
- keep an easy-to-inspect regression corpus.

### C1 — 10,000

Purpose:

- validate harvest/resume,
- validate dynamic taxonomy,
- validate bounded projection,
- catch mapping/facet explosions,
- provide the first PI-2 Kubernetes corpus.

### C2 — 100,000

Purpose:

- meaningful indexing duration,
- heap/disk growth,
- high-cardinality facets,
- deep-search/pagination behavior,
- standalone versus clustered crossover experiments.

### C3 — 1,000,000

Purpose:

- first true large-corpus search benchmark,
- concurrency 1/8/32,
- shard-layout experiments in PI-2,
- semantic/relevance comparison at realistic scale.

### C4 — 5,000,000+

Optional only when C3 is repeatable and workstation resources remain sensible.

## Snapshot manifest

Every reusable corpus tier needs a compact manifest. The large document set itself does not belong in Git.

Example:

```json
{
  "corpusId": "federated-osti-1m-v1",
  "sources": ["DOE_OSTI"],
  "retrievedAt": "2026-09-01T00:00:00Z",
  "requestedRecords": 1000000,
  "acceptedRecords": 1000000,
  "rejectedRecords": 0,
  "skippedRecords": 0,
  "normalizationVersion": "git-sha",
  "canonicalizationVersion": 1,
  "projectionId": "sha256",
  "mode": "FEDERATED_CATALOG"
}
```

For a combined corpus, record each source and accepted count separately.

## Deterministic identity

Projection identity must be independent of:

- database page size,
- Solr/OpenSearch bulk size,
- process restart boundaries,
- host filesystem order.

Use a canonical source identity ordering and normalized record representation.

A streaming digest should allow 1M+ identity generation without retaining the full corpus in memory.

## Storage policy

Persist:

- normalized metadata,
- source identity,
- provenance,
- source/resource URLs,
- harvest/checkpoint state,
- compact source-specific fields needed for detail/reharvest,
- corpus manifests,
- bounded diagnostic/error samples.

Do not persist by default:

- millions of PDFs,
- dataset ZIPs,
- NASA science granule bytes,
- publisher full-text mirrors,
- complete raw API payload history where normalized/provenance data is enough.

## Disk planning

Metadata is much smaller than source binaries but one million rich records are still nontrivial once represented in:

- PostgreSQL federated catalog,
- Solr index,
- OpenSearch index,
- optional normalized snapshot,
- temporary bulk/indexing files,
- logs and benchmark artifacts.

Before C3, measure actual bytes/document at C1 and C2 and estimate C3 with safety margin rather than guessing.

Example planning formula:

```text
required local disk ~= federated store
                    + Solr index
                    + OpenSearch index
                    + snapshot/export
                    + 30-50% operational headroom
```

PI-2 replicas will multiply search-index storage further, so the cluster project must consume the measured PI-1 bytes/document values.

## Query corpus

Large-scale testing needs stable query classes, not one favorite query.

Required query set:

- exact source identifier,
- DOI/PMID/persistent identifier,
- rare phrase,
- common multi-term query,
- author query,
- publisher/agency filter,
- source-system filter,
- content-type filter,
- year/date filter,
- high-cardinality subject/program facet,
- low-cardinality facet,
- intentionally empty query,
- intentionally broad query.

Every query definition should have a stable ID and expected semantic intent.

## Performance evidence

Preserve the existing benchmark discipline:

- warm-ups excluded,
- at least 100 measured requests for distribution claims,
- API elapsed separate from Solr `QTime` / OpenSearch `took`,
- p50/p95/p99/min/max/mean,
- source corpus and projection ID,
- errors/timeouts,
- no winner claim from fixed engine order.

At concurrency above one, add throughput and saturation/resource evidence.

## Semantic evidence

At scale, faster is not sufficient.

Record:

- result-set overlap,
- top-N overlap,
- rank movement,
- missing/extra results,
- facet-bucket/count differences,
- query-specific expected records where a gold set exists.

Semantic differences should be evaluated on the same deterministic corpus snapshot used for performance.

## Standalone first, cluster second

Each corpus checkpoint should first pass through the stable standalone path:

```text
Docker Compose
  Solr standalone
  OpenSearch single node
```

Only then should PI-2 run the same manifest/snapshot against:

```text
kind
  SolrCloud
  multi-node OpenSearch
```

This gives us a genuine baseline and keeps topology changes from being confused with data changes.

## Ordinary development behavior

Developers should not need a million-record corpus to run the application.

Maintain named profiles/commands conceptually similar to:

```text
demo-small       curated/fixture-scale Compose
data-10k         bounded federated corpus
data-100k        larger local test
data-1m          explicit heavy run
k8s-10k          clustered test
k8s-100k         clustered scale test
k8s-1m           explicit heavy cluster run
```

Exact command names can be chosen during implementation.

## Acceptance criteria

The million-record corpus capability is complete when:

- a 1M normalized metadata corpus can be produced resumably,
- its manifest captures source counts, timestamps, normalization version and projection identity,
- the corpus is reproducible without committing it to Git,
- standalone Solr and OpenSearch index the exact same normalized corpus,
- counts and deterministic identity match,
- indexing duration/error counts are recorded,
- stable large-corpus query classes execute successfully,
- p50/p95/p99 performance evidence can be collected,
- semantic/result-difference evidence can be collected,
- the same corpus can be handed unchanged to the PI-2 Kubernetes project,
- no requirement exists to download the underlying publisher binaries.
