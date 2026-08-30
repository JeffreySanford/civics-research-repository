# Million-Record Federated Metadata Corpus

## Purpose

Create reproducible metadata corpora at 10K, 100K, 1M and optional larger tiers for realistic search, indexing and topology experiments.

This document belongs to the **federated data project**, not the Kubernetes project. The corpus must be useful against the existing standalone Docker Compose search services before PI-2 moves the same data into clustered SolrCloud/OpenSearch.

Full source binaries are out of scope. The unit of scale is searchable metadata plus provenance and links to authoritative resources.

Live Data.gov checkpoint evidence is recorded in [PI-1 Data.gov Scale Evidence](../../planning/PI1_DATA_GOV_SCALE_EVIDENCE.md).

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
  -> CombinedDiscoveryCatalog
  -> normalized DiscoveryDocument stream
  -> Solr + OpenSearch
```

This is the normal PI-1 architecture and drives the Angular discovery UI.

### Curated repository mode

```text
publisher
  -> DSpace-curated object
  -> normalized DiscoveryDocument
  -> Solr + OpenSearch
```

This remains the curated repository path. PI-1 does not remove it.

### Snapshot benchmark mode

```text
federated catalog / deterministic bounded snapshot
  -> normalized projection stream
  -> projection ID
  -> Solr + OpenSearch
```

This mode isolates indexing/search experiments from publisher API timing. It must be clearly labelled as benchmark/snapshot evidence.

All modes share the same normalized search-document semantics.

## Checkpoints

### C0 — curated baseline

Current small repository slice: 181 curated research objects.

Purpose:

- preserve known functional behavior,
- preserve demo speed,
- keep an easy-to-inspect regression corpus.

### C1 — 10,000 — active

Purpose:

- validate harvest/resume,
- validate dynamic taxonomy,
- validate bounded projection,
- catch mapping/facet explosions,
- measure first meaningful storage/resource growth,
- provide the first PI-2 Kubernetes corpus once evidence closes.

Current Data.gov status on 2026-08-30:

- same durable run resumed from 1K to 10K,
- 100 total pages x 100,
- 10,000 accepted,
- 0 rejected,
- 0 skipped,
- no failure,
- bounded snapshot/projection/search/storage/resource closure still pending.

The correct claim today is **C1 harvest proven, C1 evidence incomplete**.

### C2 — 100,000

Purpose:

- meaningful indexing duration,
- heap/disk growth,
- high-cardinality facets,
- deep-search/pagination behavior,
- standalone versus clustered crossover experiments.

Do not begin C2 until C1 snapshot/projection/search/storage/resource evidence is closed.

### C3 — 1,000,000

Purpose:

- first true large-corpus search benchmark,
- concurrency 1/8/32,
- shard-layout experiments in PI-2,
- semantic/relevance comparison at realistic scale.

DOE OSTI remains the preferred source for the first controlled C3 corpus unless source-access evidence changes that decision.

### C4 — 5,000,000+

Optional only when C3 is repeatable and workstation resources remain sensible.

## Evidence identities

PI-1 now uses two related but distinct deterministic identities.

### Bounded snapshot identity

A `BOUNDED_SNAPSHOT` identifies a stable retained source checkpoint even when the source run is intentionally `PAUSED` rather than exhausted.

Its evidence includes, where available:

```text
snapshotId
sourceSystem
runId
adapterVersion
retainedRecordCount
acceptedCount
rejectedCount
skippedCount
cursor
source update window
sha256
capturedAt
```

The snapshot ID is content-addressed by source plus SHA-256, not merely by run ID.

### Projection identity

The projection ID identifies the deterministic ordered normalized `DiscoveryDocument` sequence sent to the search engines.

It must be independent of:

- database page size,
- Solr/OpenSearch bulk size,
- process restart boundaries,
- host filesystem order.

### Guarded snapshot -> projection linkage

A scale checkpoint becomes stronger when the system can prove which projection was built from which stable source snapshot.

The guarded linkage operation:

1. captures the source checkpoint,
2. rebuilds the mixed discovery projection,
3. computes the projection identity,
4. rescans the source run,
5. persists the relationship only if counters/status/cursor/update time remained stable.

The Data.gov 1K checkpoint has already proven this path. Its snapshot SHA is `78a2ec438b3dc3eab179fd94f5dd70c58fa770e3e18186dd624f078b0cbc3ce9` and its mixed 1,181-object projection ID is `5ad44932acd6166e9a32576ff06df9c4659cfba5f8800d952762503703af47dd`.

## Corpus manifest

Completed or reusable multi-source corpus tiers also need a compact manifest. The large document set itself does not belong in Git.

A future combined/million-class manifest should record concepts such as:

```json
{
  "corpusId": "federated-osti-1m-v1",
  "sources": ["DOE_OSTI"],
  "retrievedAt": "2026-09-01T00:00:00Z",
  "requestedRecords": 1000000,
  "acceptedRecords": 1000000,
  "rejectedRecords": 0,
  "skippedRecords": 0,
  "normalizationVersion": "adapter-or-build-version",
  "canonicalizationVersion": 1,
  "projectionId": "sha256",
  "mode": "FEDERATED_CATALOG"
}
```

For a combined corpus, record each source and accepted count separately. This higher-level corpus manifest complements, rather than replaces, source-specific bounded snapshots.

## Storage policy

Persist:

- normalized metadata,
- source identity,
- provenance,
- source/resource URLs,
- harvest/checkpoint state,
- compact source-specific fields needed for detail/reharvest,
- bounded snapshot/corpus manifests,
- snapshot/projection evidence relationships,
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
- optional normalized snapshot/export,
- temporary bulk/indexing files,
- logs and benchmark artifacts.

Before C3, measure actual bytes/document at C1 and C2 and estimate C3 with safety margin rather than guessing.

Planning formula:

```text
required local disk ~= federated store
                    + Solr index
                    + OpenSearch index
                    + optional snapshot/export
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
- source snapshot/corpus and projection ID,
- errors/timeouts,
- no winner claim from fixed engine order.

At concurrency above one, add throughput and saturation/resource evidence.

Harvest and projection duration should also be recorded separately from search latency.

## Semantic evidence

At scale, faster is not sufficient.

Record:

- result-set overlap,
- top-N overlap,
- rank movement,
- missing/extra results,
- facet-bucket/count differences,
- query-specific expected records where a gold set exists.

Semantic differences should be evaluated on the same deterministic corpus snapshot/projection used for performance.

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

This gives a genuine baseline and keeps topology changes from being confused with data changes.

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

Exact command names can be chosen as the scale workflow hardens. The current implementation already supports bounded page-size/max-page harvesting and persistent corpus/storage measurements without requiring a separate runtime.

## Acceptance criteria

The million-record corpus capability is complete when:

- a 1M normalized metadata corpus can be produced resumably,
- its manifest captures source counts, timestamps, normalization version and projection identity,
- the corpus is reproducible without committing it to Git,
- standalone Solr and OpenSearch index the exact same normalized corpus,
- counts and deterministic identity match,
- indexing duration/error counts and resource context are recorded,
- stable large-corpus query classes execute successfully,
- p50/p95/p99 performance evidence can be collected,
- semantic/result-difference evidence can be collected,
- the same corpus can be handed unchanged to the PI-2 Kubernetes project,
- no requirement exists to download the underlying publisher binaries.
