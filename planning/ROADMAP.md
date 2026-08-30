# Roadmap

This roadmap contains future work only. Delivered phases and major architectural decisions are summarized in [documentation/history/platform-evolution.md](../documentation/history/platform-evolution.md). Current verified facts live in the generated [documentation/platform-status.md](../documentation/platform-status.md). The executable checklist is [TODO.md](TODO.md), named program increments plus their execution sequence are defined in [PI_PLAN.md](PI_PLAN.md), and staged Data.gov proof is recorded in [PI1_DATA_GOV_SCALE_EVIDENCE.md](PI1_DATA_GOV_SCALE_EVIDENCE.md).

The intended execution order is **PI-1 -> PI-2 -> PI-3 -> PI-4 -> PI-5 -> PI-6**. PI-1 is active now. Its federation foundation merged through PR #3; the active branch is `codex/data-gov-10k-scale`.

A repository-wide rule applies to new work: **testing and evidence precede feature expansion**. A working local screen is a development milestone, not completion. New behavior should have unit/use-case coverage, contract coverage, browser workflow coverage, accessibility evidence and—where behavior depends on infrastructure—a real-stack smoke path before broader scenarios are added.

## PI-1 — Federated metadata expansion and large-corpus discovery

Detailed design:

- [Federated Metadata Expansion](../documentation/federation/README.md)
- [Federated Metadata Architecture](../documentation/federation/federated-metadata-architecture.md)
- [Source Ingestion Plan](../documentation/federation/source-ingestion-plan.md)
- [Million-Record Federated Metadata Corpus](../documentation/federation/million-record-corpus.md)
- [Data.gov Scale Evidence](PI1_DATA_GOV_SCALE_EVIDENCE.md)

PI-1 comes before Kubernetes. Its remaining job is to prove that the merged provenance-aware, bounded federation architecture behaves correctly at larger corpus tiers and then extend that same architecture across all planned sources.

### PI-1.1 Close the Data.gov 10K evidence checkpoint

The 10K harvest/resume path is already proven: the same durable Data.gov run advanced from 1K to 10K with 10,000 accepted, 0 rejected and 0 skipped.

Remaining 10K work:

- capture the deterministic bounded snapshot,
- run and persist guarded snapshot -> projection linkage,
- verify normal public search returns exactly 10,000 Data.gov records,
- verify at least one live 10K record through `/research/:id`,
- verify Solr/OpenSearch document-count and projection-identity parity,
- capture application PostgreSQL/Solr/OpenSearch storage growth,
- record host/container/JVM resource context and reusable duration evidence,
- calculate defensible bytes/document measurements where the probes support it.

Do not call the 10K checkpoint complete until those evidence items are closed.

### PI-1.2 Prove Data.gov 100K before broad/full harvesting

After 10K evidence closes:

- resume the durable Data.gov traversal to a controlled 100K checkpoint,
- repeat deterministic snapshot/projection linkage,
- repeat public search/facet/detail verification,
- repeat storage/resource measurements,
- compare 10K versus 100K growth before estimating the million-record budget,
- keep the current UI/domain semantics unchanged unless evidence identifies a real scale defect.

A larger/full Data.gov harvest remains out of scope until the 100K path is stable.

### PI-1.3 Finish remaining scale-sensitive platform hardening

The merged foundation already delivered provenance, federated persistence, durable runs/checkpoints/quarantine, `/research/:id`, bounded combined discovery, streaming deterministic projection, bounded Solr/OpenSearch indexing and snapshot/projection evidence.

Remaining platform hardening:

- define DOI/PMID/other durable-identifier reconciliation without silent title-based merging,
- design opaque cursor/search-after discovery pagination while preserving the current offset contract during migration,
- add large-run projection progress/throughput evidence,
- add configurable per-source request concurrency/rate policy and timeout tuning,
- record build/git identity where adapter version alone is insufficient for heavy-run evidence,
- harden Data.gov program presentation so opaque values such as `010:10` remain faithful to source metadata without becoming poor UI labels,
- consider a clearer projection-level authority label than compatibility `REPOSITORY` for mixed authority-backed projections while preserving per-record provenance semantics.

### PI-1.4 Bring in all planned source adapters

Implement in staged order:

1. DOE OSTI.GOV — preferred first 1M+ federal research corpus,
2. NASA Earthdata CMR — collections plus controlled granule slices,
3. PubMed — bibliographic/abstract relevance scale,
4. OpenAlex — broad scholarly/citation corpus after the federal path is established.

Data.gov remains the first proven federation source. “All sources in PI-1” means all adapters and bounded harvest paths are implemented and testable; it does not require every source to remain locally stored at maximum size simultaneously.

### PI-1.5 Keep source binaries external

Do not download millions of PDFs, ZIPs or NASA granule bytes merely to increase record count. Store searchable metadata, identifiers, provenance and authoritative links. Full-file mirroring remains a separate preservation decision with its own budget.

### PI-1.6 Build staged deterministic corpus checkpoints

```text
10K -> 100K -> 1M -> optional 5M+
```

Every reusable corpus needs source counts, retrieval timestamp/window, adapter/normalization version, accepted/rejected/skipped counts, deterministic snapshot/projection identity and a manifest that can be handed unchanged to PI-2.

### PI-1.7 Validate standalone before clustered topology

Every major corpus checkpoint first runs against Docker Compose with standalone Solr and single-node OpenSearch. This preserves the fast demo path and establishes the control topology for later cluster experiments.

### PI-1.8 Validate semantics as well as speed

At large scale add stable query classes and record result-set overlap, top-N overlap, rank movement, facet-bucket differences, exact-identifier behavior and broad/rare/common query behavior.

Completion means PI-1 can reproducibly harvest every planned source, render federated records through the normal UI, index a deterministic 1M-class corpus in standalone Solr/OpenSearch with parity, and hand versioned corpus definitions to PI-2.

## PI-1 supporting work — Harden provenance and repository identity

- Record source freshness per research object where publisher dates are reliable.
- Record projection/index timestamps and expose them consistently in Search Lab, Admin Sync and Evidence.
- Distinguish repository, federated, fixture, stored sample, stale response and unavailable source where those states apply.
- Review UUID/source-identifier route stability and relationship resolution.
- Add regression tests for fallback provenance, especially LODES-derived map data.
- Define cross-source identity/equivalence rules based on durable identifiers; never silently merge by title.

## PI-1 supporting work — Finish research-object language

The canonical `/research/:id` route, mixed-origin resolution and federated authority behavior are delivered. Remaining language work is narrower:

- replace residual dataset-shaped labels where the object may be a publication, report, software item, methodology, project or granule,
- update examples/demo links to prefer research-object terminology where appropriate,
- retain type-specific language where it improves clarity.

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
