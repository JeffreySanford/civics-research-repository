# Federated Metadata Expansion

This directory owns the **data-expansion project** for Civics Research Repository. It is intentionally separate from the Kubernetes/cloud project.

The goal is to expand discovery from the current curated DSpace-backed catalog into a large, provenance-aware metadata catalog built from public Open Science sources while continuing to leave publisher binaries and full datasets at their authoritative source.

## Project boundary

This project owns:

- external metadata-source adapters and harvesters implemented in the Spring Boot Java runtime,
- resumable paging/checkpointing and rate-limit behavior,
- federated metadata persistence,
- source identity and cross-source deduplication rules,
- dynamic publisher/program/source taxonomy,
- normalized `DiscoveryDocument` generation,
- streaming/batched Solr and OpenSearch projection,
- deterministic corpus manifests and projection identities,
- `/research/:id` detail resolution for both DSpace and federated records,
- pagination changes needed for million-record discovery,
- corpus checkpoints at 10K, 100K, 1M and optional larger tiers,
- query/relevance test sets for large corpora.

This project does **not** own:

- a NestJS or Node.js production harvester runtime,
- SolrCloud,
- multi-node OpenSearch,
- kind/Kubernetes lifecycle,
- pod failure/recovery,
- EKS provisioning.

Node-based scripts may remain for repository tooling, fixture generation, build/test orchestration and local developer workflows. Durable federated harvesting and harvest state stay in Java/Spring Boot.

Those cloud/topology concerns belong under [`documentation/cloud/`](../cloud/).

## Runtime and ownership decisions

PI-1 has explicit runtime boundaries:

- federated harvesting is Java/Spring only,
- DSpace-owned PostgreSQL/Solr remain isolated from application-owned PostgreSQL/public Solr,
- local resource pressure is handled through profiles, resource measurement and lifecycle rather than collapsing ownership boundaries,
- NgRx remains the shared-workflow state model while transient component state can stay local with RxJS/forms/component fields,
- the project does not adopt Angular Signals as a simplification migration.

See [PI-1 Runtime and Ownership Boundaries](runtime-boundaries.md).

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

## Documents

- [Federated Metadata Architecture](federated-metadata-architecture.md) — source-of-truth boundaries, provenance, identity, UI behavior and search projection architecture.
- [Source Ingestion Plan](source-ingestion-plan.md) — adapter order, source-specific strategies, checkpoints, retry/rate-limit rules and PI-1 delivery sequence.
- [PI-1 Runtime and Ownership Boundaries](runtime-boundaries.md) — Java-only harvesting, datastore/search isolation, local resource policy and Angular state-management boundaries.
- [Million-Record Corpus](million-record-corpus.md) — corpus sizes, snapshot manifests, benchmark modes, storage policy and scale acceptance criteria.
- [Program Increment Plan](../../planning/PI_PLAN.md) — PI sequencing, dependencies and exit criteria.

## Core rule

Search engines remain **derived state**.

The rule evolves from "every searchable object must first be a DSpace item" to:

> Every searchable object must be reproducible from an authoritative metadata source with explicit provenance; curated repository objects remain authoritative in DSpace, while federated records remain authoritative at their publisher and in the reproducible federated metadata catalog.

Solr and OpenSearch are never authoritative storage for either class.
