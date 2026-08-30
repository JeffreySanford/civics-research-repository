# Roadmap

This roadmap contains future work only. Delivered phases and major architectural decisions are summarized in [documentation/history/platform-evolution.md](../documentation/history/platform-evolution.md). Current verified facts live in the generated [documentation/platform-status.md](../documentation/platform-status.md). The executable checklist is [TODO.md](TODO.md), and named program increments plus their execution sequence are defined in [PI_PLAN.md](PI_PLAN.md).

The intended execution order is **PI-1 -> PI-2 -> PI-3 -> PI-4 -> PI-5 -> PI-6**. PI-1 is active now; its existing F0 work is retained and extended rather than restarted.

A repository-wide rule applies to new work: **testing and evidence precede feature expansion**. A working local screen is a development milestone, not completion. New behavior should have unit/use-case coverage, contract coverage, browser workflow coverage, accessibility evidence and—where behavior depends on infrastructure—a real-stack smoke path before broader scenarios are added.

## PI-1 — Federated metadata expansion and large-corpus discovery

Detailed design:

- [Federated Metadata Expansion](../documentation/federation/README.md)
- [Federated Metadata Architecture](../documentation/federation/federated-metadata-architecture.md)
- [Source Ingestion Plan](../documentation/federation/source-ingestion-plan.md)
- [Million-Record Federated Metadata Corpus](../documentation/federation/million-record-corpus.md)

PI-1 comes before Kubernetes. Its job is to create a scalable, provenance-aware catalog and deterministic corpus artifacts that work against the existing standalone topology.

### PI-1.1 Evolve authority without weakening it

The existing invariant becomes:

- DSpace is authoritative for curated repository objects,
- external publishers are authoritative for federated source records,
- the application federated metadata store is the reproducible local catalog of those records,
- Solr and OpenSearch are derived state for both origins.

A search document that cannot be reproduced from either DSpace or a provenance-bearing federated record is an integrity failure.

### PI-1.2 Finish the scale-sensitive foundation first

Before broad harvesting:

- add `origin` and controlled `sourceSystem`,
- make publisher/program/subject values data-driven rather than collapsing unknown programs into `OTHER`,
- retain namespaced source identity and add explicit cross-source reconciliation rules,
- complete federated metadata persistence plus harvest-run/checkpoint/error state,
- use bounded JDBC prepared-statement batches for federated metadata writes,
- implement `/research/:id` detail resolution for both origins,
- replace whole-corpus in-memory projection with bounded streaming/batched projection,
- make deterministic projection hashing independent of database page and search bulk sizes,
- plan cursor/search-after pagination before deep offsets become an operational problem.

The PI-1 branch already includes the normalized federated record model, catalog persistence, resumable checkpoints, source-harvester contract, corpus profiles, storage-history measurements, real local-storage probes and Admin corpus-scale visibility.

### PI-1.3 Bring in all planned source adapters during PI-1

Implement, in staged order:

1. Data.gov — first federation proof and federal dataset breadth,
2. DOE OSTI.GOV — preferred first 1M+ federal research corpus,
3. NASA Earthdata CMR — collections plus controlled granule slices,
4. PubMed — bibliographic/abstract relevance scale,
5. OpenAlex — broad scholarly/citation corpus after the federal path is established.

“All sources in PI-1” means all adapters and bounded harvest paths are implemented and testable. It does not require every source to remain locally stored at its maximum possible size simultaneously.

### PI-1.4 Keep source binaries external

Do not download millions of PDFs, ZIPs or NASA granule bytes merely to increase record count. Store searchable metadata, identifiers, provenance and authoritative links. Full-file mirroring remains a separate preservation decision with its own budget.

### PI-1.5 Use staged deterministic corpus checkpoints

```text
curated baseline -> 10K -> 100K -> 1M -> optional 5M+
```

Every reusable corpus needs source counts, retrieval timestamp/window, adapter/normalization version, accepted/rejected/skipped counts, deterministic projection identity and a manifest that can be handed unchanged to PI-2.

### PI-1.6 Validate standalone first

Every major corpus checkpoint first runs against Docker Compose with standalone Solr and single-node OpenSearch. This preserves the fast demo path and establishes the control topology for later cluster experiments.

### PI-1.7 Validate semantics as well as speed

At large scale add stable query classes and record result-set overlap, top-N overlap, rank movement, facet-bucket differences, exact-identifier behavior and broad/rare/common query behavior.

Completion means PI-1 can reproducibly harvest every planned source, render federated records through the normal UI, index a deterministic 1M-class corpus in standalone Solr/OpenSearch with parity, and hand versioned corpus definitions to PI-2.

## PI-1 supporting work — Harden provenance and repository identity

- Record source freshness per research object.
- Record projection/index timestamps and expose them consistently in Search Lab, Admin Sync and Evidence.
- Distinguish repository, federated, fixture, stored sample, stale response and unavailable source with a typed provenance model.
- Review route handling so UUID-backed and source-identifier-backed research links remain stable.
- Add regression tests for fallback provenance, especially LODES-derived map data.

## PI-1 supporting work — Finish research-object language

- Add `/research/:id` as the canonical detail route while preserving `/datasets/:id` compatibility.
- Resolve research detail from DSpace or the federated metadata catalog.
- Replace remaining dataset-shaped labels where the object is not necessarily a dataset.
- Update API/documentation examples to use “research object” where appropriate.
- Keep type-specific language where it improves clarity.

## PI-2 — Local Kubernetes search laboratory

PI-2 consumes PI-1 corpora. It does not invent a separate data model. Compose remains the default development/demo path and reference baseline; kind adds reproducible clustered topology for SolrCloud/OpenSearch, scale comparison and deliberate failure/recovery evidence.

Meaningful corpus tiers are 10K, 100K and 1M where host resources permit, with concurrency checkpoints 1/8/32. All comparisons must retain identical corpus/projection identity and query definitions.

## PI-3 — Implement the documented AWS target

The AWS architecture is documented but not provisioned. PI-1 and PI-2 should inform EKS/ECS topology, search shard/replica strategy, storage, JVM/pod resource defaults, persistence, operational probes and whether both search engines are required. Terraform/CDK selection remains a separate decision.

## PI-4 — Complete manual accessibility evidence

Run keyboard-only, NVDA, JAWS-or-N/A, map-equivalence, cognitive/workflow and Search Lab manual evidence. Completion means dated, commit-bound evidence; automated evidence never substitutes for the required manual checks.

## PI-5 — Govern browser evidence as a merge policy

Dedicated Browser Evidence is implemented. Remaining work is governance: determine required merge checks, decide `main` branch protection, and preserve the rule that a failed evidence refresh never replaces the prior known-good baseline.

## PI-6 — Harden the Solr/OpenSearch comparison demo

Add semantic difference explanations for result sets, rank order and facets, retain richer environment metadata, and gate phrase/highlighting/geo/autocomplete/synonym/nested/vector/hybrid expansion behind a green core evidence matrix.

## Cross-cutting — Publisher verification

Keep curated publisher listing/vintage changes reviewable and preserve the distinction between publisher-discovered facts and repository-curated relationships.

## Cross-cutting — Platform and test hardening

Maintain dependency alignment, integration coverage, typed API errors and measured preservation/storage behavior without changing architectural patterns merely for novelty.

## Non-goals

The roadmap does not include replacing DSpace with a search engine, forcing federated records into DSpace, making search indexes authoritative, claiming local kind predicts cloud capacity, deleting Compose after Kubernetes, downloading millions of binaries merely to inflate record count, running million-record work in ordinary PR CI, adding a separate Node harvester runtime, or claiming complete Section 508 conformance from automated scans.
