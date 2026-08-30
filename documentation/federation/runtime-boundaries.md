# PI-1 Runtime and Ownership Boundaries

## Purpose

This document records implementation boundaries that should remain stable while PI-1 expands the repository from the curated DSpace slice into a large federated Open Science catalog.

The goal is to prevent well-intentioned simplifications from collapsing ownership boundaries, adding a second ingestion runtime, or replacing deliberate Angular state-management choices without evidence.

## Decision 1 — Federated harvesting is Java/Spring only

All production-shaped PI-1 source ingestion runs inside the existing Spring Boot `repository-api` runtime.

```text
authoritative source
  -> Java source adapter
  -> FederatedHarvestService / shared Java harvest orchestration
  -> federated metadata catalog
  -> combined discovery catalog
  -> Solr + OpenSearch projection
```

### Rules

- Do not introduce a NestJS harvester service.
- Do not introduce a Node.js harvester service.
- Source adapters, checkpointing, retry/rate-limit behavior, normalization, quarantine/error handling and harvest-run state belong to the Java/Spring application boundary.
- The browser never owns harvesting.
- Node-based repository scripts may still be used for build, test, fixture generation, local orchestration and developer tooling. They are not the durable federated-ingestion runtime and must not own harvest state.
- The existing `FederatedHarvestService`, `FederatedSourceHarvester`, checkpoint store and metadata catalog are the baseline implementation to evolve.

### Spring Batch

Spring Batch is an optional implementation tool, not a PI-1 requirement.

Adopt it only if the existing shared harvest framework becomes materially harder to operate or test without capabilities such as durable job execution metadata, partitioning or more advanced restart semantics. Do not add Spring Batch merely because harvesting is batch-shaped.

The architectural requirement is **one Java/Spring ingestion runtime with reproducible bounded jobs**, not a specific scheduling library.

## Decision 2 — Keep DSpace-owned and application-owned persistence/search isolated

The local stack intentionally has separate infrastructure roles:

```text
Application PostgreSQL
  application/federation operational state

Application Solr
  public rebuildable discovery projection

OpenSearch
  parallel rebuildable comparison projection

DSpace PostgreSQL
  DSpace repository system of record

DSpace Solr
  DSpace-owned internal search/authority/OAI cores
```

This duplication is an ownership boundary, not accidental redundancy.

### Do not consolidate merely to reduce container count

Do not merge the application database into the DSpace database schema and do not make the application's public Solr projection share DSpace's internal Solr cores merely to save local RAM.

Reasons:

- DSpace owns its database migrations and schema lifecycle.
- DSpace owns its internal Solr configuration and upgrade lifecycle.
- Application search indexes are disposable/rebuildable derived state.
- The application federated catalog has different retention, indexing and performance concerns from the DSpace repository schema.
- Sharing infrastructure would increase upgrade coupling and make ownership failures harder to diagnose.

A future deployment may choose to share a physical managed PostgreSQL service while retaining isolated databases/users, but that is an infrastructure decision and must not collapse logical ownership.

## Local resource policy

The resource-allocation critique is valid even though datastore consolidation is not the preferred fix.

Use lifecycle and measurement instead:

- Keep the DSpace services behind the optional Compose `dspace` profile.
- Do not require DSpace containers to run for every UI/API/search-development task.
- Stop heavy optional services when a workflow does not require them.
- Record host/container/JVM memory and CPU context for 10K/100K/1M evidence.
- Establish resource budgets from measured use before increasing local corpus size or clustered topology.
- Prefer bounded JVM/container resource settings where they improve repeatability without hiding genuine scale failures.
- Treat workstation starvation as invalid benchmark evidence rather than an engine-performance result.

PI-1 may optimize container lifecycle, startup profiles and resource limits, but it should preserve the datastore ownership boundaries above.

## Decision 3 — Keep NgRx for shared application workflows; do not migrate to Signals as a simplification project

The critique that every piece of UI state should not automatically become global NgRx state is valid. The proposed replacement of the application architecture with Angular Signals is not adopted.

### NgRx remains appropriate for state that is shared, replayable or workflow-significant

Examples include:

- discovery query/filter/page state,
- URL/router-coupled state,
- map layer and selection state shared with accessible list/table representations,
- async loading/error state that spans components,
- admin synchronization/projection workflows,
- comparison state that must remain consistent across multiple semantic result regions.

These flows benefit from explicit actions/effects/selectors, deterministic testing and observable state transitions.

### Local transient state should remain local

Purely component-local presentation state does not need a store action/reducer/selector cycle.

Use the smallest appropriate existing mechanism, including:

- local component fields,
- Angular reactive forms,
- RxJS streams/operators,
- service-level Observables where state is shared narrowly.

Do not move transient state into NgRx merely for architectural uniformity.

### Signals policy

Do not migrate the project to Angular Signals or NgRx Signal Store solely to reduce boilerplate or line count.

The current project standard remains RxJS/Observables plus NgRx where shared workflow state warrants it. A future state-management change requires a measured problem and explicit architecture decision rather than framework fashion.

## Decision 4 — Separate canonical discovery taxonomy from legacy curated classification

The curated repository already uses `ResearchProgram` as a controlled Census-era classification. That enum should not become the registry for every external publisher program encountered during federation.

PI-1 therefore uses two distinct concepts during migration:

```text
ResearchProgram
  legacy/curated compatibility classification
  finite enum

DiscoveryDocument.programName
  canonical discovery taxonomy value
  data-driven publisher/source program name
```

Rules:

- Do not add a new `ResearchProgram` constant merely because a federated source returns a new program label.
- Federated records may use `ResearchProgram.OTHER` for compatibility while preserving their real `programName`.
- The public search/filter contract should migrate toward the data-driven value rather than exposing an ever-growing enum.
- Solr and OpenSearch projection changes must consume the canonical value before large-source faceting is declared complete.
- Existing Census UI/search behavior must remain compatible during the migration.

This is a staged compatibility transition, not a permanent requirement to carry duplicate taxonomy forever.

## Relationship to current PI numbering

Some older reviews describe historical phases such as "local repository platform", "public data harvester" and "Angular discovery UI" as PI-1/PI-2/PI-3. Those labels do not match the current six-increment plan.

The current sequence is:

```text
PI-1 Federated Metadata Expansion
PI-2 Local Kubernetes Search Laboratory
PI-3 AWS Implementation Candidate
PI-4 Manual Accessibility Evidence
PI-5 Browser Evidence CI and Governance
PI-6 Solr/OpenSearch Comparison Hardening
```

Historical phase critiques should be evaluated for their architectural substance without renumbering the current program increments.

## Planning implications

PI-1 planning should therefore assume:

1. one Java/Spring harvesting runtime,
2. no NestJS/Node production harvester,
3. isolated DSpace and application datastore/search ownership,
4. local resource pressure addressed through profiles, limits and measurement rather than schema/core consolidation,
5. NgRx retained for shared workflow state,
6. transient UI state kept out of NgRx when a local RxJS/form/component solution is sufficient,
7. no Signals migration as part of PI-1,
8. data-driven discovery taxonomy kept separate from legacy curated enum classification until the public contract migration is complete.
