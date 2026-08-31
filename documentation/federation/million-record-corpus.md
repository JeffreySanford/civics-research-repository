# Federated Metadata Scale Corpus

## Purpose

Create reproducible metadata corpora for realistic search, indexing, storage and topology experiments at 100K, 1M, 10M and potentially 100M records.

The original document treated one million records as the destination. It is now one point on a broader scale curve.

Full source binaries remain out of scope. The unit of scale is searchable metadata plus provenance and links to authoritative resources.

## Research invariant

A corpus tier is identified by more than its total record count.

Every evidence-grade tier must capture:

```text
corpus profile / recipe version
source composition and exact quotas
source snapshot/run/release identities
normalization adapter versions
accepted/rejected/skipped counts
composition digest
projection ID
host/storage context
```

`10M records` without source composition is not a reproducible corpus definition.

## Source capacity and role

| Source             | Approximate public scale observed in 2026 | Research role                                                          |
| ------------------ | ----------------------------------------: | ---------------------------------------------------------------------- |
| Data.gov           |                            ~556K datasets | federal dataset/agency breadth; proven 100K baseline                   |
| DOE OSTI.GOV       |                               >4M records | DOE publications, reports, datasets, software and patents              |
| NASA Earthdata CMR |         ~65K collections / >2.5B granules | Earth science collections plus explicit extreme-scale granule research |
| PubMed             |                            >40M citations | biomedical bibliographic/relevance corpus                              |
| OpenAlex           |              >320M core / >510M all works | broad scholarly corpus; snapshot-driven 10M/100M source                |

These numbers change. Capture the source count or publisher manifest date at run time rather than treating this table as permanent evidence.

## Ingestion modes

### Live API mode

Use for:

- representative all-source sampling,
- mapping development,
- retry/rate-limit research,
- source freshness,
- modest bounded slices.

### Bulk snapshot mode

Use for 10M/100M where publisher-supported bulk data exists.

Examples:

- OpenAlex public S3 snapshot,
- PubMed baseline/update files,
- publisher-supported OSTI full-corpus metadata,
- explicit NASA CMR high-volume granule harvesting/bulk strategy.

The bulk file is an ingestion artifact. The publisher remains authoritative.

### Snapshot benchmark mode

```text
source API/bulk artifact
  -> retained normalized metadata
  -> deterministic source snapshot(s)
  -> deterministic composition identity
  -> normalized DiscoveryDocument stream
  -> projection ID
  -> Solr + OpenSearch
```

This isolates search/index research from publisher timing.

## Scale checkpoints

### C0 — curated baseline

181 curated DSpace research objects.

Purpose:

- easy inspection,
- functional regression,
- curated Open Science relationships and accessibility demo.

### C1 — 100K — proven evidence baseline

Composition:

```text
100,000 Data.gov
+ 181 curated DSpace
= 100,181 projected objects
```

Evidence includes:

- retained durable Data.gov checkpoint,
- exact bounded 100K source snapshot,
- deterministic projection ID `125fc791065fd8c68806f62a52c2203c2ce74a083954ce469f3e0cd627015024`,
- Solr/OpenSearch count + identity parity,
- restart/reprojection reproduction,
- storage measurement,
- paired execution-order search report,
- OpenSearch aggregation-shape experiments.

C1 must remain reproducible after later source sampling and scale work.

### C1.5 — optional 500K Data.gov

Purpose:

- one-source scale curve from 100K toward the actual Data.gov ceiling,
- longer checkpoint/resume behavior,
- storage/index growth before source composition changes.

This is optional. It is useful only if the API request/time cost is justified and a personal Data.gov API key is configured.

### C2 — 1M — first composite tier

Preferred initial recipe:

```text
500,000 Data.gov
500,000 DOE OSTI
+ curated DSpace
```

Why balanced quotas:

- exact composition remains reproducible even when source totals change,
- neither source dominates by accident,
- dataset-heavy and publication/research-output-heavy metadata coexist,
- source-system/content-type facets become meaningful research variables.

The current single-source bounded snapshot evidence is insufficient for C2. A composite corpus manifest/evidence chain is required first.

### C3 — 10M — heterogeneous research tier

A candidate recipe might use Data.gov + OSTI + PubMed + OpenAlex + an explicit NASA granule slice.

The exact recipe is intentionally not frozen. It should be chosen to answer a research question and then versioned.

Purpose:

- source diversity under meaningful scale,
- high-cardinality subjects/topics/programs,
- source-aware relevance and facets,
- index merge/segment behavior,
- concurrency and saturation,
- standalone versus clustered crossover.

### C4 — 100M — bulk-ingest / cluster tier

100M should be built from publisher-supported bulk transports where possible, not hundreds of thousands or millions of REST calls.

Purpose:

- large bulk normalization throughput,
- PostgreSQL/catalog write strategy,
- search-index build duration,
- shard/segment sizing,
- storage amplification,
- search latency and throughput at very large scale,
- recovery/reprojection time,
- cluster topology research.

A workstation may still coordinate or sample this tier, but the actual search experiment may become cluster-only depending on measured storage/memory/indexing cost.

## Source sampling before scale

Before creating the first composite profile:

```bash
pnpm federation:sample:all
```

Expected behavior:

- existing Data.gov records are observed but not advanced,
- empty OSTI/NASA/PubMed/OpenAlex sources each receive one bounded page,
- source failures remain visible,
- no search profile is activated automatically.

The goal is to validate semantic diversity before investing in bulk-scale ingestion.

## Source snapshot identity

Current single-source bounded evidence records:

```text
snapshotId
sourceSystem
runId
adapterVersion
retainedRecordCount
accepted/rejected/skipped
cursor/run status
source update window
sha256
capturedAt
```

This remains useful for each source independently.

## Composite corpus identity

Multi-source tiers require a higher-level composition record.

Conceptual example:

```json
{
  "profile": "FEDERATED_1M",
  "compositionVersion": "federated-composition/v1",
  "sources": [
    {
      "sourceSystem": "DATA_GOV",
      "requestedRecords": 500000,
      "evidenceId": "DATA_GOV:<sha>"
    },
    {
      "sourceSystem": "DOE_OSTI",
      "requestedRecords": 500000,
      "evidenceId": "DOE_OSTI:<sha>"
    }
  ],
  "federatedRecordCount": 1000000,
  "compositionSha256": "...",
  "projectionId": "..."
}
```

The composition SHA must be independent of:

- database page size,
- ingest batch size,
- process restart boundaries,
- filesystem traversal order,
- Solr/OpenSearch bulk size.

For bulk publishers, the source evidence should include publisher release/manifest identity in addition to the normalized digest.

## Storage policy

Persist:

- normalized metadata,
- source identity/provenance,
- source/resource URLs,
- source-specific compact metadata needed for research/detail,
- harvest/checkpoint state,
- bulk source manifest/release evidence,
- bounded/composite corpus manifests,
- projection evidence,
- bounded quarantine/error samples.

Do not persist by default:

- millions of PDFs,
- dataset ZIPs,
- NASA granule bytes,
- publisher full-text mirrors,
- complete raw response history when normalized/provenance data is sufficient.

## Disk planning

The measured 10K/100K work proved that federated PostgreSQL/search indexes grow while DSpace remains approximately fixed because external binaries are not mirrored.

Continue estimating components separately:

```text
steady state ~= PostgreSQL federated catalog
             + fixed DSpace authority footprint
             + Solr index
             + OpenSearch index
             + optional normalized/bulk staging artifacts

peak ~= steady state
      + staged replacement indexes
      + active ingest partitions/files
      + research margin
```

At 10M/100M, bulk source files may dominate temporary disk even when normalized search metadata remains modest. Preflight must model that separately.

## Query corpus

As source diversity grows, the query set must evolve beyond the original Data.gov scenarios.

Required research classes:

- cross-source full text,
- exact source identifier,
- DOI,
- PMID,
- author query,
- publisher/agency/institution filter,
- source-system filter,
- content-type filter,
- year/date filter,
- subject/topic facet,
- high-cardinality program/topic facet,
- source-specific selective filter,
- intentionally broad query,
- intentionally empty query.

A query should have a stable ID, semantic intent and expected evidence boundaries.

## Performance evidence

Retain the current discipline:

- warmups excluded,
- paired engine execution order,
- at least 100 measured requests for distribution claims,
- API elapsed separate from native Solr `QTime` / OpenSearch `took`,
- p50/p95/p99/min/max/mean,
- projection/corpus identity,
- source composition,
- errors/timeouts,
- host/resource context.

At concurrency above one, add throughput, CPU, memory, GC and saturation evidence.

Ingest duration, normalization throughput, projection duration and search latency are separate measurements.

## Semantic evidence

Faster is not enough.

Record:

- total-hit parity where equivalent semantics are expected,
- facet bucket/count parity,
- top-N overlap,
- rank movement,
- missing/extra results,
- source distribution,
- content-type distribution,
- query-specific gold records where available.

Source heterogeneity may legitimately change relevance behavior; document that as a research result rather than treating every rank difference as an engine bug.

## Standalone first, cluster second

Evidence-grade tiers should first pass through the simplest topology that can reasonably hold them.

```text
Docker Compose standalone
  -> baseline where feasible

kind / cluster
  -> same corpus manifest
  -> SolrCloud / multi-node OpenSearch
  -> topology/resilience/concurrency comparison
```

At 100M, feasibility may dictate cluster-first execution, but the corpus/evidence semantics must remain unchanged.

## Acceptance criteria by tier

A scale tier is complete when:

- its exact source composition is versioned,
- each source has reproducible source evidence,
- the composite corpus digest is reproducible,
- Solr/OpenSearch receive the exact same normalized sequence,
- count/identity parity is proven,
- storage and ingest/projection duration are recorded,
- search performance and semantic evidence are collected,
- source binaries remain external unless explicitly part of a separate content experiment,
- the corpus can be replayed in another topology without changing record meaning.

See [Federation Scale Research Plan](../../planning/FEDERATION_SCALE_RESEARCH_PLAN.md) for the active 100K→1M→10M→100M sequence.
