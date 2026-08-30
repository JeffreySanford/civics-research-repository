# Civics Research Repository

Civics Research Repository is an independent reference implementation of a federal Open Science repository and discovery platform. It uses DSpace as the system of record for curated repository objects, an application-owned federated metadata catalog for reproducible external-source records, rebuildable Solr/OpenSearch discovery projections, and an accessible Angular/MapLibre experience to connect datasets, publications, methodology, projects, provenance, access restrictions, and geospatial analysis.

This project is not affiliated with, endorsed by, or sponsored by the U.S. Census Bureau, USGS, DSpace, Apache Solr, Data.gov, or OpenSearch.

## What the platform demonstrates

### Discover connected research across authority boundaries

Search and facet across curated repository-backed research objects and provenance-bearing federated metadata rather than a hand-coded dataset list. Results can include datasets, publications, methodology, projects, access statements, authors, DOI metadata, citations, typed relationships, publishers, source systems and data-driven program values.

Authority remains explicit:

- DSpace is authoritative for curated repository objects,
- external publishers remain authoritative for federated records and their downloadable resources,
- application PostgreSQL retains reproducible federated metadata, harvest checkpoints and evidence,
- Solr and OpenSearch remain derived discovery state.

### Move from discovery to an actionable research view

A workforce-oriented journey connects search context to the map workspace. TIGER/Line geography, LODES workplace employment, LODES commuting flows, SAIPE context, and optional USGS reference layers can be explored without losing the equivalent table/list representation required for keyboard and assistive-technology users.

### Reconcile public metadata with repository and federated identity

Spring Boot owns catalog-backed metadata adapters, federated source harvesters, durable checkpoints/quarantine, dry-run/diff/apply orchestration, DSpace writes, federated metadata persistence, research-object identity, and discovery projection. Startup, admin UI, command-line sync and federated admin endpoints use the same Java runtime boundaries. Fixture content exists only as a clearly labelled recovery mode.

Canonical `/research/:id` detail routing resolves either curated repository content or federated metadata while `/datasets/:id` remains a compatibility route. Federated detail links back to the authoritative publisher and does not imply that external files are preserved locally.

### Produce deterministic scale evidence

PI-1 adds staged 1K/10K/100K/1M metadata checkpoints rather than jumping directly to an unbounded harvest. Bounded snapshots, projection identities and guarded snapshot -> projection relationships make scale claims reproducible before performance is interpreted.

The current Data.gov path has:

- a complete 1K live snapshot/projection/search proof,
- a 10K resumable harvest proof using the same durable run and cursor,
- 10K snapshot/projection/storage/resource evidence still in progress before 100K begins.

See [planning/PI1_DATA_GOV_SCALE_EVIDENCE.md](planning/PI1_DATA_GOV_SCALE_EVIDENCE.md).

### Produce reviewable accessibility evidence

Accessibility is treated as an engineering artifact: Angular template linting, component-state axe tests, browser axe scans, keyboard preconditions, reflow, zoom, contrast, forced-colors, dark-mode, and map-equivalence checks feed a generated evidence manifest. Manual keyboard, NVDA, JAWS, map-equivalence, and cognitive reviews remain explicit rather than being implied by automation.

## Current status

The generated repository/platform baseline is [documentation/platform-status.md](documentation/platform-status.md). It derives volatile curated-catalog, source-inventory, mirror, adapter-registry and accessibility facts from committed artifacts. Live federated scale facts are recorded separately in [planning/PI1_DATA_GOV_SCALE_EVIDENCE.md](planning/PI1_DATA_GOV_SCALE_EVIDENCE.md) so runtime evidence is not hand-edited into the generated status file.

Use:

```bash
pnpm run docs:status
pnpm run docs:check
```

The current platform includes a repository-backed Open Science slice, broad curated catalog coverage, a worked research package, bounded bitstream mirroring, mixed repository/federated discovery and detail routing, Data.gov resumable harvesting, deterministic snapshot/projection evidence, standalone Solr/OpenSearch projection, geospatial research views, synchronization workflows, and automated accessibility/browser evidence.

Active work is concentrated in completing the Data.gov 10K evidence checkpoint, then 100K, adding the remaining PI-1 source adapters and first controlled million-record corpus, cursor/search-after discovery hardening, manual assistive-technology evidence, Kubernetes/AWS follow-on work, and governance decisions.

## Architecture at a glance

```text
Public researcher / repository steward
                  |
                  v
Angular 22 + NgRx + MapLibre
search | research objects | maps | sync | evidence
                  |
                  | typed REST from OpenAPI
                  v
Java 21 / Spring Boot repository-api
       |                 |                    |
       |                 |                    v
       |                 |                DSpace REST
       |                 |                curated system
       |                 |                of record
       |                 |
       v                 v
Application         Discovery projection
PostgreSQL          bounded normalized stream
sync/federation       /             \
state + evidence    Solr          OpenSearch
       ^               \             /
       |                derived search
       |
Federated publishers
Data.gov / OSTI / CMR / PubMed / OpenAlex
metadata + authoritative external links
```

DSpace PostgreSQL/Solr and application PostgreSQL/public search indexes have different owners and lifecycles. DSpace controls its internal database, Solr cores, repository metadata, relations, versions and bitstreams. The application controls operational/federated state and disposable public discovery projections. See [documentation/architecture.md](documentation/architecture.md), [documentation/architecture-diagrams.md](documentation/architecture-diagrams.md), and [documentation/federation/README.md](documentation/federation/README.md).

## Stack

- Angular 22, Angular Material, NgRx, RxJS, and MapLibre GL.
- Nx 23 for workspace orchestration.
- Java 21 and Spring Boot for the typed API, repository synchronization and federated harvesting.
- OpenAPI-generated TypeScript and Java DTOs.
- DSpace 9 as the curated repository system of record.
- Application PostgreSQL for sync state, federated metadata, harvest checkpoints/quarantine and evidence history.
- Apache Solr as the normal public search engine behind the `DiscoveryIndex` boundary.
- OpenSearch as the aligned comparison projection target while PI-1/PI-2 collect evidence.
- Separate PostgreSQL/Solr ownership for application and DSpace runtimes.
- Docker Compose for the complete local platform and standalone scale baseline.
- Playwright, axe-core, Vitest/jsdom, browser evidence CI, and manual evidence checklists.

## Quick start

Requirements: Docker Desktop, Node 22, and pnpm 10.

```bash
cp .env.sample .env
pnpm install
pnpm run start:all
```

`start:all` starts the DSpace profile and application stack, waits for health checks, generates and seeds SAF packages when needed, rebuilds the public discovery projection, and prints the service URLs. Persistent application volumes preserve federated harvest/snapshot evidence across ordinary force-recreate/rebuild operations.

Primary endpoints:

| Service        | URL                                |
| -------------- | ---------------------------------- |
| Discovery UI   | `http://localhost:4200`            |
| Repository API | `http://localhost:8080/api`        |
| DSpace REST    | `http://localhost:8081/server/api` |
| Discovery Solr | `http://localhost:8983/solr`       |
| OpenSearch     | `http://localhost:9200`            |
| DSpace Solr    | `http://localhost:8984/solr`       |

Stop the full stack without deleting volumes:

```bash
pnpm run demo:down
```

## Useful commands

```bash
pnpm run start:all                       # complete local platform
pnpm run start:all:rebuild               # rebuild/recreate app stack while retaining volumes
pnpm run sync:diff                       # compare adapter metadata with DSpace
pnpm run sync:apply                      # apply owned metadata changes
pnpm run reindex                         # rebuild the public discovery projection
pnpm run federation:harvest:datagov:1k   # restart a bounded Data.gov 1K development proof
pnpm run catalog:harvest                 # verify/probe curated catalog vintages and sources
pnpm run sources:inventory               # refresh measured source-file inventory
pnpm run dspace:mirror                   # refresh bounded source-file mirroring
pnpm run evidence:refresh                # run and record automated accessibility evidence
pnpm run docs:status                     # regenerate current platform status
pnpm run quality:all                     # repository quality gate
```

For staged scale work, use the ordinary federation harvest endpoint to **resume** a durable run. The `federation:harvest:datagov:1k` convenience command intentionally uses restart semantics and is not the command for extending an existing scale checkpoint.

## Documentation

- [Current generated platform status](documentation/platform-status.md)
- [Federated metadata expansion](documentation/federation/README.md)
- [Data.gov scale evidence](planning/PI1_DATA_GOV_SCALE_EVIDENCE.md)
- [Program Increment plan](planning/PI_PLAN.md)
- [Architecture](documentation/architecture.md)
- [Architecture diagrams](documentation/architecture-diagrams.md)
- [Open Science research objects](documentation/open-science-research-objects.md)
- [Mapping and visualization](documentation/mapping-visualization.md)
- [Section 508 and WCAG evidence](documentation/accessibility-508-wcag.md)
- [Manual accessibility evidence](documentation/accessibility-manual-evidence.md)
- [Interview/demo package](documentation/demo/README.md)
- [AWS modernization](documentation/aws-modernization.md)
- [Future roadmap](planning/ROADMAP.md)
- [Active backlog](planning/TODO.md)
- [Platform evolution](documentation/history/platform-evolution.md)
