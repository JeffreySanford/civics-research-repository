# Civics Research Repository

Civics Research Repository is an independent reference implementation of a federal Open Science repository and discovery platform. It uses DSpace as the repository system of record, an application-owned discovery index for public search, and an accessible Angular/MapLibre experience to connect datasets, publications, methodology, projects, provenance, access restrictions, and geospatial analysis.

This project is not affiliated with, endorsed by, or sponsored by the U.S. Census Bureau, USGS, DSpace, or Apache Solr.

## What the platform demonstrates

### Discover connected research

Search and facet across repository-backed research objects rather than a hand-coded dataset list. Results include datasets, publications, methodology, projects, access statements, authors, DOI metadata, citations, and typed relationships. DSpace remains authoritative; the public discovery index is a rebuildable projection.

### Move from discovery to an actionable research view

A workforce-oriented journey connects search context to the map workspace. TIGER/Line geography, LODES workplace employment, LODES commuting flows, SAIPE context, and optional USGS reference layers can be explored without losing the equivalent table/list representation required for keyboard and assistive-technology users.

### Reconcile public metadata with repository identity

Spring Boot owns catalog-backed metadata adapters, dry-run/diff/apply orchestration, DSpace writes, repository identity, and reindexing. Startup, admin UI, and command-line sync use the same path. Fixture content exists only as a clearly labelled recovery mode.

### Produce reviewable accessibility evidence

Accessibility is treated as an engineering artifact: Angular template linting, component-state axe tests, browser axe scans, keyboard preconditions, reflow, zoom, contrast, forced-colors, dark-mode, and map-equivalence checks feed a generated evidence manifest. Manual keyboard, NVDA, JAWS, map-equivalence, and cognitive reviews remain explicit rather than being implied by automation.

## Current status

The authoritative current snapshot is generated at [documentation/platform-status.md](documentation/platform-status.md). It derives volatile counts from the repository catalog, source inventory, mirror manifest, adapter registry, and accessibility evidence record.

Use:

```bash
pnpm run docs:status
pnpm run docs:check
```

The current platform includes a repository-backed vertical slice, broad catalog coverage, a worked Open Science research package, bounded bitstream mirroring, public discovery and relevance, geospatial research views, synchronization workflows, and automated accessibility evidence. Remaining work is concentrated in manual assistive-technology evidence, infrastructure-as-code, full browser-evidence CI, governance, and a few product-language/provenance seams.

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
        |             |               |
        v             v               v
Application      DiscoveryIndex      DSpace REST
PostgreSQL       (Solr today)        system of record
sync state       rebuildable         metadata, relations,
                                  versions, files, bitstreams
                                      |        |
                                      v        v
                               DSpace Postgres DSpace Solr
```

The two PostgreSQL instances and two Solr instances have different owners and lifecycles. DSpace controls its internal database and Solr cores. The application controls operational sync state and the disposable public discovery projection. See [documentation/architecture.md](documentation/architecture.md) and [documentation/architecture-diagrams.md](documentation/architecture-diagrams.md).

## Stack

- Angular 22, Angular Material, NgRx, RxJS, and MapLibre GL.
- Nx 23 for workspace orchestration.
- Java 21 and Spring Boot for the typed API and synchronization workflows.
- OpenAPI-generated TypeScript and Java DTOs.
- DSpace 9 as repository system of record.
- Apache Solr behind the application-owned `DiscoveryIndex` boundary.
- Separate PostgreSQL databases for application operations and DSpace.
- Docker Compose for the complete local platform.
- Playwright, axe-core, Vitest/jsdom, and manual evidence checklists.

## Quick start

Requirements: Docker Desktop, Node 22, and pnpm 10.

```bash
cp .env.sample .env
pnpm install
pnpm run start:all
```

`start:all` starts the DSpace profile and application stack, waits for health checks, generates and seeds SAF packages when needed, runs synchronization, rebuilds the public discovery projection, and prints the service URLs.

Primary endpoints:

| Service | URL |
| --- | --- |
| Discovery UI | `http://localhost:4200` |
| Repository API | `http://localhost:8080/api` |
| DSpace REST | `http://localhost:8081/server/api` |
| Discovery Solr | `http://localhost:8983/solr` |
| DSpace Solr | `http://localhost:8984/solr` |

Stop the full stack without deleting volumes:

```bash
pnpm run demo:down
```

## Useful commands

```bash
pnpm run start:all             # complete local platform
pnpm run sync:diff             # compare adapter metadata with DSpace
pnpm run sync:apply            # apply owned metadata changes
pnpm run reindex               # rebuild the public discovery projection
pnpm run catalog:harvest       # verify/probe catalog vintages and sources
pnpm run sources:inventory     # refresh measured source-file inventory
pnpm run dspace:mirror         # refresh bounded source-file mirroring
pnpm run evidence:refresh      # run and record automated accessibility evidence
pnpm run docs:status           # regenerate current platform status
pnpm run quality:all           # repository quality gate
```

## Documentation

- [Current platform status](documentation/platform-status.md)
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
