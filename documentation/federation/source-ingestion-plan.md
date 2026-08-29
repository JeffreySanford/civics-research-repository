# Federated Source Ingestion Plan

## Goal

PI-1 should deliver adapters for every identified source while keeping ingestion repeatable, bounded and provenance-aware.

The goal is **not** to ingest every record from every source simultaneously on day one. The goal is to make each source reproducibly harvestable and then establish controlled corpus tiers that can be used by both standalone and clustered search topologies.

## PI-1 source scope

| Source | Adapter in PI-1 | First production-shaped tier | Larger tier | Primary value |
| --- | --- | ---: | ---: | --- |
| Data.gov | yes | 10K -> 100K | full catalog where practical | federal dataset breadth and heterogeneous agencies |
| DOE OSTI.GOV | yes | 10K -> 100K | **1M+** | preferred federal research-object scale corpus |
| NASA Earthdata CMR | yes | collections + 10K granules | 100K -> 1M controlled slices | geospatial/temporal and very high scale |
| PubMed | yes | 10K -> 100K | 1M+ | bibliographic lexical/relevance scale |
| OpenAlex | yes | 10K -> 100K | optional 1M+ | broad open-science/citation relationship stress corpus |

All five adapters belong in PI-1. Large local snapshots remain staged so disk, time and source limits do not force us to keep every corpus resident at maximum size simultaneously.

## Shared harvester framework first

Do not implement five independent loops.

Create one framework that owns:

```text
start/resume
  -> fetch source page/batch
  -> validate source response
  -> normalize records
  -> persist records/checkpoint
  -> record metrics/errors
  -> continue until requested limit/end
```

Shared capabilities:

- cursor/page/checkpoint persistence,
- bounded retry with backoff and jitter,
- `Retry-After` / source rate-limit awareness,
- request timeout and cancellation,
- resumable runs after process failure,
- idempotent source identity,
- accepted/rejected/skipped counters,
- quarantined malformed records,
- progress and throughput metrics,
- bounded concurrency per source,
- explicit requested record limit,
- source retrieval timestamp/window,
- adapter version / git SHA,
- final corpus manifest.

## Run model

Every harvest should have an explicit run identity:

```text
HarvestRun
  id
  sourceSystem
  mode
  requestedLimit
  startedAt
  completedAt
  checkpoint
  fetchedCount
  acceptedCount
  rejectedCount
  skippedCount
  requestCount
  retryCount
  status
  adapterVersion
```

Recommended modes:

- `SAMPLE` — tiny deterministic development fixtures,
- `BOUNDED` — 1K/10K/100K/1M controlled harvest,
- `INCREMENTAL` — publisher updates since a checkpoint/date,
- `FULL_AVAILABLE` — only where source rules and workstation budget make it sensible.

## Source 1 — Data.gov

Use Data.gov as the first **federation integration** source because it closely matches the external-metadata/no-local-binary model.

Primary mapping targets:

- dataset identifier,
- title,
- description,
- publisher/agency,
- themes/tags,
- modified/issued dates,
- distribution/resource links,
- landing-page URL,
- license/access metadata where present.

Milestones:

1. deterministic fixture,
2. 1K local harvest,
3. 10K harvest,
4. 100K harvest,
5. larger/full catalog after memory/indexing path is proven.

Important tests:

- sparse metadata,
- multiple distributions,
- duplicated/cross-listed resources,
- publisher normalization,
- source updates without creating duplicates.

## Source 2 — DOE OSTI.GOV

OSTI is the preferred **first million-record source** because its research outputs align closely with the existing domain model.

Map where available:

```text
osti_id              -> sourceIdentifier
title                -> title
abstract/description -> summary
authors              -> authors
research_org         -> publisher/research organization
sponsoring_org       -> sponsor metadata
subjects             -> subjects
publication_date     -> publication/vintage metadata
resource_type        -> contentType mapping
doi                  -> identifier
record/product URLs  -> source/resource URLs
```

Milestones:

```text
10K
100K
1M
optional larger slice after 1M is repeatable
```

OSTI should provide the canonical PI-1 million-record acceptance run unless a source-access constraint appears during implementation.

## Source 3 — NASA Earthdata CMR

Treat CMR collections and granules distinctly.

Do not call one million granules one million research projects.

Recommended normalized distinction:

- CMR collection -> dataset/research collection,
- CMR granule -> scientific data-granule metadata or a benchmark-specific high-volume content type.

Capture spatial/temporal fields for later geo/time search work without forcing that search feature into the first ingestion slice.

Milestones:

```text
collections baseline
10K granules
100K granules
1M controlled granules
```

## Source 4 — PubMed

Use API access for development-sized fixtures and bounded samples. For very large reproducible ingestion, prefer the publisher's bulk/baseline/update mechanism when practical rather than performing millions of individual API calls.

Useful metadata:

- PMID,
- title,
- abstract,
- authors,
- journal,
- publication dates,
- publication type,
- controlled subjects/terms where available,
- DOI/other identifiers,
- PubMed record URL.

This corpus is particularly useful for relevance testing because author/title/abstract vocabulary differs substantially from government dataset catalogs.

## Source 5 — OpenAlex

Implement the adapter in PI-1, but keep it last in execution priority because the federal-source path is the repository's primary story.

Use it to test:

- scholarly works,
- authors/institutions,
- topics,
- funders,
- DOI relationships,
- citation/reference relationships.

Do not attempt to retain the entire OpenAlex corpus locally. Controlled snapshots are sufficient.

## Adapter contract

Conceptual interface:

```text
FederatedSourceAdapter
  sourceSystem()
  fetchBatch(checkpoint, limit)
  normalize(sourceRecord)
  nextCheckpoint(response)
  sourceUpdatedAt(sourceRecord)
```

The shared harvester—not each adapter—owns persistence, retries, progress and resume semantics.

## Update strategy

Initial corpus builds and incremental updates are different workloads.

After the first full/bounded snapshot, sources should update by stable source identifier and publisher-supported change markers where available.

Rules:

- same source identity updates the existing federated record,
- disappeared source records are not immediately deleted without an explicit source deletion/tombstone rule,
- changed normalized content changes snapshot/projection identity,
- unchanged records should not create write/index churn,
- harvest runs record the source's effective freshness window.

## Error policy

One malformed source record must not abort a million-record run.

Quarantine errors with:

```text
sourceSystem
sourceIdentifier if known
harvestRunId
errorCode
message
raw payload reference/sample
occurredAt
```

Keep raw failed payloads bounded; do not create an unbounded error-data mirror.

## Development and CI corpus policy

Ordinary CI should never depend on downloading 1M records.

Use:

- tiny committed source fixtures for adapter unit tests,
- generated deterministic 100-1,000 record integration fixtures when useful,
- optional scheduled/manual 10K integration evidence,
- workstation/manual workflows for 100K/1M,
- manifests/artifacts rather than the full corpus in GitHub Actions where storage/runtime is excessive.

## PI-1 delivery sequence

### F0 — foundation

- provenance/origin contract,
- dynamic source/publisher/program model,
- federated metadata persistence,
- harvest-run/checkpoint model,
- `/research/:id` detail abstraction,
- streaming/batched projection contract.

### F1 — Data.gov

Prove federation at 1K/10K and make new records naturally visible through discovery/facets/detail.

### F2 — OSTI

Prove 10K/100K, then 1M metadata snapshot and standalone search projection.

### F3 — NASA CMR

Add collections and controlled granule slices.

### F4 — PubMed

Add bibliographic scale/relevance shape.

### F5 — OpenAlex

Add optional broad scholarly/citation shape.

### F6 — PI-1 consolidation

- all adapters covered by fixtures/tests,
- deterministic source manifests,
- combined multi-source corpus,
- standalone Solr/OpenSearch parity,
- UI/source facets/detail flows,
- 1M benchmark/relevance evidence,
- snapshot handed to PI-2 Kubernetes work.

## PI-1 exit criteria

PI-1 is complete when:

- all five adapters are implemented and testable,
- every source has a reproducible bounded harvest,
- at least Data.gov + OSTI + one additional large source are visible together in the normal UI,
- federated records are clearly distinguished from DSpace-backed records,
- `/research/:id` resolves both origins,
- program/publisher/source facets do not rely on a fixed source-specific enum,
- projection works in bounded batches,
- a deterministic 1M corpus is indexed into standalone Solr and OpenSearch with matching identity/count,
- large binaries remain external,
- the Compose demo remains functional with the original curated repository slice,
- PI-2 receives a versioned corpus manifest/snapshot definition rather than a hand-built local index.
