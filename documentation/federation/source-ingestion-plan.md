# Federated Source Ingestion Plan

## Goal

PI-1 should deliver adapters for every identified source while keeping ingestion repeatable, bounded and provenance-aware.

The goal is **not** to ingest every record from every source simultaneously on day one. The goal is to make each source reproducibly harvestable and then establish controlled corpus tiers that can be used by both standalone and clustered search topologies.

All production-shaped harvesting runs inside the Spring Boot Java application. Node/NestJS is not an alternate ingestion runtime. Repository Node scripts may still support fixtures, build/test automation and local orchestration, but durable source checkpoints, retries, normalization, quarantine/error state and harvest-run ownership remain in Java.

## PI-1 source scope

| Source             | Adapter in PI-1 | First production-shaped tier |                  Larger tier | Primary value                                          |
| ------------------ | --------------- | ---------------------------: | ---------------------------: | ------------------------------------------------------ |
| Data.gov           | yes             |                  10K -> 100K | full catalog where practical | federal dataset breadth and heterogeneous agencies     |
| DOE OSTI.GOV       | yes             |                  10K -> 100K |                      **1M+** | preferred federal research-object scale corpus         |
| NASA Earthdata CMR | yes             |   collections + 10K granules | 100K -> 1M controlled slices | geospatial/temporal and very high scale                |
| PubMed             | yes             |                  10K -> 100K |                          1M+ | bibliographic lexical/relevance scale                  |
| OpenAlex           | yes             |                  10K -> 100K |                 optional 1M+ | broad open-science/citation relationship stress corpus |

All five adapters belong in PI-1. Large local snapshots remain staged so disk, time and source limits do not force us to keep every corpus resident at maximum size simultaneously.

## Shared Java harvester framework

Do not implement five independent loops and do not add a second harvester runtime.

The shared Spring/Java framework owns:

```text
start/resume
  -> fetch source page/batch
  -> validate source response
  -> normalize records
  -> persist records/checkpoint
  -> record metrics/errors
  -> continue until requested bound/end
```

The merged PI-1 foundation already includes:

- source-specific `FederatedSourceHarvester` registration,
- stable cursor/page checkpoint persistence,
- durable harvest-run identity and status,
- process-safe resume from persisted run/checkpoint state,
- explicit restart-from-beginning semantics separate from ordinary resume,
- namespaced source identity validation,
- idempotent catalog persistence,
- bounded prepared-statement database batches,
- accepted/rejected/skipped counters,
- malformed-record quarantine without aborting the whole run,
- typed retryable versus permanent source failures,
- bounded three-attempt retry,
- exponential backoff with jitter,
- bounded publisher `Retry-After` handling,
- bounded `PAUSED` checkpoints when an operator page limit is reached,
- adapter-version capture on durable runs,
- deterministic corpus manifests for completed bounded runs,
- deterministic `BOUNDED_SNAPSHOT` manifests for intentionally paused scale checkpoints,
- source update-window and run-stat capture in snapshot evidence,
- guarded snapshot -> projection linkage that refuses to persist the relationship if the harvest checkpoint drifts during projection,
- durable snapshot/projection evidence history.

Remaining shared capabilities are narrower than the original F0 list:

- configurable per-source request concurrency and explicit rate-limit policy,
- explicit publisher/request timeout tuning where source defaults are insufficient,
- progress/throughput observability appropriate for 100K/1M runs,
- first-class requested-record target semantics if page bounds become too indirect for operators,
- git/build identity in heavy-run evidence where adapter version alone is insufficient,
- resource-context capture that makes large-run timing comparable rather than anecdotal.

Spring Batch remains optional. Adopt it only if the existing Java orchestration demonstrates a concrete need for its job repository, partitioning or restart machinery.

## Normalization and discovery handoff

A source adapter normalizes publisher data into `FederatedResearchRecord`. That record is then converted by `FederatedDiscoveryDocumentMapper` into the same engine-neutral `DiscoveryDocument` shape used for repository records.

Important taxonomy rule:

```text
legacy ResearchProgram
  compatibility classification for the curated Census slice

programName
  canonical data-driven publisher/source program value
```

A DOE OSTI record may therefore retain `ResearchProgram.OTHER` for legacy compatibility while preserving `programName = "Office of Science"` for discovery. New source program names must not require Java enum expansion and must not collapse into one giant `OTHER` facet.

`CombinedDiscoveryCatalog` provides bounded authority composition:

```text
curated DSpace documents
  -> bounded repository portion
  -> federated records ordered by namespaced stable ID
  -> FederatedDiscoveryDocumentMapper
  -> bounded DiscoveryDocument pages
```

The current projection lifecycle consumes those pages in bounded batches, computes one deterministic streaming projection identity and sends the same normalized sequence to configured Solr/OpenSearch projection targets. The next scale work is therefore validation of resource/storage behavior and parity at 10K/100K, not another rewrite from whole-corpus materialization.

## Current durable run model

The implemented `HarvestRun` evidence includes the operator-critical state needed for restart/resume:

```text
HarvestRun
  id
  sourceSystem
  adapterVersion
  status
  pageSize
  pageCount
  acceptedCount
  rejectedCount
  skippedCount
  cursor
  startedAt
  updatedAt
  completedAt
  failureMessage
```

The API-level bounded invocation supplies `pageSize` and `maxPages`. Reaching that bound produces `PAUSED`, not a false source-complete status. A later ordinary harvest call resumes the same compatible run and cursor. Restart is deliberately separate because it cancels the resumable run and clears source traversal state without deleting already-retained federated metadata.

For larger evidence runs, additional derived evidence should record requested target tier, duration/throughput, source retrieval window, storage/resource context and deterministic snapshot/projection identity.

## Source 1 — Data.gov

Use Data.gov as the first **federation integration** source because it closely matches the external-metadata/no-local-binary model.

Primary mapping targets:

- dataset identifier,
- title,
- description,
- publisher/agency,
- themes/tags,
- modified/issued dates,
- distributions/resource links,
- landing-page URL,
- license/access metadata where present.

Milestones and current status:

1. **complete** — deterministic fixture and adapter/unit coverage,
2. **complete** — 1K live harvest + bounded snapshot + guarded projection + public-search proof,
3. **harvest complete; evidence completion active** — 10K resumed harvest,
4. **next** — 100K harvest/projection/storage/resource proof,
5. larger/full catalog only after the 100K path is stable.

The live 10K run resumed the exact durable 1K run instead of restarting it. It advanced from 10 to 100 total pages and from 1,000 to 10,000 accepted records with 0 rejected and 0 skipped while preserving run ID `e8dcd9ef-85d5-48d4-8b13-4f8cdc939131`.

The 10K claim remains intentionally precise: **harvest/resume is proven**; snapshot/projection linkage, public-search/detail verification, index parity and storage/resource evidence still need to be captured before the checkpoint is complete. See [PI-1 Data.gov Scale Evidence](../../planning/PI1_DATA_GOV_SCALE_EVIDENCE.md).

Important tests and quality observations:

- sparse metadata,
- multiple distributions,
- duplicated/cross-listed resources,
- publisher normalization,
- source updates without creating duplicates,
- ISO date-only publisher `modified` values,
- preservation of raw publisher program values,
- presentation hardening for opaque program codes such as `010:10`/`010:12` without introducing fixed UI allowlists.

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

Current conceptual contract:

```text
FederatedSourceHarvester
  sourceSystem()
  adapterVersion()
  fetch(checkpointCursor, pageSize)
```

The adapter returns normalized bounded pages. The shared harvester—not each adapter—owns persistence, retries, progress and resume semantics.

## Update strategy

Initial corpus builds and incremental updates are different workloads.

After the first full/bounded snapshot, sources should update by stable source identifier and publisher-supported change markers where available.

Rules:

- same source identity updates the existing federated record,
- disappeared source records are not immediately deleted without an explicit source deletion/tombstone rule,
- changed normalized content changes snapshot/projection identity,
- unchanged records should not create write/index churn,
- harvest/snapshot evidence records the source's effective freshness window where available.

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

The live Data.gov path has already demonstrated why this matters: an initial adapter version quarantined 75 valid records because their source `modified` value was date-only. That evidence led to a versioned normalization fix and a clean repeated 1K proof instead of silently discarding the failure history.

## Development and CI corpus policy

Ordinary CI should never depend on downloading 1M records.

Use:

- tiny committed source fixtures for adapter unit tests,
- generated deterministic 100-1,000 record integration fixtures when useful,
- optional scheduled/manual 10K integration evidence,
- workstation/manual workflows for 100K/1M,
- manifests/artifacts rather than the full corpus in GitHub Actions where storage/runtime is excessive.

## PI-1 delivery sequence

### F0 — foundation — merged

Delivered through PR #3:

- provenance/origin contract,
- dynamic source/publisher/program model,
- federated metadata persistence,
- durable harvest-run/checkpoint/quarantine model,
- combined bounded repository/federated discovery catalog,
- `/research/:id` detail abstraction,
- streaming/batched deterministic projection,
- bounded snapshot and guarded snapshot/projection evidence.

### F1 — Data.gov — active

- 1K federation proof: complete,
- 10K harvest/resume proof: complete,
- 10K snapshot/projection/search/storage/resource evidence: active,
- 100K standalone proof: next.

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
