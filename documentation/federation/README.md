# Federated Metadata Expansion

This directory owns the **federated data-expansion research project** for Civics Research Repository. It is intentionally separate from Kubernetes/cloud topology work.

The goal is to expand discovery from the curated DSpace-backed catalog into a provenance-aware Open Science metadata catalog built from multiple public authorities while continuing to leave publisher binaries and full datasets at their authoritative source.

## Core rule

Search engines remain **derived state**.

> Every searchable object must be reproducible from an authoritative metadata source with explicit provenance. Curated repository objects remain authoritative in DSpace; federated records remain authoritative at their publisher and in the reproducible local metadata/evidence chain. Solr and OpenSearch are never authoritative storage.

## Current architecture

```text
Data.gov      DOE OSTI      NASA CMR      PubMed      OpenAlex
   |             |              |            |            |
   +-------------+--------------+------------+------------+
                                 |
                     FederatedSourceHarvester
                 source-specific fetch + normalize
                                 |
                     shared Spring harvest runtime
            durable run / checkpoint / retry / quarantine
                                 |
                    FederatedMetadataCatalog
                      namespaced stable identity
                                 |
                                 +------------------ DSpace
                                 |               curated authority
                                 |                    |
                                 +---------+----------+
                                           |
                                CombinedDiscoveryCatalog
                                  bounded stable-ID pages
                                           |
                                      DiscoveryDocument
                                           |
                              deterministic projection
                                  /                 \
                               Solr             OpenSearch
                                  \                 /
                                      Spring API
                                           |
                                        Angular
```

The retained federated catalog already supports multiple source systems because every record ID is namespaced by `FederatedSourceSystem`. The important remaining multi-source gap is **composite evidence**: current bounded snapshot/projection evidence links one source run to one snapshot, while 1M+ research profiles need one deterministic composition identity spanning several source snapshots.

## Source portfolio

All modeled authorities now have a live Java adapter/sampler path on the active scale branch:

| Source | Initial semantic role | Large-scale role | Public auth |
| --- | --- | --- | --- |
| Data.gov | federal datasets/agencies/distributions | bounded to the real catalog ceiling | API key required for meaningful sustained harvesting |
| DOE OSTI.GOV | DOE publications/reports/datasets/software | millions of DOE research records | none |
| NASA Earthdata CMR | Earth science collection metadata | explicit high-volume granule slices | none for public metadata; bearer token only for protected holdings |
| PubMed | biomedical citations/authors/journals | bulk baseline/update ingest rather than REST crawling | key optional for bounded sample, recommended for sustained API use |
| OpenAlex | broad scholarly works/topics/authors | public S3 snapshot for 10M/100M | key optional for bounded API sample; no key for public snapshot |

The sources are intentionally heterogeneous. A dataset catalog, a publication corpus and a granule stream should not be treated as interchangeable merely because they contain the same number of records.

## Representative all-source sample

Before deep scale work, retain one bounded page from each authority:

```bash
pnpm federation:sample:all
```

The command is conservative:

- it checks source status first,
- a source with retained records is reported as `EXISTING` and is **not advanced**,
- an empty source receives one bounded page,
- one failure does not stop attempts against the remaining sources,
- JSON + Markdown evidence is written below ignored `browser-evidence-artifacts/`,
- it does **not** activate a mixed-source search projection.

That last boundary preserves the evidence-grade 100K Data.gov search baseline while we inspect whether every new source normalizes cleanly.

## Scale research ladder

The old plan treated 1M as the endpoint. The research roadmap now explicitly anticipates larger tiers:

```text
curated baseline
      ↓
10K / 100K Data.gov proofs
      ↓
100K evidence-grade baseline          PROVEN
      ↓
optional 500K Data.gov ceiling probe
      ↓
1M multi-source composition
      ↓
10M heterogeneous composition
      ↓
100M bulk-ingest / cluster research
```

See [Federation Scale Research Plan](../../planning/FEDERATION_SCALE_RESEARCH_PLAN.md) for proposed composition recipes and evidence requirements.

### Proven 100K baseline

The established baseline is:

- 100,000 retained Data.gov records,
- 181 curated DSpace-backed objects,
- 100,181 objects in the deterministic Solr/OpenSearch projection,
- projection ID `125fc791065fd8c68806f62a52c2203c2ce74a083954ce469f3e0cd627015024`,
- target parity proven,
- storage evidence captured,
- restart/reprojection reproduction proven,
- paired-order Solr/OpenSearch research report established.

This baseline remains fixed evidence even after additional metadata sources are sampled.

### Why 1M changed

Data.gov's live catalog is below one million records. The repository therefore must not advertise a Data.gov-only 1M growth path.

`FEDERATED_1M` is now planned as the first **composite multi-source** scale tier. A preferred initial recipe is 500K Data.gov + 500K DOE OSTI, with source quotas represented explicitly in the future composition manifest. The current single-source scale service intentionally refuses to launch a Data.gov-only million-record operation until composite evidence exists.

### 10M and 100M

Large tiers require a transport distinction:

**Live API adapters** are appropriate for representative samples, mapping development, source freshness and modest bounded slices.

**Bulk snapshot/baseline adapters** are appropriate when REST request counts become unreasonable. Examples include the OpenAlex public S3 snapshot and PubMed baseline/update files. NASA CMR's granule holdings provide a natural extreme-scale research source, but collection and granule semantics must remain explicit rather than being silently mixed.

A scale result is therefore identified by **count + composition + transport + snapshot/release identity**, not count alone.

## Project boundary

This project owns:

- external metadata-source adapters and harvesters,
- API and bulk-ingest transports,
- resumable paging/checkpointing and rate-limit behavior,
- federated metadata persistence,
- source identity and provenance,
- multi-source composition evidence,
- dynamic publisher/program/source taxonomy,
- normalized `DiscoveryDocument` generation,
- bounded composition of repository + federated discovery records,
- streaming/batched Solr and OpenSearch projection,
- deterministic corpus manifests and projection identities,
- `/research/:id` detail resolution for DSpace and federated records,
- corpus scale checkpoints and research reports,
- search/relevance test sets for large corpora.

This project does **not** own:

- SolrCloud,
- multi-node OpenSearch,
- kind/Kubernetes lifecycle,
- pod failure/recovery,
- EKS provisioning.

Those belong under [`documentation/cloud/`](../cloud/), which should consume the exact same corpus manifests rather than rebuilding different data.

## Quality policy

Ordinary CI verifies the protocol rather than downloading millions of external records.

Normal tests cover:

- source-specific normalization using local HTTP fixtures,
- rate-limit/transient versus permanent failure semantics,
- quarantine of malformed records,
- stable cursors and source identity,
- all-source sampling orchestration,
- deterministic projection/research-report logic,
- formatting/linting/build gates.

Live 100K/1M/10M/100M corpus work remains an explicit research operation with captured evidence.

## Documents

- [Federated Metadata Architecture](federated-metadata-architecture.md) — source-of-truth boundaries, provenance, identity and discovery architecture.
- [Source Ingestion Plan](source-ingestion-plan.md) — source-specific API/bulk strategies and quality rules.
- [Runtime and Ownership Boundaries](runtime-boundaries.md) — Java/Spring harvesting and datastore ownership.
- [Federated Scale Corpus](million-record-corpus.md) — deterministic scale tiers, composition evidence and benchmark policy.
- [Federation Scale Research Plan](../../planning/FEDERATION_SCALE_RESEARCH_PLAN.md) — current 100K→1M→10M→100M roadmap.
- [Search Research Protocol](../../planning/SEARCH_RESEARCH_PROTOCOL.md) — paired Solr/OpenSearch methodology.
- [Data.gov Scale Evidence](../../planning/PI1_DATA_GOV_SCALE_EVIDENCE.md) — historical/proven Data.gov scale evidence.
