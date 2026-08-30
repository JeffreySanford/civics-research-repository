# Federated Metadata Expansion

This directory owns the **data-expansion project** for Civics Research Repository. It is intentionally separate from the Kubernetes/cloud project.

The goal is to expand discovery from the current curated DSpace-backed catalog into a large, provenance-aware metadata catalog built from public Open Science sources while continuing to leave publisher binaries and full datasets at their authoritative source.

## Project boundary

This project owns:

- external metadata-source adapters and harvesters,
- resumable paging/checkpointing and rate-limit behavior,
- federated metadata persistence,
- source identity and cross-source deduplication rules,
- dynamic publisher/program/source taxonomy,
- normalized `DiscoveryDocument` generation,
- bounded composition of repository + federated discovery records,
- streaming/batched Solr and OpenSearch projection,
- deterministic corpus manifests and projection identities,
- `/research/:id` detail resolution for both DSpace and federated records,
- pagination changes needed for million-record discovery,
- corpus checkpoints at 10K, 100K, 1M and optional larger tiers,
- query/relevance test sets for large corpora.

This project does **not** own:

- SolrCloud,
- multi-node OpenSearch,
- kind/Kubernetes lifecycle,
- pod failure/recovery,
- EKS provisioning.

Those belong under [`documentation/cloud/`](../cloud/).

## Program Increment relationship

The intended order is:

```text
PI-1 Federated Metadata Expansion
  -> all source adapters
  -> deterministic large-corpus snapshots
  -> standalone Solr/OpenSearch validation
  -> 10K / 100K / 1M evidence

PI-2 Local Kubernetes Search Laboratory
  -> consume the exact PI-1 snapshots
  -> SolrCloud / multi-node OpenSearch
  -> compare with the standalone baseline
  -> resilience / concurrency / topology experiments
```

Docker Compose remains supported throughout both increments. It is the fast development path, the simplest demonstration topology, and the reference baseline for judging whether clustered infrastructure earns its complexity.

## Current PI-1 foundation

The branch now contains a live authority-neutral discovery path:

```text
Data.gov / future federated sources
        |
        v
Spring Boot federated harvest framework
  durable runs / checkpoints / quarantine
        |
        v
FederatedMetadataCatalog
        |
        |                      DSpace
        |                 curated repository
        |                       |
        +-----------+-----------+
                    |
         CombinedDiscoveryCatalog
           bounded pages
                    |
                    v
            DiscoveryDocument
  origin / sourceSystem / programName
  publisher / subjects / authors
                    |
          deterministic projection
             /              \
          Solr            OpenSearch
             \              /
               Spring API
                   |
                Angular
```

`ResearchProgram` remains a compatibility classification for the curated Census slice. Federated publisher program names are retained in `DiscoveryDocument.programName` rather than expanding the enum or collapsing every unknown program into `OTHER`.

### Proven 1K Data.gov checkpoint

On 2026-08-30 the `data-gov-catalog-v4-v2` adapter completed a bounded live proof using 10 pages of 100 records:

- 1,000 accepted / 0 rejected / 0 skipped,
- 1,000 retained `DATA_GOV` metadata records,
- 181 curated DSpace-backed records,
- 1,181 objects projected through the same normalized stream into Solr and OpenSearch,
- projection SHA-256 `5ad44932acd6166e9a32576ff06df9c4659cfba5f8800d952762503703af47dd`.

The first v1 run surfaced 75 valid Data.gov date-only `modified` values. The adapter was versioned to v2, the normalizer was corrected, and the repeated 1K proof accepted all records. This is exactly the staged-live-data feedback loop PI-1 is intended to exercise before 10K/100K scale.

The current branch therefore treats 1K ingestion/projection as proven. Its remaining merge gate is product-facing: make source/publisher filtering fully selectable, add canonical `/research/:id` detail for repository and federated records, preserve `/datasets/:id` compatibility, and cover the mixed-authority path with browser/accessibility evidence. The 10K scale proof starts from fresh `main` after that slice merges rather than extending this foundation PR indefinitely.

See [PI-1 F1 Merge Gate](../../planning/PI1_F1_MERGE_GATE.md) for the exact branch boundary and merge checklist.

## Documents

- [Federated Metadata Architecture](federated-metadata-architecture.md) — source-of-truth boundaries, provenance, identity, UI behavior and search projection architecture.
- [Source Ingestion Plan](source-ingestion-plan.md) — adapter order, source-specific strategies, checkpoints, retry/rate-limit rules and PI-1 delivery sequence.
- [Runtime and Ownership Boundaries](runtime-boundaries.md) — Java/Spring harvesting, datastore ownership and Angular state-management decisions.
- [Million-Record Corpus](million-record-corpus.md) — corpus sizes, snapshot manifests, benchmark modes, storage policy and scale acceptance criteria.
- [Program Increment Plan](../../planning/PI_PLAN.md) — PI sequencing, dependencies and exit criteria.
- [PI-1 F1 Merge Gate](../../planning/PI1_F1_MERGE_GATE.md) — live 1K evidence and the merge boundary before 10K scale work.

## Core rule

Search engines remain **derived state**.

The rule evolves from "every searchable object must first be a DSpace item" to:

> Every searchable object must be reproducible from an authoritative metadata source with explicit provenance; curated repository objects remain authoritative in DSpace, while federated records remain authoritative at their publisher and in the reproducible federated metadata catalog.

Solr and OpenSearch are never authoritative storage for either class.
