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

The exact C2 composition and normalized search projection have separate deterministic identities. Solr/OpenSearch parity is proven at 1M-class scale, the retained corpus has a verified Gold Master archive, active projection identity survives ordinary API restarts without reindexing, and `quality:scale` now certifies the live C2 contract from one command.

PRs #13 and #14 also delivered a versioned semantic matrix with result overlap, rank movement, facet differences, exact identifier probes, execution-order evidence, latency distributions and the structured comparison filters required by that matrix.

The remaining PI-1 work is therefore runtime hardening, resource evidence, spatial/federation expansion and handoff—not rebuilding the already-proven 1M comparison baseline.

## PI-1 — Reusable federation and search evidence

### 1. Finish deep-discovery runtime hardening

- Add opaque cursor/search-after pagination while retaining the current offset contract during migration.
- Bind continuation tokens to query/filter/sort/projection identity and reject stale or tampered cursors safely.
- Prove deterministic no-duplicate/no-gap traversal against the active C2 projection for both engines.
- Verify keyboard paging, result announcements, focus restoration, reflow and forced-colors behavior with large result counts.

### 2. Capture reusable projection/resource evidence

- Add reusable projection elapsed-time and documents/second evidence.
- Record accepted/rejected/skipped/indexed counts with each large projection.
- Capture host/container/JVM CPU and memory context with heavy runs.
- Keep resource/progress evidence tied to corpus and projection identity so PI-2 can compare topology rather than undocumented machines.

### 3. Define durable identity reconciliation

- Define DOI/PMID/other durable-identifier reconciliation rules.
- Never silently merge by title.
- Distinguish source record identity, intellectual-work identity, versions/relationships and duplicate projection entries.

### 4. Make Maps scale with the research model

The Maps workspace should be organized by the reader's analytic purpose rather than by publisher:

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
  Data.gov spatial datasets
  NASA collection / bounded granule coverage
```

Categories are presentation only. Every child remains independently checkable/renderable, collapsing a category never changes its active children, and an empty future category should not be displayed until it has a backed capability.

Before adding several new choropleths, establish reusable authoritative administrative geometry with stable state/county/PUMA/tract identifiers. Migrate SAIPE away from generated rectangular county cells, then make thematic services return values keyed to the shared geometry rather than constructing their own polygons.

That common boundary unlocks the strongest already-cataloged map additions in this order:

1. **Repository research by area** — aggregate explicit curated geography metadata; no new publisher crawl required.
2. **Population Estimates** — county population, change and growth.
3. **County Business Patterns** — county employment/establishments/payroll with measure and industry parameters inside one conceptual layer.
4. **Business Dynamics Statistics** — job creation/destruction and establishment births/deaths after the county-value contract is proven.
5. **Building Permits** — county totals first; place-level symbols only after authoritative place geometry/coordinates exist.
6. **Economic Census** — county/industry measures after the economic layer configuration model has evidence.
7. **ACS PUMS-derived measures** — weighted PUMA/state aggregates only; never person/household points.
8. **3DEP terrain** — one configurable terrain/reference child rather than checkbox proliferation for hillshade/slope/aspect modes.

Research-object coverage remains a different semantic from thematic statistics. Introduce a typed spatial sidecar for authoritative administrative areas, points, bounding boxes and later polygons. It retains provenance and derivation method; publisher, laboratory, author or institution location is never silently substituted for research coverage.

The retained Data.gov records do not currently normalize DCAT `spatial`, although they retain raw-harvest references. First run a deterministic spatial-availability probe, then perform targeted explicit-spatial enrichment into the sidecar rather than mutating the certified C2 corpus merely to make it mappable.

NASA CMR remains the strongest federated spatial source. Extend the existing collection adapter with an explicit/pinned spatial metadata representation, then model bounded granule coverage separately so collection and granule semantics never collapse into one type.

Discovery-to-map integration should use bounded summary/feature APIs rather than sending unbounded search hits to MapLibre. Every meaningful mapped value remains available in semantic HTML through the same shared application state, and associated large research lists reuse cursor traversal from the deep-pagination workstream.

### 5. Extend the federation portfolio deliberately

The evidence-first source order remains:

1. NASA Earthdata CMR — build on the existing collection harvester, then add controlled granule semantics and spatial/temporal coverage;
2. PubMed — bibliographic/abstract relevance scale after DOI/PMID reconciliation rules exist;
3. OpenAlex — broad scholarly/citation coverage after the federal-source story is stable.

PubMed/OpenAlex affiliation or institution geography, if later useful, is a separately named relationship/location analytic dimension. It is not research coverage unless the underlying source explicitly states research geography.

Another million-record run is justified only when it answers a new source, semantic, spatial or topology question—not merely to repeat C2 with a larger number.

### PI-1 exit condition

PI-1 is ready to hand off when:

- deep discovery no longer depends on unbounded offsets;
- large-projection resource/progress evidence is captured consistently;
- identifier reconciliation rules are explicit;
- planned source adapters have reproducible bounded harvest paths;
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

## PI-4 — Manual accessibility evidence

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
- Review UUID/source-identifier route stability and relationship resolution.
- Replace remaining dataset-shaped copy where the object may be a publication, report, software item, methodology, project or granule.
- Move NgRx dependencies from release candidates to stable versions after validation.

## Non-goals

The roadmap does not include replacing DSpace with a search engine, forcing federated records into DSpace, making search indexes authoritative, deleting Compose after Kubernetes, downloading millions of binaries merely to inflate record count, running million-record work in ordinary PR CI, adding a separate Node harvester runtime, inferring research geography from publisher location, rendering raw microdata people/households as map points, or claiming complete Section 508 conformance from automated scans.
