# Platform Evolution

This document preserves the delivered story that should no longer be mixed into the active roadmap or backlog.

## Baseline workspace

The repository began as an Nx/Angular/OpenAPI demonstration with accessibility and Docker requirements defined before the full backend existed.

Delivered foundations included:

- Angular 22, NgRx and RxJS;
- Nx workspace orchestration;
- Java 21 / Spring Boot;
- OpenAPI-generated TypeScript and Java DTOs;
- Playwright, axe-core and component accessibility testing;
- Docker Compose service definitions.

## Repository-backed vertical slice

The first North Dakota TIGER/Line slice established architectural rules that remain in place:

- DSpace is the curated repository system of record;
- the browser calls only the Java application API;
- public search is a rebuildable derived projection;
- application operational state is separate from DSpace persistence;
- fixture data is explicitly labelled;
- synchronization supports dry-run, diff and idempotent apply.

## Open Science product expansion

The platform expanded beyond a dataset shelf to include datasets, publications, methodology, projects, authors, DOI metadata, access levels, citations, relationships, multiple DSpace collections and type-aware research detail.

Discovery evolved to include:

- repository-backed facets;
- URL-backed search/paging state;
- type/year/publisher/source-system filtering;
- eDisMax relevance and phrase boosts;
- searchable authors/subjects/citations/DOIs;
- explicit provenance;
- research-object routing;
- paths from search into geospatial research views.

## Accessibility and Maps foundation

Accessibility evolved from route-level scans into layered engineering evidence:

- Angular/template prevention rules;
- component-state axe scans;
- Storybook interaction + accessibility evidence;
- Chromium/Firefox/WebKit browser evidence;
- keyboard preconditions;
- reflow, zoom, contrast, forced-colors and dark-mode checks;
- map-equivalence tests;
- generated evidence records/drift checks;
- explicit manual keyboard/NVDA/JAWS/map/cognitive checklists.

Maps evolved from a visual overlay into an accessible research workspace using authoritative/shared geography, LODES, SAIPE, USGS reference layers and Research Coverage. Visual state and semantic table/list state remain aligned rather than treating the canvas as the only representation.

Manual assistive-technology evidence remains intentionally separate from automated evidence.

## Federated metadata foundation — PR #3

PR #3 expanded the authority model without weakening the original repository rules:

- DSpace remains authoritative for curated repository objects;
- external publishers remain authoritative for federated source records/resources;
- application PostgreSQL stores reproducible federated metadata and harvest evidence;
- Solr and OpenSearch remain derived search projections.

The foundation delivered:

- controlled `origin` and `sourceSystem` provenance;
- data-driven publisher/program facets;
- namespaced federated identity;
- bounded JDBC persistence;
- durable harvest runs/checkpoints/quarantine/retry handling;
- deterministic bounded snapshots;
- combined curated + federated discovery;
- bounded streaming deterministic projection;
- snapshot-to-projection linkage/drift rejection;
- canonical `/research/:id` routing;
- authoritative external-resource messaging;
- mixed-origin browser/accessibility coverage.

The first live Data.gov proof reached 1K and then 10K through the same resumable run before the scale work progressed to larger tiers.

## Exact federated C2 million-record milestone — PR #9

PR #9 established the first deterministic million-record composite:

- **500,000 Data.gov**;
- **500,000 DOE OSTI**;
- **1,000,000 federated records** retained in application PostgreSQL;
- **181 curated DSpace objects** added during normalized search projection;
- **1,000,181** Solr documents;
- **1,000,181** OpenSearch documents.

Identities:

- composition SHA-256 `e2c7cceb641589715a6390cb35846a67d7361fb15ec00fe3445a3e0036a5524b`;
- projection ID `3d461a9feb49f7239f3f6aaacb0c90f1ff43d0c683238acc2202c841154db44d`.

The milestone also delivered exact source-quota enforcement, deterministic composite evidence, a verified Gold Master archive/restore path, local storage evidence and the first paired million-document search comparison.

## Restart-safe identity — PR #10

PR #10 closed the lifecycle defect discovered during the scale run: ordinary API restarts no longer replace a valid persisted large projection with the curated demo.

Startup now rehydrates the persisted active profile/projection after verifying live search-target counts and leaves indexes untouched when evidence is valid.

`FEDERATED_1M` also became an API invariant: an arbitrary one million rows is not equivalent to the exact 500K Data.gov + 500K DOE OSTI recipe.

Admin and Discovery made the active corpus/projection identity visible to users/operators.

## Semantic comparison and deep traversal — PRs #12-#19

The large-corpus search work then moved beyond simple document-count parity:

- named 1M scale certification;
- stable/versioned semantic query matrix;
- exact identifier probes;
- structured publisher/source-system filters;
- result/top-N/rank/facet comparison evidence;
- engine execution-order evidence;
- opaque cursor/search-after deep discovery;
- complete 1,000,181-result traversal validation with no gaps or duplicates.

This converted the 1M corpus from a scale demonstration into a reusable search-research control surface.

## Scientific C2 performance evidence — PRs #36-#44

The next horizontal slice systematically strengthened the Solr/OpenSearch comparison.

### PR #36 — paired samples and bootstrap confidence

Delivered raw paired observations and bootstrap confidence evidence instead of relying only on aggregate percentiles.

### PR #37 — independent batches and randomized order

Added separately warmed independent batches and fixed/alternating/seeded-randomized engine-order strategies so simple first-engine/cache effects could be evaluated rather than assumed away.

### PR #39 — concurrency matrix

Added paired application-topology checkpoints for **1 / 8 / 32 clients**, retaining throughput and per-engine latency rather than reducing concurrency to a single winner number.

### PR #40 — resource telemetry

Added CPU, memory, JVM/GC and container-resource evidence with counter/gauge distinction and reset detection.

### PRs #41/#42 — automated statistical synthesis

Added statistical report generation over retained benchmark artifacts, including paired effects, confidence evidence, win rates and interpretation guardrails.

### PR #44 — complete C2 orchestration

Unified the C2 research path so the certified million-record corpus, quality gates, workload evidence, concurrency, telemetry and statistical synthesis could be produced coherently rather than as disconnected scripts.

The final certified research run used:

- exact `FEDERATED_1M` projection parity;
- workload classes: full text, facets, broad filter and program filter;
- both engine-first orders for workload evidence;
- seeded randomized independent batches (`20260903`);
- 6 separately warmed batches × 20 measured runs for standalone batch inference;
- concurrency 1 / 8 / 32;
- resource telemetry;
- explicit scientific claim boundaries.

For every workload class, Solr retained lower API p50/p95 in both engine-first orders in this local certified configuration. The separately warmed full-text batch experiment produced a median OpenSearch-minus-Solr API difference of 4 ms with bootstrap 95% CI 3..4 ms and 100% Solr win rate.

The result remained deliberately scoped to the documented corpus, mappings, workloads, versions and local/container topology.

## Certified Evidence UI — PR #45

PR #45 productized the scientific evidence rather than leaving it as artifact files.

The data path is:

```text
research artifacts
        ↓
Spring repository API evidence DTO
        ↓
OpenAPI
        ↓
generated TypeScript client
        ↓
NgRx
        ↓
Angular Evidence / Search comparison UI
```

Angular does not read raw benchmark JSON and does not bind directly to Solr/OpenSearch.

The Evidence UI now presents:

- certified corpus/projection identity;
- order robustness;
- separately warmed batch inference;
- paired workload latency;
- concurrency 1/8/32;
- resource/telemetry integrity;
- execution controls;
- scientific claim boundary.

Cross-browser Browser Evidence passed Chromium, Firefox and WebKit after a real focus/scroll regression was fixed rather than weakening the assertion.

## Certified standalone C2 closeout — September 3, 2026

After PR #45, the standalone Compose C2 baseline is considered a **closed control milestone**, not an unfinished feature area.

Delivered control baseline:

```text
DSpace curated authority                     181
Application PostgreSQL federated retention   1,000,000
Solr projection                              1,000,181
OpenSearch projection                        1,000,181
```

Plus:

- deterministic identity and Gold Master recovery;
- restart safety;
- deep traversal;
- semantic parity/difference evidence;
- randomized paired measurements;
- independent batches/bootstrap evidence;
- workload and concurrency matrices;
- resource telemetry;
- automated statistical reporting;
- accessible Evidence UI.

Future research must retain separate identities rather than rewriting this evidence.

## Post-C2 program

The next work is intentionally framed as new questions:

1. **#47 C2.1 adversarial validation** — attempt to falsify the current Solr-favoring observation under stronger version/resource/query/selectivity/restart controls. The protocol is preregistered before new timing collection.
2. **#48 PI-2 Kubernetes** — keep corpus/query semantics fixed while topology becomes the independent variable.
3. **#49 manual accessibility evidence** — execute/record keyboard and screen-reader verification that automated evidence cannot prove.
4. **#51 final frontend mission alignment** — present the mature platform first as a government-grade Angular data-discovery/accessibility frontend, with the full-stack/search research as supporting technical depth.

## Documentation realignment history

- **August 20, 2026:** README/architecture/demo/accessibility/planning were aligned around the mature repository product model and generated platform-status/drift checks were introduced.
- **August 30, 2026:** planning was aligned after the federated metadata foundation and live resumable Data.gov 10K proof.
- **September 1, 2026:** planning moved from “reach the first million” to reusable scale/search evidence after PRs #9/#10.
- **September 3, 2026:** planning moved from “finish C2 instrumentation” to a closed certified standalone baseline plus separately versioned adversarial, clustered, manual-accessibility and frontend-polish follow-up work.
