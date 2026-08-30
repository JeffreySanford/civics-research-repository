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

## Current PI-1 implementation

The merged PI-1 foundation contains a live authority-neutral discovery path:

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

PR #3, `Start PI-1 federated metadata catalog foundation`, merged to `main` on 2026-08-30 at commit `4569416371c15bfe96660d53c4756a48d3c4ed4b`. The active scale branch is `codex/data-gov-10k-scale`.

### Proven 1K Data.gov checkpoint

On 2026-08-30 the `data-gov-catalog-v4-v2` adapter completed a bounded live proof using 10 pages of 100 records:

- 1,000 accepted / 0 rejected / 0 skipped,
- 1,000 retained `DATA_GOV` metadata records,
- 181 curated DSpace-backed records,
- 1,181 objects projected through the same normalized stream into Solr and OpenSearch,
- bounded snapshot ID `DATA_GOV:78a2ec438b3dc3eab179fd94f5dd70c58fa770e3e18186dd624f078b0cbc3ce9`,
- snapshot SHA-256 `78a2ec438b3dc3eab179fd94f5dd70c58fa770e3e18186dd624f078b0cbc3ce9`,
- projection SHA-256 `5ad44932acd6166e9a32576ff06df9c4659cfba5f8800d952762503703af47dd`,
- the snapshot/projection relationship persisted after the guarded linkage operation,
- public search returned exactly 1,000 Data.gov records with `origin: FEDERATED` and `sourceSystem: DATA_GOV`.

The source-system facet reconciled the complete mixed projection as `DATA_GOV = 1000`, `CENSUS = 178`, and `USGS = 3`.

The first v1 run surfaced 75 valid Data.gov date-only `modified` values. The adapter was versioned to v2, the normalizer was corrected, and the repeated 1K proof accepted all records. This is exactly the staged-live-data feedback loop PI-1 is intended to exercise before 10K/100K scale.

### Active 10K Data.gov checkpoint

The 10K scale branch resumed the **same** durable Data.gov run rather than restarting it. Starting from the proven 10-page/1K checkpoint, one bounded invocation processed 90 more pages of 100 records.

Observed on 2026-08-30:

- run ID remained `e8dcd9ef-85d5-48d4-8b13-4f8cdc939131`,
- 100 total pages,
- 10,000 accepted,
- 0 rejected,
- 0 skipped,
- status `PAUSED`,
- no failure,
- `projectionRefreshRequired: true`.

That proves the **10K harvest/resume path**. The 10K scale checkpoint is not yet complete. Before moving to 100K, PI-1 still needs to capture and persist the 10K bounded snapshot, guarded projection relationship, normal public-search/detail verification, Solr/OpenSearch parity, storage growth and host/container/JVM resource context.

See [Data.gov Scale Evidence](../../planning/PI1_DATA_GOV_SCALE_EVIDENCE.md) for the live 1K evidence, current 10K checklist and the 100K acceptance boundary.

## Current scale-quality observations

Live Data.gov records exposed publisher program values such as `010:10` and `010:12`. These are valid source metadata but are not ideal display labels. PI-1 should preserve the raw source value while adding a defensible presentation/label strategy rather than creating a fixed UI allowlist or silently rewriting publisher semantics.

The compatibility-level projection source currently reports `REPOSITORY` for any authority-backed projection, including mixed repository + federated corpora. Per-record `origin` and `sourceSystem` are therefore the authoritative provenance fields. A future contract cleanup may rename or expand the projection-level label to make `AUTHORITY_BACKED`/mixed semantics clearer without changing record meaning.

## Documents

- [Federated Metadata Architecture](federated-metadata-architecture.md) — source-of-truth boundaries, provenance, identity, UI behavior and search projection architecture.
- [Source Ingestion Plan](source-ingestion-plan.md) — adapter order, source-specific strategies, checkpoints, retry/rate-limit rules and PI-1 delivery sequence.
- [Runtime and Ownership Boundaries](runtime-boundaries.md) — Java/Spring harvesting, datastore ownership and Angular state-management decisions.
- [Million-Record Corpus](million-record-corpus.md) — corpus sizes, snapshot manifests, benchmark modes, storage policy and scale acceptance criteria.
- [Program Increment Plan](../../planning/PI_PLAN.md) — PI sequencing, dependencies and exit criteria.
- [PI-1 F1 Merge Gate](../../planning/PI1_F1_MERGE_GATE.md) — closed historical merge boundary for the merged federation foundation.
- [Data.gov Scale Evidence](../../planning/PI1_DATA_GOV_SCALE_EVIDENCE.md) — living 1K/10K/100K evidence record.

## Core rule

Search engines remain **derived state**.

The rule evolves from "every searchable object must first be a DSpace item" to:

> Every searchable object must be reproducible from an authoritative metadata source with explicit provenance; curated repository objects remain authoritative in DSpace, while federated records remain authoritative at their publisher and in the reproducible federated metadata catalog.

Solr and OpenSearch are never authoritative storage for either class.
