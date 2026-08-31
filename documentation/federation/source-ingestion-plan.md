# Federated Source Ingestion Plan

## Goal

Deliver reproducible adapters for all modeled Open Science authorities while keeping ingestion bounded, provenance-aware and appropriate to each publisher's transport.

The system has two distinct ingestion classes:

1. **live API adapters** for representative samples, mapping development, freshness and modest bounded slices;
2. **bulk snapshot/baseline adapters** for 10M/100M research tiers where API crawling is wasteful, expensive or publisher-discouraged.

All durable ingestion ownership remains in the Spring Boot Java application. Node scripts may orchestrate local research commands and reports, but they do not become a second metadata persistence runtime.

## Source matrix

| Source             | Current live adapter | Initial sample                                | Large-scale transport                                    | Scale value                                               |
| ------------------ | -------------------- | --------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------- |
| Data.gov           | `DataGovHarvester`   | already represented by proven retained corpus | Catalog API v4 until source completion                   | federal dataset breadth and heterogeneous agency metadata |
| DOE OSTI.GOV       | `OstiGovHarvester`   | one bounded records page                      | OSTI API / OAI-PMH/full-corpus metadata                  | DOE publications, reports, datasets, software, patents    |
| NASA Earthdata CMR | `NasaCmrHarvester`   | public **collection** metadata                | explicit granule or collection stream using Search-After | geospatial/temporal and extreme-scale metadata            |
| PubMed             | `PubMedHarvester`    | bounded E-utilities sample                    | NCBI PubMed baseline + update files                      | biomedical lexical/relevance and author/journal metadata  |
| OpenAlex           | `OpenAlexHarvester`  | bounded Works cursor sample                   | pinned public S3 snapshot                                | broad scholarly works/topics/authors at 10M/100M scale    |

The first cross-source command is:

```bash
pnpm federation:sample:all
```

It does not restart or advance a source that already has retained records, so the established Data.gov checkpoint is preserved while empty sources receive one bounded page.

## Credential policy

Credentials live only in the git-ignored `.env` file.

| Source   | Local credential policy                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------ |
| Data.gov | personal api.data.gov key required for meaningful sustained harvesting; `DEMO_KEY` only for tiny exploratory calls |
| DOE OSTI | none for public records API                                                                                        |
| NASA CMR | none for public metadata; stable Client-Id sent; Earthdata bearer token only for protected holdings                |
| PubMed   | API key optional for initial sample, recommended for sustained E-utilities use; developer email recommended        |
| OpenAlex | API key optional for casual sample, recommended for API research; public S3 snapshot requires no credentials       |

See `.env.sample` for variable names.

## Shared Java harvester framework

Every live adapter implements:

```text
FederatedSourceHarvester
  sourceSystem()
  adapterVersion()
  fetch(checkpointCursor, pageSize)
```

The shared runtime—not each adapter—owns:

```text
start/resume
  -> fetch page
  -> validate response
  -> normalize records
  -> quarantine record-level failures
  -> upsert namespaced metadata
  -> persist checkpoint/run evidence
  -> retry transient publisher failures
  -> pause at operator bound or complete at source end
```

Existing shared behavior includes:

- durable harvest runs,
- source-scoped checkpoints,
- idempotent metadata upsert,
- namespaced source identity validation,
- accepted/rejected/skipped counters,
- quarantine persistence,
- retryable versus permanent publisher failures,
- bounded retry/backoff/jitter,
- publisher `Retry-After` support,
- explicit restart separate from resume,
- adapter-version evidence,
- source-specific bounded manifests,
- snapshot/projection linkage for stable single-source checkpoints.

## Normalized research-object rules

All adapters normalize into `FederatedResearchRecord`; the shared `FederatedDiscoveryDocumentMapper` then creates engine-neutral `DiscoveryDocument` values.

The record ID is always:

```text
<SOURCE_SYSTEM>:<publisher-stable-id>
```

This is what permits multiple authorities to coexist safely in `FederatedMetadataCatalog`.

Research-object type should preserve publisher semantics where defensible:

- Data.gov -> `DATASET`,
- OSTI journal/report-like output -> `PUBLICATION`,
- OSTI/OpenAlex software -> `CODE`,
- NASA CMR collection -> `DATASET`,
- PubMed citation -> `PUBLICATION`,
- OpenAlex dataset -> `DATASET`, otherwise scholarly work -> `PUBLICATION` unless a stronger mapping exists.

Do not flatten all sources to `DATASET` merely because the original repository began as a dataset portal.

## Source-specific plans

### Data.gov

Current state:

- durable run/checkpoint proven,
- 100K retained baseline proven,
- 100,181-document projection parity proven,
- restart/reprojection identity proven,
- storage and paired search research established.

Data.gov is no longer the planned source for a million-record corpus because the current live catalog is below one million records. A 500K checkpoint may still be useful as a single-source scale curve point if API/time cost is justified.

### DOE OSTI.GOV

`OstiGovHarvester` uses the public REST records endpoint with page-number checkpoints and a fixed ascending `osti_id` sort.

Initial mapping includes:

```text
osti_id             -> sourceIdentifier
title               -> title
description         -> summary
publisher/research_org -> publisher
sponsor_org         -> program/sponsor metadata
product_type        -> research object type
authors             -> authors
subjects            -> subjects
doi                 -> source metadata
links               -> provenance/resource links
```

OSTI is an excellent component of the first multi-source 1M tier, but should not be treated as the only million-record recipe simply because it is large enough.

### NASA Earthdata CMR

The initial live adapter intentionally harvests **collections** with CMR Search-After.

That is a semantic choice: a collection is a dataset/research collection, while a granule is a much finer scientific data object. The repository must not silently switch the same adapter from collections to billions of granules.

For 10M/100M work, add an explicit granule ingestion stream/profile with its own adapter/transport identity and bounded collection/provider selection.

Public CMR search does not require authentication; a `Client-Id` is sent for operational identification. Protected holdings may use an Earthdata bearer token, but protected records are out of the initial public sample.

### PubMed

The current E-utilities adapter is deliberately a **sampler**.

It uses:

- ESearch for PMIDs,
- ESummary for normalized bibliographic metadata,
- an offset cursor,
- a hard refusal at the ordinary 10,000-ID ESearch retrieval boundary.

That refusal is intentional. The adapter must not report PubMed source completion at 10K when PubMed contains tens of millions of citations.

Large-scale PubMed research should use the publisher's baseline/update file distribution and normalize those records through a bulk-ingest path.

### OpenAlex

The live Works adapter uses cursor paging and optional API-key authentication for bounded samples.

OpenAlex explicitly advises against cursor-crawling the full database. At large scale use a pinned public S3 snapshot release and its manifest. The public snapshot is the correct transport for 10M/100M slices because it is resumable, release-identifiable and does not consume REST request budget.

## API versus bulk evidence

A live API run and a bulk snapshot run can normalize to the same record model, but their source evidence differs.

### API evidence

Record:

- source system,
- adapter version,
- run ID,
- cursor/page state,
- accepted/rejected/skipped counts,
- source update window where available,
- bounded snapshot digest.

### Bulk evidence

Record:

- source system,
- publisher release/snapshot date,
- publisher manifest identity/hash,
- file/partition identity,
- normalized record count,
- accepted/rejected/skipped counts,
- adapter version,
- normalized digest.

The downloaded bulk file is an ingestion artifact, not a new authority.

## Multi-source composition

The retained catalog already supports cross-source discovery, but current bounded snapshot evidence is source-run scoped.

Before `FEDERATED_1M` is executable, add a composite corpus evidence object that binds several source snapshots/bulk manifests to exact quotas and one deterministic composition digest.

A profile must therefore mean more than a count:

```text
profile
  -> composition recipe/version
  -> source quotas
  -> source snapshot/release identities
  -> composition SHA-256
  -> projection ID
```

This becomes essential at 10M and 100M.

## Scale strategy

See [Federation Scale Research Plan](../../planning/FEDERATION_SCALE_RESEARCH_PLAN.md).

Planned progression:

```text
100K proven Data.gov baseline
optional 500K Data.gov
1M balanced multi-source
10M heterogeneous multi-source
100M bulk-ingest / cluster research
```

The exact source recipe at 10M/100M is part of the experiment and must be written into the manifest.

## Error policy

One malformed record must not abort a large run.

Quarantine evidence should retain:

```text
sourceSystem
sourceIdentifier if known
harvestRunId
message/error class
bounded raw payload snippet
occurredAt
```

Keep failed payload evidence bounded. Do not build an accidental second raw-data mirror.

## Development and CI policy

Ordinary CI never downloads a live large corpus.

Normal automated quality gates cover:

- local HTTP fixtures for each source adapter,
- source-specific cursor behavior,
- malformed-record quarantine,
- retry/rate-limit semantics,
- identity/source ownership validation,
- all-source sampling orchestration,
- deterministic composition logic once added,
- report generation,
- formatting/lint/build.

Manual/workstation research owns live source samples and evidence-grade 100K+ runs.

## Delivery sequence

1. **complete/proven** — Data.gov 100K evidence-grade baseline.
2. **current** — all five live source adapters + representative source sampling.
3. inspect mixed-source normalized semantics and UI/detail needs.
4. add composite source snapshot/corpus evidence.
5. optionally prove 500K Data.gov if it adds research value.
6. build the first balanced 1M multi-source corpus.
7. add bulk adapters for OpenAlex and PubMed.
8. introduce explicit NASA granule stream for high-scale research.
9. run 10M matched-methodology search/storage/indexing research.
10. treat 100M as bulk-ingest/cluster research, not a larger API loop.
