# Roadmap

This roadmap contains future outcomes only. Delivered phases are summarized in [documentation/history/platform-evolution.md](../documentation/history/platform-evolution.md), generated repository facts live in [documentation/platform-status.md](../documentation/platform-status.md), and the exact C2 million-record milestone is recorded in [documentation/federation/scale-evidence.md](../documentation/federation/scale-evidence.md).

The repository-wide rule remains: **testing and evidence precede feature expansion**. A working local screen or one successful scale run is a development milestone, not completion.

## Current position

PI-1 has established the standalone control baseline:

```text
DSpace curated authority: 181
        +
Application PostgreSQL federated retention: 1,000,000
  500K Data.gov + 500K DOE OSTI
        ↓
Solr:       1,000,181
OpenSearch: 1,000,181
```

The exact C2 composition and normalized search projection have separate deterministic identities. Solr/OpenSearch parity is proven at 1M-class scale, the retained corpus has a verified Gold Master archive, active projection identity survives ordinary API restarts without reindexing, and `quality:scale` certifies the live C2 contract from one command.

PRs #13 and #14 delivered the versioned semantic matrix, exact identifier probes and structured comparison filters. PRs #16 and #19 then made opaque cursor/search-after traversal the deep-discovery path and certified two complete 1,000,181-result traversals with no gaps or duplicates while retaining offset compatibility for migration.

The Maps foundation has also moved past planning. The workspace now has purpose-oriented categories, capability-aware SAIPE controls, shared authoritative county geometry joined by GEOID, and the first **Research Coverage** child: bounded **Repository research by area** driven by the effective Discovery criteria with a semantic table equivalent. PR #18 also added the deterministic Data.gov spatial-availability probe needed for the next enrichment decision.

The remaining PI-1 work is therefore **projection/resource evidence, durable identity reconciliation, measured spatial enrichment/federation expansion, and handoff**—not rebuilding the cursor, map-control or million-record comparison foundations.

## PI-1 — Reusable federation and search evidence

### 1. Capture reusable projection/resource evidence

- Add reusable projection elapsed-time and documents/second evidence.
- Record accepted/rejected/skipped/indexed counts with each large projection.
- Capture host/container/JVM CPU and memory context with heavy runs.
- Keep resource/progress evidence tied to corpus and projection identity so PI-2 compares topology rather than undocumented machines.
- Add configurable per-source request concurrency and explicit rate-limit policy where publisher behavior requires it.

### 2. Define durable identity reconciliation

- Define DOI/PMID/other durable-identifier reconciliation rules.
- Never silently merge by title.
- Distinguish source-record identity, intellectual-work identity, versions/relationships and duplicate projection entries.
- Review UUID/source-identifier route stability so future PubMed/OpenAlex/NASA relationships can resolve without changing existing local IDs casually.

### 3. Extend research spatial coverage and thematic Maps deliberately

The delivered Maps taxonomy remains stable:

```text
Geography & Boundaries
  TIGER/Line

Community & Economy
  LODES workplace / commuting
  SAIPE
  future population / business / housing measures

Environment & Hazards
  USGS hydrography / earthquakes
  future 3DEP terrain

Research Coverage
  repository research by area
  future Data.gov spatial datasets
  future NASA collection / bounded granule coverage
```

The next research-coverage milestone is evidence, not another speculative layer: run the corrected deterministic Data.gov spatial-availability probe by traversing the current Data.gov v4 `spatial_filter=geospatial` source subset and intersecting those records with the certified 500K retained C2 Data.gov identifiers. Capture that measured artifact and use it to decide the enrichment scope before adding a versioned, engine-neutral spatial sidecar. The source snapshot is current evidence bound to C2 identity; it is not represented as byte-for-byte historical C2 metadata. The sidecar may hold authoritative administrative areas, points, bounding boxes and later polygons while preserving source evidence and derivation method. Publisher, laboratory, author or institution location is never silently substituted for research coverage.

Treat retained Data.gov `harvestRecordRaw` as a source-reference URL, not retained raw metadata. Use current v4 `dcat.spatial`, `spatial_shape` and `spatial_centroid` signals for candidate discovery, and use raw/transformed source endpoints only for bounded follow-up validation of selected candidates. The enrichment remains sidecar/versioned so the C2 Gold Master and its projection identity are not rewritten merely to make records mappable.

Before adding many more thematic choropleths, generalize the existing shared-geometry/value pattern so new services return values keyed by stable identifiers rather than embedding their own polygons. Extend authoritative administrative geometry only when a concrete state/territory, PUMA, tract or place use case requires it.

The strongest next thematic additions remain:

1. **Population Estimates** — county population, change and growth.
2. **County Business Patterns** — county employment/establishments/payroll with measure and industry parameters inside one conceptual layer.
3. **Business Dynamics Statistics** — job creation/destruction and establishment births/deaths after the county-value contract is proven.
4. **Building Permits** — county totals first; place-level symbols only after authoritative place geometry/coordinates exist.
5. **Economic Census** — county/industry measures after the economic-layer configuration model has evidence.
6. **ACS PUMS-derived measures** — weighted PUMA/state aggregates only; never person/household points.
7. **3DEP terrain** — one configurable terrain/reference child rather than checkbox proliferation for hillshade/slope/aspect modes.

The current Repository research-by-area layer can continue using its bounded search geography facet. Rich explicit spatial footprints require dedicated bounded summary/feature APIs with viewport/time/result caps and explicit truncation semantics before the browser renders them. Million-record search results must never become million MapLibre features.

NASA CMR remains the strongest federated spatial source. Extend the existing collection adapter with an explicit/pinned spatial metadata representation, then model bounded granule coverage separately so collection and granule semantics never collapse into one type.

Every new research-coverage child must preserve semantic list/table equivalence, keyboard operation, provenance, and the existing automated/manual accessibility evidence split.

### 4. Extend the federation portfolio deliberately

The evidence-first source order remains:

1. NASA Earthdata CMR — build on the existing collection harvester, then add controlled granule semantics and spatial/temporal coverage;
2. PubMed — bibliographic/abstract relevance scale after DOI/PMID reconciliation rules exist;
3. OpenAlex — broad scholarly/citation coverage after the federal-source story is stable.

For NASA CMR, reconcile planning language with the collection harvester/tests already in the repository, add committed canonical collection fixtures/evidence where needed, then prove bounded 10K/100K granule slices before any larger corpus.

For PubMed, prefer a reproducible bounded fixture/API path first and evaluate baseline/update files before millions of individual requests. OpenAlex follows only after the federal-source and durable-identity stories remain stable.

PubMed/OpenAlex affiliation or institution geography, if later useful, is a separately named relationship/location analytic dimension. It is not research coverage unless the underlying source explicitly states research geography.

Another million-record run is justified only when it answers a new source, semantic, spatial or topology question—not merely to repeat C2 with a larger number.

### PI-1 exit condition

PI-1 is ready to hand off when:

- large-projection resource/progress evidence is captured consistently and tied to corpus/projection identity;
- durable identifier reconciliation rules are explicit;
- planned source adapters have reproducible bounded harvest paths and fixture coverage;
- stable corpus/query definitions remain versioned for PI-2;
- semantic Solr/OpenSearch evidence remains reproducible when topology becomes the experimental variable.

The broader map-product expansion can continue after PI-1; it does not have to block Kubernetes handoff once the shared spatial/search contracts required for reproducibility are stable.

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

## PI-4 — Manual Accessibility Evidence

The federal Section 508 baseline and the project's engineering target remain separate. The project continues to track Section 508-oriented evidence while advancing the engineering target to WCAG 2.2 A/AA.

Remaining dated, commit-bound manual evidence includes:

- keyboard-only end-to-end review;
- NVDA in Firefox and Chrome;
- JAWS, or explicit N/A with licensing reason;
- map-equivalence/focus-path review;
- cognitive/workflow review;
- Search Lab keyboard-only flow;
- review of the MapLibre canvas tab stop with a screen reader;
- current ICT Testing Baseline / Trusted Tester crosswalk;
- explicit WCAG 2.2 checks for focus not obscured, dragging alternatives and target size.

Automated axe/browser evidence never substitutes for these checks.

## PI-5 — Browser evidence governance

The dedicated Browser Evidence workflow exists and uploads failure evidence. Remaining governance work:

- decide which WCAG/Section 508-oriented jobs are required merge checks;
- decide whether `main` receives branch protection;
- preserve the prior known-good evidence baseline when a refresh fails.

## PI-6 — Solr/OpenSearch comparison hardening

After PI-1 handoff, consider richer scenarios:

- phrase search and highlighting;
- geo using the authoritative spatial-coverage model;
- autocomplete/suggest;
- synonyms;
- nested/object fields;
- vector/hybrid search.

These remain downstream of the reproducible lexical baseline.

## Cross-cutting product and provenance work

- Record source freshness per research object where reliable publisher dates exist.
- Expose projection/index timestamps consistently across Admin, Evidence, Discovery and Search Lab.
- Distinguish stored sample, stale and unavailable data where those states apply.
- Add regression coverage for LODES fallback provenance.
- Replace remaining dataset-shaped copy where the object may be a publication, report, software item, methodology, project or granule.
- Improve presentation of opaque publisher program values such as Data.gov codes without replacing raw metadata with a fixed UI allowlist.
- Clarify projection-level authority terminology where compatibility `REPOSITORY` is too coarse for mixed DSpace + federated search state.
- Move NgRx dependencies from release candidates to stable versions after validation.

## Non-goals

The roadmap does not include replacing DSpace with a search engine, forcing federated records into DSpace, making search indexes authoritative, deleting Compose after Kubernetes, downloading millions of binaries merely to inflate record count, running million-record work in ordinary PR CI, adding a separate Node harvester runtime, inferring research geography from publisher location, rendering raw microdata people/households as map points, or claiming complete Section 508 conformance from automated scans.
