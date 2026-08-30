# Roadmap

This roadmap contains future work only. Delivered phases and major architectural decisions are summarized in [documentation/history/platform-evolution.md](../documentation/history/platform-evolution.md). Current verified facts live in the generated [documentation/platform-status.md](../documentation/platform-status.md). The executable checklist is [TODO.md](TODO.md), and named program increments plus their execution sequence are defined in [PI_PLAN.md](PI_PLAN.md).

The current execution order is **PI-4 -> PI-5 -> PI-6 -> return to PI-1 -> PI-2 -> PI-3**. The PI numbers identify stable workstreams; they are not chronological phase numbers. PI-1 work already implemented remains valid and will be audited against its exit criteria when the project returns to the scale path.

A repository-wide rule now applies to new comparison work: **testing and evidence precede feature expansion**. A working local screen is a development milestone, not completion. New behavior should have unit/use-case coverage, contract coverage, browser workflow coverage, accessibility evidence and—where the behavior depends on infrastructure—a real-stack smoke path before broader scenarios are added.

## PI-4 — Complete manual accessibility evidence

The highest-priority gap is evidence quality, not UI breadth.

- Run the full keyboard-only checklist without a mouse.
- Record NVDA evidence with Firefox and Chrome.
- Record JAWS evidence where a license is available, or record an explicit N/A reason.
- Complete the trusted map-click to accessible-list focus check and the rest of the map-equivalence review.
- Record the cognitive/workflow review.
- Exercise Search Lab without a mouse, including scenario selection, filter entry, run action, live completion status, projection evidence and both result regions.
- Decide whether a `contentinfo` landmark improves the application shell.

Completion means dated, commit-bound artifacts exist under `documentation/accessibility-evidence/`; it does not mean changing a manually unverified status to pass.

## PI-5 — Govern browser evidence as a merge policy

Dedicated Browser Evidence is implemented and scheduled. It runs deterministic Chromium/Firefox/WebKit comparison and accessibility evidence, preserves HTML reports and failure traces/screenshots, and includes a live Angular -> Spring -> Solr + OpenSearch smoke path. Mocked deterministic evidence and real-stack evidence are labelled separately.

Remaining governance decisions:

- Decide which evidence jobs must block merges.
- Decide whether `main` receives branch protection and required checks.
- Keep the local `evidence:refresh` behavior: a failed run must never replace the prior known-good evidence.

## PI-6 — Harden the Solr/OpenSearch comparison demo

The first side-by-side vertical slice now exists. DSpace remains authoritative for curated repository objects; the Java layer normalizes research objects, computes deterministic projection identity and projects equivalent documents into Solr and OpenSearch. Solr remains the production-shaped public discovery implementation while OpenSearch is currently a parallel comparison target.

The next phase is **hardening, observability and explanation**, not simply adding more query types.

### PI-6.1 Keep the implemented test matrix as the expansion gate

The comparison service/controller, Angular component/client, OpenSearch request semantics, deterministic Playwright scenarios, axe route, storyboard, and live-stack smoke are all implemented. Future comparison behavior must extend those layers rather than bypassing them.

### PI-6.2 Keep Admin Sync as the operational projection view

Admin Sync now explains normalized `DiscoveryDocument` -> deterministic projection ID -> Solr + OpenSearch, including per-target liveness/parity and the distinction between public Solr discovery and the OpenSearch comparison target. PI-1 federation work should extend this vocabulary to identify repository versus federated source composition rather than return to Solr-only language.

### PI-6.3 Keep Evidence explicit about verification boundaries

Evidence includes live projection/parity state plus a Search Engine Comparison section that separates unit/use-case gates, deterministic mocked browser evidence, automated WCAG/Section 508-oriented evidence, real-stack smoke evidence, repeated performance diagnostics, and manual keyboard/screen-reader work that remains pending.

The runtime page does not synthesize current CI success. Exact commit validation remains a CI/PR artifact.

### PI-6.4 Improve explanatory diagnostics before broader search features

Engine-native Solr `QTime` / OpenSearch `took` and repeated warm-up/p50/p95/p99 tooling are implemented separately from API elapsed timing. Remaining diagnostic work:

- Add result-set, rank-order and facet-bucket difference summaries so the UI explains semantic differences.
- Record richer environment details for scale testing: index/shard/replica configuration, JVM/container context and concurrency.
- Repeat at materially larger index sizes before drawing scaling conclusions.
- Keep the UI warning that local/container timings are diagnostic evidence, not production benchmarks.

### PI-6.5 Expand scenarios only after hardening

After the test/evidence matrix is green:

- phrase search,
- highlighting,
- geo search,
- autocomplete/suggest,
- synonyms,
- nested/object search,
- vector and hybrid lexical/semantic search.

The hybrid/vector work is strategically useful because OpenSearch can be evaluated for capabilities beyond ordinary lexical search. It should be framed as a capability comparison rather than an assumption that OpenSearch is automatically faster than Solr.

## PI-1 supporting work — Harden provenance and repository identity

Repository identity is recorded for publisher-backed objects; PI-1 expands that model so provenance can represent both curated repository content and external federated metadata.

- Record source freshness per research object.
- Record projection/index timestamps and make them visible consistently in Search Lab, Admin Sync and Evidence.
- Distinguish repository, federated, fixture, stored sample, stale response and unavailable source with a typed provenance model.
- Review route handling so UUID-backed and source-identifier-backed research links remain stable.
- Add regression tests for fallback provenance, especially LODES-derived map data.

## PI-1 supporting work — Finish research-object language

The domain model is research-object-shaped, but several routes and labels retain dataset-era wording. PI-1 makes this work a prerequisite because federated records will include publications, reports, software and scientific granules as well as datasets.

- Add `/research/:id` as the canonical detail route while preserving `/datasets/:id` compatibility.
- Resolve research detail from DSpace or the federated metadata catalog.
- Replace remaining labels such as “Loading dataset detail,” “Dataset supporting information,” and “Open related dataset.”
- Update API/documentation examples to use “research object” where the type is not necessarily a dataset.
- Keep type-specific language where it improves clarity.

## Cross-cutting — Expand publisher verification

The curated catalog should remain verifiable even as federation expands.

- Add publisher listing/vintage checks for programs that do not yet have them.
- Keep vintage changes reviewable; do not automatically rewrite file templates into plausible 404s.
- Keep NOAA Climate Data Online and NASA POWER as possible additional adapters after the planned PI-1 source portfolio is stable.
- Preserve the distinction between publisher-discovered facts and repository-curated relationships.

## PI-1 — Federated metadata expansion and large-corpus discovery

Detailed design:

- [Federated Metadata Expansion](../documentation/federation/README.md)
- [Federated Metadata Architecture](../documentation/federation/federated-metadata-architecture.md)
- [Source Ingestion Plan](../documentation/federation/source-ingestion-plan.md)
- [Million-Record Federated Metadata Corpus](../documentation/federation/million-record-corpus.md)

PI-1 comes before Kubernetes. Its job is to create a scalable, provenance-aware catalog and deterministic corpus artifacts that work against the existing standalone topology. Existing PI-1 F0 implementation remains part of this increment; after PI-4 through PI-6 close, PI-1 resumes from the earliest unmet exit criterion rather than restarting.

### PI-1.1 Evolve authority without weakening it

The existing invariant becomes:

- DSpace is authoritative for curated repository objects,
- external publishers are authoritative for federated source records,
- the application federated metadata store is the reproducible local catalog of those records,
- Solr and OpenSearch are derived state for both origins.

A search document that cannot be reproduced from either DSpace or a provenance-bearing federated record is an integrity failure.

### PI-1.2 Build the federated metadata foundation first

Before large harvesting:

- add `origin` and controlled `sourceSystem`,
- make publisher/program/subject values data-driven rather than collapsing unknown programs into `OTHER`,
- add namespaced source identity and explicit cross-source reconciliation rules,
- add federated metadata persistence plus harvest-run/checkpoint/error state,
- implement `/research/:id` detail resolution for both origins,
- replace whole-corpus in-memory projection with bounded streaming/batched projection,
- plan cursor/search-after pagination before deep offsets become an operational problem.

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

Every reusable corpus needs:

- source counts,
- retrieval timestamp/window,
- adapter/normalization version,
- accepted/rejected/skipped counts,
- deterministic projection identity,
- manifest that can be handed unchanged to PI-2.

### PI-1.6 Validate standalone first

Every major corpus checkpoint first runs against:

```text
Docker Compose
  Solr standalone
  OpenSearch single node
```

This preserves the fast demo path and establishes the control topology for later cluster experiments.

### PI-1.7 Validate semantics as well as speed

At large scale add stable query classes and record:

- result-set overlap,
- top-N overlap,
- rank movement,
- facet-bucket differences,
- exact-identifier behavior,
- broad/rare/common query behavior.

Completion means PI-1 can reproducibly harvest every planned source, render federated records through the normal UI, index a deterministic 1M-class corpus in standalone Solr/OpenSearch with parity, and hand versioned corpus definitions to PI-2.

## PI-2 — Local Kubernetes search laboratory

Detailed design:

- [Local Cloud Search Laboratory](../documentation/cloud/README.md)
- [Local Kubernetes Search Cluster](../documentation/cloud/local-kubernetes-search-cluster.md)

PI-2 consumes PI-1 corpora. It does not invent a separate data model.

### PI-2.1 Preserve Docker Compose permanently

Compose remains the default development/demo path and the reference baseline. Kubernetes is an additional topology, not a replacement.

### PI-2.2 Add kind as the local Kubernetes substrate

- Create a reproducible kind cluster from repository configuration.
- Prefer one control-plane plus multiple worker nodes so placement and node-loss experiments are visible.
- Add repository scripts for create/build/deploy/reindex/benchmark/destroy.
- Record Docker Desktop and Kubernetes resource allocation with every benchmark.

### PI-2.3 Run real SolrCloud

- Use the official Apache Solr Operator rather than merely running standalone Solr inside a pod.
- Start with three Solr pods and ZooKeeper.
- Compare 1, 2 and 3 shard layouts before adding replicas.
- Add replica/failover experiments only after the baseline is reproducible.

### PI-2.4 Run multi-node OpenSearch

- Use the official OpenSearch Kubernetes Operator or Helm chart.
- Start with a three-node cluster and explicit resource limits.
- Compare 1, 2 and 3 primary-shard layouts.
- Add replicas as a resilience experiment rather than assuming replicas improve single-query latency.

### PI-2.5 Compare identical data and query definitions

PI-2 must use the exact PI-1 corpus manifest/projection identity and stable query set for standalone versus clustered comparisons.

Initial meaningful corpus tiers:

```text
10K
100K
1M where host resources permit
```

Concurrency checkpoints:

```text
1
8
32
```

### PI-2.6 Preserve measurement honesty

At each topology, retain:

- deterministic corpus/projection identity,
- API elapsed distributions,
- Solr `QTime`,
- OpenSearch `took`,
- warm-up and measured sample counts,
- shard/replica counts,
- JVM/pod resources,
- concurrency,
- throughput/error counts,
- semantic parity/difference evidence.

Before comparative speed claims, benchmark with alternating/randomized/separate equivalent engine execution rather than a fixed Solr-first order.

### PI-2.7 Test resilience, not only latency

Deliberately remove Solr/OpenSearch pods and record:

- search availability,
- latency/error behavior during degradation,
- Kubernetes recreation time,
- shard/replica recovery,
- projection parity after recovery,
- persistent-volume behavior across restarts.

Completion means the repository can reproduce a clustered local search topology, compare it honestly with Compose using the same PI-1 corpora, and demonstrate node-loss/recovery without implying that one workstation predicts cloud capacity.

## PI-3 — Implement the documented AWS target

The AWS architecture is documented but not provisioned. PI-1 and PI-2 should inform this step rather than being treated as unrelated experiments.

- Choose Terraform or CDK.
- Implement a minimal environment matching the documented EKS recommendation or the ECS/Fargate alternate.
- Include RDS, persistent search storage, frontend delivery, secrets, logs, metrics, backup and restore.
- Treat Solr/OpenSearch deployment topology as an explicit architecture decision rather than assuming local single-node or kind behavior predicts production behavior.
- Reuse Kubernetes/operator/Helm configuration concepts where they transfer cleanly from kind to EKS.
- Document local-to-cloud migration and operational cost boundaries.

## Cross-cutting — Platform and test hardening

- Move NgRx to stable 22 when available and validated.
- Revisit generated Spring controller interfaces when tooling supports Spring 7 conventions.
- Add Testcontainers coverage for `JdbcSyncJobStore` and repository integration seams.
- Replace generic API failures with typed error responses where the contract is still vague.
- Review Nx upgrade warnings and dependency alignment without changing architectural patterns merely for novelty.
- Revisit the mirror budget when storage permits, while keeping preservation totals measured and dated.

## Non-goals

The roadmap does not include:

- replacing DSpace with either public discovery index,
- requiring every federated record to become a DSpace item,
- making Solr or OpenSearch authoritative metadata stores,
- sharing DSpace's internal Solr as the application's public search API,
- claiming OpenSearch is inherently faster than Solr from a single local request,
- assuming horizontal scaling is unique to OpenSearch; SolrCloud also supports distributed search,
- treating additional nodes as a guarantee of lower single-query latency,
- treating a kind cluster on one workstation as equivalent to multiple physical/cloud nodes,
- deleting the standalone Compose topology after Kubernetes exists,
- downloading millions of full-text/binary artifacts merely to inflate record count,
- running million-record harvest/index work in every pull-request CI run,
- adding a separate Node harvester runtime,
- replacing NgRx solely to reduce line count,
- turning the repository into a municipal dashboard at the expense of its federal Open Science model,
- claiming complete Section 508 conformance from automated scans.
