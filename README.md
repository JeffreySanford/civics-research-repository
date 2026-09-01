# Civics Research Repository

Civics Research Repository is an independent reference implementation of a federal Open Science repository and discovery platform. It uses DSpace as the system of record for curated repository objects, an application-owned federated metadata catalog for reproducible external-source records, rebuildable Solr/OpenSearch discovery projections, and an accessible Angular/MapLibre experience to connect datasets, publications, methodology, projects, provenance, access restrictions, and geospatial analysis.

This project is not affiliated with, endorsed by, or sponsored by the U.S. Census Bureau, USGS, DSpace, Apache Solr, Data.gov, DOE OSTI, or OpenSearch.

## What the platform demonstrates

### Discover connected research across authority boundaries

Search and facet across curated repository-backed research objects and provenance-bearing federated metadata rather than a hand-coded dataset list. Results can include datasets, publications, methodology, projects, access statements, authors, DOI metadata, citations, typed relationships, publishers, source systems and data-driven program values.

Authority remains explicit:

- DSpace is authoritative for curated repository objects;
- external publishers are authoritative for federated records and downloadable resources;
- application PostgreSQL retains reproducible federated metadata, harvest checkpoints and evidence;
- Solr and OpenSearch are derived discovery projections.

Canonical `/research/:id` detail routing resolves either curated repository content or federated metadata while `/datasets/:id` remains a compatibility route. Federated detail links back to the authoritative publisher and does not imply that external files are preserved locally.

### Move from discovery to an actionable research view

A workforce-oriented journey connects search context to the map workspace. TIGER/Line geography, LODES workplace employment, LODES commuting flows, SAIPE context, and optional USGS reference layers can be explored without losing the equivalent table/list representation required for keyboard and assistive-technology users.

### Produce deterministic scale evidence

PI-1 now includes a completed exact million-record federated research checkpoint rather than only the earlier 1K/10K stepping stones.

The current C2 Gold Master is:

- **500,000 Data.gov + 500,000 DOE OSTI** retained federated records;
- **1,000,000** federated records in application PostgreSQL;
- **181** curated DSpace research objects;
- **1,000,181** normalized search documents in both Solr and OpenSearch;
- composition SHA `e2c7cceb641589715a6390cb35846a67d7361fb15ec00fe3445a3e0036a5524b`;
- projection ID `3d461a9feb49f7239f3f6aaacb0c90f1ff43d0c683238acc2202c841154db44d`.

The corpus composition identity is kept separate from the full search projection identity. DSpace records are excluded from the federated composition digest and included in the normalized search projection.

The exact C2 retained corpus is also captured as a verified host-backed Gold Master archive, so the million-record state can be restored without repeating the full external harvest.

See [Federated Scale Evidence](documentation/federation/scale-evidence.md) for the measured storage, benchmark, archive, exact-activation and restart-safety record.

### Keep search identity durable across restarts

Ordinary `repository-api` restarts no longer reset a persisted large projection to the curated demo. Startup verifies the live Solr/OpenSearch counts against the durable activation record and rehydrates the active profile, projection ID and object count without rewriting the indexes.

For `FEDERATED_1M`, activation is also an API invariant: one million arbitrary rows is not sufficient. The server requires the exact 500K Data.gov + 500K DOE OSTI composite recipe.

The Admin data-flow view exposes **Authority → Retention → Projection**, and public Discovery surfaces the active corpus profile, projected document count and C2 identity so the user can see what corpus a search is actually running against.

### Produce reviewable accessibility evidence

Accessibility is treated as an engineering artifact: Angular template linting, component-state axe tests, browser axe scans, keyboard preconditions, reflow, zoom, contrast, forced-colors, dark-mode, and map-equivalence checks feed generated evidence. Manual keyboard, NVDA, JAWS, map-equivalence and cognitive reviews remain explicit rather than being implied by automation.

## Current status

The generated repository/platform baseline is [documentation/platform-status.md](documentation/platform-status.md). It derives volatile curated-catalog, source-inventory, mirror, adapter-registry and accessibility facts from committed artifacts.

Heavy live scale facts are recorded separately because a million-record local corpus and its storage measurements are intentionally not committed to Git. The durable milestone summary is [documentation/federation/scale-evidence.md](documentation/federation/scale-evidence.md).

Use:

```bash
pnpm run docs:status
pnpm run docs:check
```

The current platform includes a repository-backed Open Science slice, broad curated catalog coverage, bounded bitstream mirroring, mixed repository/federated discovery and detail routing, resumable Data.gov and DOE OSTI harvesting, deterministic composite/projection evidence, exact million-record Solr/OpenSearch parity, restart-safe active projection identity, geospatial research views, synchronization workflows, and automated accessibility/browser evidence.

Active PI-1 work is now concentrated on **reusable scale validation and semantic search evidence**, not proving the first million again: a named live scale checker, stable large-corpus query definitions, result/rank/facet difference evidence, projection throughput/resource context, cursor/search-after pagination, cross-source identifier rules, and staged additional federation sources. Kubernetes/AWS remain follow-on topology work rather than prerequisites for the Compose control baseline.

## Architecture at a glance

```text
Public researcher / repository steward
                  |
                  v
Angular 22 + NgRx + MapLibre
search | research objects | maps | admin | evidence
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
federated metadata    /             \
+ evidence          Solr          OpenSearch
       ^               \             /
       |                derived search
       |
Federated publishers
Data.gov / DOE OSTI / later CMR / PubMed / OpenAlex
metadata + authoritative external links
```

DSpace PostgreSQL/Solr and application PostgreSQL/public search indexes have different owners and lifecycles. DSpace controls its internal database, Solr cores, repository metadata, relations, versions and bitstreams. The application controls operational/federated state and disposable public discovery projections.

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

`start:all` starts the DSpace profile and application stack, waits for health checks, generates and seeds SAF packages when needed, and prints the service URLs. Persistent application volumes preserve federated harvest/snapshot/evidence state across ordinary recreate/rebuild operations.

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

Do not use the destructive `docker:reset:everything` command as an ordinary restart; it intentionally removes volumes.

## Useful commands

```bash
pnpm run start:all                 # complete local platform
pnpm run start:all:rebuild         # rebuild/recreate app stack while retaining volumes
pnpm run sync:diff                 # compare adapter metadata with DSpace
pnpm run sync:apply                # apply owned metadata changes
pnpm run reindex                   # rebuild the selected public discovery projection
pnpm run research:preflight        # non-mutating FEDERATED_1M/C2 readiness check
pnpm run research:report           # current FEDERATED_1M research report
pnpm run research:full             # C2 preflight + quality gate + 1M report
pnpm run federation:sample:all     # bounded source-adapter sample verification
pnpm run catalog:harvest           # verify/probe curated catalog vintages and sources
pnpm run sources:inventory         # refresh measured source-file inventory
pnpm run dspace:mirror             # refresh bounded source-file mirroring
pnpm run evidence:refresh          # run and record automated accessibility evidence
pnpm run docs:status               # regenerate current platform status
pnpm run quality:all               # deterministic ordinary repository quality gate
```

Heavy harvest/projection operations remain explicit. Ordinary PR CI does not create a 1M corpus.

## Documentation

- [Current generated platform status](documentation/platform-status.md)
- [Federated scale evidence](documentation/federation/scale-evidence.md)
- [Federated metadata expansion](documentation/federation/README.md)
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
