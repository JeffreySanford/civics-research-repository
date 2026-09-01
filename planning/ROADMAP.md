# Roadmap

This roadmap contains future outcomes only. Delivered phases are summarized in [documentation/history/platform-evolution.md](../documentation/history/platform-evolution.md), generated repository facts live in [documentation/platform-status.md](../documentation/platform-status.md), and the exact C2 million-record milestone is recorded in [documentation/federation/scale-evidence.md](../documentation/federation/scale-evidence.md).

The repository-wide rule remains: **testing and evidence precede feature expansion**. A working local screen or one successful scale run is a development milestone, not completion.

## Current position

PI-1 has already established the standalone control baseline:

```text
DSpace curated authority: 181
        +
Application PostgreSQL federated retention: 1,000,000
  500K Data.gov + 500K DOE OSTI
        ↓
Solr:       1,000,181
OpenSearch: 1,000,181
```

The exact C2 composition and the normalized search projection have separate deterministic identities, Solr/OpenSearch parity is proven at 1M-class scale, storage and benchmark evidence are recorded, the retained corpus has a verified Gold Master archive, and active projection identity survives ordinary API restarts without reindexing.

The roadmap therefore no longer treats “reach 100K” or “build the first million” as future work.

## PI-1 — Reusable federation and search evidence

PI-1 now closes by making the successful scale architecture repeatable, semantically richer and ready for handoff.

### 1. Add a named live scale checker

Create a non-mutating `quality:scale` / `scale:evidence:check` path for a named profile.

For `FEDERATED_1M`, it should verify at minimum:

- retained federated count;
- exact source recipe and deterministic composition identity;
- composition -> projection evidence linkage;
- active profile and current projection identity/count;
- Solr/OpenSearch reachability and document-count parity;
- storage evidence tied to the projection;
- ordinary public-search provenance;
- restart-safe persisted activation state.

Heavy 1M/FULL validation remains explicit/manual or scheduled rather than part of ordinary PR CI.

### 2. Version a stable large-corpus query matrix

Define query classes that remain unchanged across engine/topology experiments:

- exact identifier;
- rare phrase;
- common multi-term query;
- author;
- publisher;
- source system;
- object type;
- date/year;
- high-cardinality facet;
- low-cardinality facet;
- empty/broad query.

Tie every result to corpus/projection identity and execution-order metadata.

### 3. Compare semantics as well as speed

Extend the Solr/OpenSearch research surface with:

- result-set overlap;
- top-N overlap;
- rank movement;
- facet-bucket differences;
- exact-identifier correctness;
- p50/p95/p99 API and native-engine latency;
- error counts and environment metadata.

The goal is to explain **why** engines differ, not merely place two latency columns side by side.

### 4. Finish scale-sensitive runtime hardening

- Add reusable projection progress/throughput evidence for large projections.
- Capture host/container/JVM CPU and memory context with heavy runs.
- Add opaque cursor/search-after pagination while retaining the current offset contract during migration.
- Define DOI/PMID/other durable-identifier reconciliation rules; never silently merge by title.
- Add configurable per-source request concurrency and explicit rate-limit policy.
- Improve presentation of opaque publisher program values without replacing raw source metadata with a fixed UI allowlist.
- Clarify projection-level authority terminology where compatibility `REPOSITORY` is too coarse for a mixed-authority projection.

### 5. Extend the federation portfolio deliberately

The evidence-first source order remains:

1. NASA Earthdata CMR — collections and controlled granule slices;
2. PubMed — bibliographic/abstract relevance scale;
3. OpenAlex — broad scholarly/citation coverage after the federal-source story is stable.

Each adapter should begin with committed fixtures and bounded reproducible slices. Another million-record run is justified only when it answers a new source/semantic question, not merely to repeat C2 with a larger number.

### PI-1 exit condition

PI-1 is ready to hand off when:

- live scale validation is one repeatable command rather than a remembered sequence of curls;
- the stable query matrix and semantic-difference evidence are versioned;
- large-projection resource/progress evidence is captured consistently;
- deep pagination no longer depends on unbounded offsets;
- all planned source adapters have reproducible bounded harvest paths;
- corpus/query definitions can be consumed unchanged by PI-2.

## PI-2 — Local Kubernetes search laboratory

Compose remains the default fast development/demo path and the standalone control topology.

PI-2 adds reproducible clustered topology:

- repository-owned kind lifecycle commands;
- SolrCloud with the official Solr Operator and ZooKeeper;
- multi-node OpenSearch with aligned mappings/analyzers;
- identical PI-1 10K/100K/1M corpus and query definitions;
- concurrency checkpoints such as 1/8/32;
- explicit shard/replica/heap/storage/resource metadata;
- deliberate node-loss/recovery and persistence verification;
- semantic parity checks before interpreting latency differences.

The purpose is topology evidence, not replacing Compose.

## PI-3 — Infrastructure as Code / AWS

Choose Terraform or CDK after PI-2 has produced defensible topology/resource evidence.

Implement the documented AWS target or a justified alternative with:

- reproducible infrastructure;
- secrets and identity;
- persistent search storage;
- observability;
- backup/restore;
- health/readiness probes;
- deployment and rollback procedures;
- explicit reasoning about whether both search engines are required outside the comparison laboratory.

## PI-4 — Manual accessibility evidence

Automated accessibility architecture is already implemented. Remaining work is dated, commit-bound manual evidence:

- keyboard-only end-to-end review;
- NVDA in Firefox and Chrome;
- JAWS, or explicit N/A with licensing reason;
- map-equivalence/focus-path review;
- cognitive/workflow review;
- Search Lab keyboard-only flow;
- review of the MapLibre canvas tab stop with a screen reader.

Automated axe/browser evidence never substitutes for these checks.

## PI-5 — Browser evidence governance

The dedicated Browser Evidence workflow exists and uploads failure evidence. Remaining governance work:

- decide which WCAG/Section 508-oriented jobs are required merge checks;
- decide whether `main` receives branch protection;
- preserve the prior known-good evidence baseline when a refresh fails.

## PI-6 — Solr/OpenSearch comparison hardening

After the core stable-query/semantic matrix is green, consider richer scenarios:

- phrase search and highlighting;
- geo;
- autocomplete/suggest;
- synonyms;
- nested/object fields;
- vector/hybrid search.

These are intentionally downstream of the basic reproducible comparison contract.

## Cross-cutting product and provenance work

- Record source freshness per research object where reliable publisher dates exist.
- Expose projection/index timestamps consistently across Admin, Evidence, Discovery and Search Lab.
- Distinguish stored sample, stale and unavailable data where those states apply.
- Review UUID/source-identifier route stability and relationship resolution.
- Replace remaining dataset-shaped copy where the object may be a publication, report, software item, methodology, project or granule.
- Move NgRx dependencies from release candidates to stable versions after validation.

## Non-goals

The roadmap does not include replacing DSpace with a search engine, forcing federated records into DSpace, making search indexes authoritative, deleting Compose after Kubernetes, downloading millions of binaries merely to inflate record count, running million-record work in ordinary PR CI, adding a separate Node harvester runtime, or claiming complete Section 508 conformance from automated scans.
