# Program Increment Plan

This plan separates the next two large initiatives so data semantics and infrastructure topology can evolve independently while remaining intentionally connected.

## Delivery strategy

```text
PI-1 Federated Metadata Expansion
        |
        | produces deterministic corpora
        v
PI-2 Local Kubernetes Search Laboratory
        |
        | validates topology/resilience/scale
        v
Future AWS / EKS implementation
```

Docker Compose standalone search remains supported throughout all increments.

It is not a temporary implementation to be deleted after Kubernetes exists. It remains:

- the fastest local development path,
- the easiest live-demo topology,
- the functional/regression baseline,
- the lowest-overhead environment for small corpora,
- the control topology for performance experiments.

## PI-1 — Federated Metadata Expansion

### Objective

Expand discovery from the current curated repository slice to multiple large Open Science metadata sources without locally hosting their large underlying data artifacts.

### Sources in scope

All identified adapters are part of PI-1:

1. Data.gov,
2. DOE OSTI.GOV,
3. NASA Earthdata CMR,
4. PubMed,
5. OpenAlex.

The adapters all ship in PI-1, but corpus sizes remain staged. The workstation does not need every source loaded at maximum size simultaneously.

### Architectural foundation

PI-1 must first establish:

- `origin` / `sourceSystem` provenance,
- dynamic publisher/program taxonomy,
- federated metadata persistence,
- namespaced source identity and deduplication rules,
- harvest-run/checkpoint/error model,
- `/research/:id` detail abstraction,
- combined repository + federated discovery catalog,
- streaming/batched deterministic projection,
- cursor-capable search pagination design.

### Functional result

A user should be able to search the normal Angular discovery UI and see DSpace-backed and federated records together while understanding their provenance.

Example:

```text
1,000,181 research objects

Source
  DOE OSTI             700,000
  Data.gov             200,000
  NASA CMR              80,000
  Census/DSpace            181
  ...
```

Facet counts are illustrative; actual source counts are recorded at harvest time.

### Scale milestones

```text
F0 foundation
F1 1K/10K federation proof
F2 100K standalone proof
F3 1M standalone proof
F4 multi-source 1M-class corpus
F5 PI-1 handoff snapshot/manifests
```

### Exit criteria

PI-1 exits only when:

- all five adapters are implemented with fixture/unit coverage,
- Data.gov and OSTI work through the normal UI,
- at least one additional source works through the same path,
- all sources support reproducible bounded harvesting,
- provenance and detail routing distinguish repository/federated records,
- projection is bounded-memory and batch-oriented,
- a deterministic 1M corpus is reproducible,
- standalone Solr and OpenSearch receive identical normalized input,
- count/projection parity is verified,
- large-source query and semantic-difference evidence exists,
- the existing small Compose demo still works,
- a versioned corpus manifest is ready for PI-2.

## PI-2 — Local Kubernetes Search Laboratory

### Objective

Use the corpus artifacts created in PI-1 to test whether clustered search improves throughput, resilience or operational behavior enough to justify its coordination overhead.

PI-2 does **not** redefine ingestion or metadata semantics.

### Initial topology

```text
kind
  control plane
  worker nodes

SolrCloud
  official Solr Operator
  3 Solr pods
  ZooKeeper
  configurable shards/replicas

OpenSearch
  3-node cluster
  configurable primaries/replicas
```

### Required topology comparisons

Every meaningful PI-2 experiment compares against a PI-1 standalone baseline using the exact same corpus identity.

```text
Compose standalone
  vs
Kubernetes clustered
```

Initial corpus checkpoints:

```text
10K
100K
1M where host resources permit
```

Initial concurrency checkpoints:

```text
1
8
32
```

### Resilience work

PI-2 must include deliberate node-loss and recovery experiments for both engines.

Evidence should cover:

- search availability during failure,
- error/latency changes,
- pod recreation,
- shard/replica recovery,
- persistence,
- projection parity after recovery.

### Exit criteria

PI-2 exits when:

- kind lifecycle is repository-owned and reproducible,
- SolrCloud and multi-node OpenSearch run locally,
- PI-1 snapshots can be projected without changing semantics,
- Search Lab works against clustered engines,
- standalone Compose remains supported,
- topology metadata is captured with performance artifacts,
- clustered versus standalone measurements use identical corpus/query definitions,
- at least one failure/recovery scenario per engine is reproducible,
- no result claims kind predicts cloud performance.

## PI-3 — AWS implementation candidate

Only after PI-2 should the project commit to production-shaped AWS topology details.

PI-2 should inform:

- EKS node sizing,
- search shard/replica strategy,
- storage requirements,
- JVM/pod resource defaults,
- persistence choices,
- operational probes,
- whether both search engines need to exist in a deployed target at all.

Terraform/CDK selection remains a separate implementation decision.

## Cross-PI invariants

These rules must remain true in both PI-1 and PI-2:

1. Search engines are derived state.
2. DSpace remains authoritative for curated repository objects.
3. External publishers remain authoritative for federated records.
4. The underlying large public files are not mirrored merely for search scale.
5. A corpus has deterministic provenance and identity before performance is interpreted.
6. Solr and OpenSearch receive equivalent normalized input.
7. Topology never changes record meaning.
8. Standalone remains a supported baseline.
9. Kubernetes is optional for ordinary development/demo use.
10. Performance and semantic quality are measured separately.

## Planning risks to resolve during PI-1

### Taxonomy explosion

A fixed `ResearchProgram` enum will not scale to thousands of provider program names.

Resolution direction: controlled `sourceSystem` and `contentType`; data-driven publisher/program/subjects.

### Repository-versus-federated ambiguity

The UI currently assumes every detail route describes a repository object.

Resolution direction: canonical `/research/:id` route and explicit origin/provenance.

### Full-corpus memory usage

The current projection materializes a `List<DiscoveryDocument>` and search clients build whole update payloads.

Resolution direction: streaming/batched normalization, hashing and indexing before 100K/1M.

### Deep pagination

Offset-based page numbers become inefficient at million-record scale.

Resolution direction: cursor/search-after capable API contract with opaque tokens while preserving accessible Previous/Next UI.

### Source API volatility/rate limiting

Every public source has different pagination, quotas and schema evolution.

Resolution direction: source adapters behind a common resumable framework, source fixture tests and recorded adapter versions.

### Cross-source duplicates

The same research output may appear in OSTI, PubMed, Data.gov or OpenAlex.

Resolution direction: preserve namespaced source identity first; reconcile by durable identifiers separately; never silently merge on title.

### Local disk multiplication

One million metadata records exist simultaneously in the federated store, Solr, OpenSearch and optionally snapshots. PI-2 replicas increase this again.

Resolution direction: measure bytes/document at 10K/100K, establish disk budgets/headroom before 1M, and allow old corpora to be regenerated rather than permanently retained.

### CI cost

Million-record harvest/index runs are inappropriate for every pull request.

Resolution direction: tiny deterministic fixtures in normal CI, optional scheduled/manual bounded integration runs, and artifact/manifests for heavy evidence.

## Planning risks to resolve during PI-2

### One-host cluster illusion

Multiple kind workers still share one physical workstation.

Resolution: describe results as local orchestration/topology evidence, not cloud capacity evidence.

### Resource starvation masquerading as engine performance

Six JVM search pods plus ZooKeeper can create memory/CPU contention.

Resolution: record host/Docker/pod/heap resources and reject comparisons where one topology is swapping/throttled.

### Standalone/cluster schema drift

Separate deployment configuration can accidentally create different mappings/schema behavior.

Resolution: generate/version common search schema/mapping definitions and verify query/result parity before performance comparison.

### Operational complexity exceeding value

Clustered search may not improve single-user latency even at 1M.

Resolution: measure throughput, failure recovery and operational resilience in addition to latency. Keeping Compose means Kubernetes can remain a specialized lab even if it is not the best daily topology.

## Branch strategy

Recommended implementation branches:

```text
codex/federated-metadata-catalog
codex/data-gov-adapter
codex/osti-adapter
codex/nasa-cmr-adapter
codex/pubmed-adapter
codex/openalex-adapter
codex/million-record-projection

then

codex/kubernetes-search-cluster
codex/kubernetes-resilience-evidence
```

Large increments should still be broken into independently testable PRs rather than one long-lived mega-branch.
