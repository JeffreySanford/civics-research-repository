# Program Increment Plan

This plan defines six named program increments. The program-increment numbers are stable workstream identities and the intended execution order is numeric:

```text
PI-1 Federated Metadata Expansion
        |
        | produces deterministic corpora
        v
PI-2 Local Kubernetes Search Laboratory
        |
        | validates topology/resilience/scale
        v
PI-3 AWS Implementation Candidate
        |
        | applies measured local lessons to cloud architecture
        v
PI-4 Manual Accessibility Evidence
        |
        | closes remaining human-verification gaps
        v
PI-5 Browser Evidence CI and Governance
        |
        | governs repeatable browser/accessibility evidence
        v
PI-6 Solr/OpenSearch Comparison Hardening
```

PI-1 is the active increment. The F0/foundation work merged through PR #3 on 2026-08-30 at `main` commit `4569416371c15bfe96660d53c4756a48d3c4ed4b`. The active branch is `codex/data-gov-10k-scale`.

Docker Compose standalone search remains supported throughout all increments. It is the fastest local development path, the easiest live-demo topology, the functional/regression baseline, the lowest-overhead environment for small corpora, and the control topology for later performance experiments.

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

PI-1 establishes:

- `origin` / `sourceSystem` provenance,
- dynamic publisher/program taxonomy,
- federated metadata persistence,
- namespaced source identity and deduplication rules,
- harvest-run/checkpoint/error model,
- `/research/:id` detail abstraction,
- combined repository + federated discovery catalog,
- streaming/batched deterministic projection,
- deterministic bounded snapshots and snapshot/projection evidence,
- cursor-capable search pagination design.

The persistence layer must use bounded database batches. API-level batching that still performs one database interaction per record does not satisfy the scale requirement.

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

The operational scale ladder is:

```text
curated demo (~200; currently 181)
  -> 10K
  -> 100K
  -> 1M
  -> optional FULL/source-defined bound
```

The program-increment milestone names remain:

```text
F0 foundation
F1 1K/10K federation proof + reusable instrumentation
F2 100K standalone proof
F3 1M standalone proof
F4 multi-source 1M-class corpus
F5 PI-1 handoff snapshot/manifests
```

The curated baseline is intentionally approximate rather than fixed at exactly 200; it remains a small inspectable repository regression/demo corpus. The federated tiers are explicit bounded scale checkpoints.

Detailed operator/profile behavior is defined in [CORPUS_SCALE_ADMIN_PLAN.md](CORPUS_SCALE_ADMIN_PLAN.md).

### Current checkpoint — 2026-08-30

F0 is merged. The 1K portion of F1 is complete end to end:

- 1,000 Data.gov accepted / 0 rejected / 0 skipped,
- deterministic bounded snapshot persisted,
- guarded snapshot -> projection relationship persisted,
- combined projection count 1,181 = 181 curated + 1,000 federated,
- public search returned exactly 1,000 `DATA_GOV` records with federated provenance,
- publisher/program/source facets were produced from the indexed corpus.

The 10K functional portion of F1 is also complete:

- the same durable Data.gov run `e8dcd9ef-85d5-48d4-8b13-4f8cdc939131` resumed from 10 pages/1,000 accepted records to 100 pages/10,000 accepted,
- accepted/rejected/skipped = 10,000 / 0 / 0,
- snapshot `DATA_GOV:dbe9d11ba420ddf4c8854eced77aed8f2d9fafcd4f96d5d8be22c419378ef12b` persisted,
- guarded projection `b292f98bb8b141dd477cfbcdc9149e44bd53559c153c431f772809f41836742e` contains 10,181 objects = 181 curated + 10,000 federated,
- projection-history evidence retained both the 1K and 10K snapshot/projection pairs,
- normal public search returned exactly 10,000 `DATA_GOV` records,
- a live `/research/:id` record resolved with federated provenance, authoritative publisher URL and no invented local files,
- live comparison reported `sameProjection: true`, with Solr and OpenSearch both reachable and both containing 10,181 documents on the same projection ID,
- the isolated 9,000-document projection increase added 4,342,637 bytes to Solr and 4,365,807 bytes to OpenSearch, approximately 482.5 and 485.1 bytes per newly projected object,
- DSpace storage did not change during the federated search-index growth.

The whole F1 checkpoint is **not yet complete** because instrumentation still needs to become reusable rather than manually reconstructed. Before Data.gov 100K:

- record host/container/JVM CPU and memory context,
- record reusable harvest elapsed time/records-per-second,
- record reusable projection elapsed time/documents-per-second,
- calculate application-PostgreSQL bytes per federated record only if a defensible historical 1K baseline exists,
- replace the hard-coded `CURATED_DEMO` active-profile label with runtime-derived active-profile semantics,
- expose profile evidence in Admin,
- add a live named-profile scale checker distinct from ordinary PR quality gates.

The exact 10K evidence is maintained in [PI1_DATA_GOV_SCALE_EVIDENCE.md](PI1_DATA_GOV_SCALE_EVIDENCE.md).

### Admin profile activation and evidence

The current corpus UI can view named profiles and storage history. PI-1 must evolve it into guarded profile activation for:

```text
CURATED_DEMO
FEDERATED_10K
FEDERATED_100K
FEDERATED_1M
FULL
```

Activation is not a client-side toggle. A safe profile activation must preview current/target state, resume compatible harvest state, stop at the bound, capture the deterministic snapshot, run guarded projection, verify Solr/OpenSearch parity, capture metrics, and only then mark the profile active. Failed activation preserves the previous known-good search projection/evidence.

100K, 1M and FULL are explicit heavy operations. Arbitrary user-entered record counts are not required for the first version; named profiles keep evidence reproducible. A custom bounded profile can be added later if needed without changing the identity/evidence rules.

At each tier Admin should eventually expose:

- retained federated records,
- active projected documents,
- application PostgreSQL bytes,
- DSpace stored bytes,
- Solr/OpenSearch bytes,
- total known measured bytes,
- defensible bytes/record or bytes/projected-document,
- harvest duration and records/second,
- projection duration and documents/second,
- stable-query API elapsed time plus Solr `QTime` / OpenSearch `took`,
- p50/p95/p99 distributions,
- host/container/JVM resource context,
- snapshot/projection IDs,
- topology and later shard/replica/node layout.

Unknown values remain `Not measured`, never misleading zeroes.

### Quality strategy

`quality:all` is the deterministic ordinary-development/PR gate. It covers formatting, OpenAPI lint/generated drift, fixture/evidence/document drift, benchmark-tool tests, lint, all unit/service/component tests, all buildable application/runtime targets, and deterministic browser report suites.

Live 10K/100K/1M harvesting and projection do **not** belong in `quality:all`; they depend on external APIs, persistent local state, host capacity and long-running evidence collection.

PI-1 should add a separate live named-profile check, conceptually `quality:scale` / `scale:evidence:check`, which validates retained count, snapshot identity, guarded linkage, active projection, Solr/OpenSearch parity, public-search provenance and required measurement evidence for the selected profile. 1M/FULL checks remain explicit/manual or scheduled rather than ordinary PR checks.

### F0 foundation status

The merged foundation delivered the scale-sensitive path that had to exist before broad harvesting:

1. bounded JDBC metadata persistence,
2. typed provenance/source-system contract,
3. dynamic publisher/program taxonomy,
4. combined DSpace + federated catalog,
5. bounded streaming search projection,
6. deterministic streaming projection identity,
7. durable harvest-run/checkpoint/quarantine observability,
8. bounded snapshot and guarded snapshot/projection evidence,
9. authority-neutral research detail routing.

Still open from the original foundation design are cross-source durable-identifier reconciliation and opaque cursor/search-after pagination for million-record public discovery. Those are now follow-on scale-hardening work rather than blockers to the merged F0 path.

### Exit criteria

PI-1 exits only when:

- all five adapters are implemented with fixture/unit coverage,
- Data.gov and OSTI work through the normal UI,
- at least one additional source works through the same path,
- all sources support reproducible bounded harvesting,
- provenance and detail routing distinguish repository/federated records,
- metadata persistence and projection are bounded-memory and batch-oriented,
- named corpus profiles can be activated and measured without changing record semantics,
- a deterministic 1M corpus is reproducible,
- standalone Solr and OpenSearch receive identical normalized input,
- count/projection parity is verified,
- comparable storage/resource/performance evidence exists at meaningful tiers,
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

PI-2 includes deliberate node-loss and recovery experiments for both engines. Evidence covers search availability during failure, error/latency changes, pod recreation, shard/replica recovery, persistence and projection parity after recovery.

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

## PI-3 — AWS Implementation Candidate

Only after PI-2 should the project commit to production-shaped AWS topology details.

PI-2 informs:

- EKS node sizing,
- search shard/replica strategy,
- storage requirements,
- JVM/pod resource defaults,
- persistence choices,
- operational probes,
- whether both search engines need to exist in a deployed target at all.

Terraform/CDK selection remains a separate implementation decision.

## PI-4 — Manual Accessibility Evidence

### Objective

Close the remaining human-verification gap that automated lint, axe and Playwright evidence cannot prove. PI-4 is evidence work first: it records actual keyboard and assistive-technology behavior without converting an unverified manual status into a pass.

### Required evidence

PI-4 includes:

- complete keyboard-only application review without a mouse,
- NVDA evidence in Firefox and Chrome,
- JAWS evidence where a license is available, or an explicit documented N/A reason,
- trusted map-click/map-to-list focus behavior and the broader map-equivalence review,
- cognitive/workflow review,
- MapLibre canvas tab-stop review with a screen reader,
- Search Lab keyboard-only review,
- a decision on whether a `contentinfo` landmark improves the shell.

### Exit criteria

PI-4 exits when every manual checklist has a dated, commit-bound result; failures or limitations are explicit; findings that require code changes have regression coverage; and Search Lab has a recorded non-mouse verification path.

## PI-5 — Browser Evidence CI and Governance

### Objective

Turn browser/accessibility evidence from an optional development aid into a repeatable governed quality signal with clear merge-policy decisions.

### Required evidence and governance

PI-5 includes:

- deterministic Chromium/Firefox/WebKit comparison evidence,
- automated WCAG/Section 508-oriented axe coverage,
- Search Lab comparison scenarios in the dedicated browser workflow,
- a live browser -> Spring API -> Solr + OpenSearch smoke path distinct from mocked deterministic evidence,
- preserved HTML reports, traces and screenshots on failure,
- local and CI use of the same evidence/document-drift rules,
- an explicit decision on required evidence checks,
- an explicit decision on `main` branch protection.

### Exit criteria

PI-5 exits when deterministic browser evidence is reproducible, the real-stack smoke path remains independently visible, failures preserve actionable artifacts, failed refreshes cannot replace the prior known-good baseline, and merge-check/branch-protection decisions are documented.

## PI-6 — Solr/OpenSearch Comparison Hardening

### Objective

Make the Search Lab explain semantic differences between Solr and OpenSearch beyond the scale evidence already created in PI-1/PI-2.

The first side-by-side vertical slice already exists. PI-6 focuses on explanation, reproducibility and expansion discipline rather than adding query types merely for breadth.

### Required hardening

PI-6 includes:

- result-set overlap summaries,
- top-N/rank-order difference summaries,
- facet-bucket difference summaries,
- stable comparison query/scenario definitions,
- richer environment metadata,
- clear separation of semantic quality from timing/performance evidence,
- phrase search and highlighting after the current matrix is green,
- geo, autocomplete/suggest, synonyms, nested/object and vector/hybrid scenarios after the core comparison path is hardened.

### Exit criteria

PI-6 exits when the UI/evidence explains meaningful result-set, rank and facet differences, deterministic browser and real-stack evidence cover the hardened behavior, comparison queries/projection identity are reproducible, performance diagnostics retain sufficient context, and future scenario breadth has a documented evidence gate.

## Cross-PI invariants

These rules remain true across all six increments:

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
11. Automated accessibility evidence never substitutes for required manual evidence.
12. A failed evidence run never overwrites a prior known-good baseline.

## Planning risks to resolve during PI-1

### Taxonomy explosion

**Architecture resolved; presentation hardening remains.**

`sourceSystem` and `contentType` are controlled while publisher/program values are data-driven. Live Data.gov evidence showed why display hardening still matters: valid publisher program values such as `010:10` and `010:12` are searchable but not especially human-readable. Preserve the raw publisher value and add a defensible label/presentation strategy without reintroducing a fixed UI allowlist.

### Repository-versus-federated ambiguity

**Resolved for the merged foundation.**

Canonical `/research/:id` routing, per-record `origin`/`sourceSystem`, federated-authority messaging and authoritative external links distinguish repository and federated records. `/datasets/:id` remains a compatibility route.

### Full-corpus memory usage

**Resolved architecturally; scale evidence remains.**

Projection uses bounded combined-catalog pages, streaming deterministic hashing and bounded Solr/OpenSearch batches. 10K/100K/1M checkpoints still need resource context to prove the implementation behaves as intended under larger corpora.

### Deep pagination

Offset-based page numbers become inefficient at million-record scale.

Resolution direction: cursor/search-after capable API contract with opaque tokens while preserving accessible Previous/Next UI and the current offset contract during migration.

### Source API volatility/rate limiting

The shared retry/checkpoint framework is implemented, including bounded retry and `Retry-After` awareness. Remaining work is source-specific concurrency/rate policy, timeout tuning and evidence at larger scales.

### Cross-source duplicates

The same research output may appear in OSTI, PubMed, Data.gov or OpenAlex.

Resolution direction: preserve namespaced source identity first; reconcile by durable identifiers separately; never silently merge on title.

### Local disk multiplication

One million metadata records exist simultaneously in the federated store, Solr, OpenSearch and optionally snapshots. PI-2 replicas increase this again.

Resolution direction: measure bytes/document at 10K/100K, establish disk budgets/headroom before 1M, and allow old corpora to be regenerated rather than permanently retained.

### CI cost

Million-record harvest/index runs are inappropriate for every pull request.

Resolution direction: keep `quality:all` deterministic, use tiny fixtures in normal CI, and put named-profile live assertions in a separate scale-evidence gate.

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

Recommended execution branches:

```text
PI-1
  codex/federated-metadata-catalog   # merged through PR #3
  codex/data-gov-10k-scale          # active
  codex/data-gov-100k-scale         # after 10K instrumentation closes
  codex/osti-adapter
  codex/nasa-cmr-adapter
  codex/pubmed-adapter
  codex/openalex-adapter
  codex/million-record-projection

PI-2
  codex/kubernetes-search-cluster
  codex/kubernetes-resilience-evidence

PI-3
  infrastructure branch(es) selected after PI-2 evidence

PI-4 / PI-5 / PI-6
  evidence/manual-accessibility work as appropriate
  codex/browser-evidence-governance
  codex/search-comparison-hardening
```

Large increments should still be broken into independently testable PRs rather than one long-lived mega-branch.
