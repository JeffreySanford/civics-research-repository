# Civics Research Repository

Independent reference implementation for a federal open-science repository and discovery experience using public data resources.

This demo models research objects rather than treating search as a data warehouse. DSpace is the repository system of record for datasets, publications, metadata, versions, files, citations, and relationships. Solr provides discovery, full-text search, faceting, and relevance. Angular provides the accessible search, mapping, visualization, dataset detail, and workflow UI.

This project is not affiliated with, endorsed by, or sponsored by the U.S. Census Bureau, USGS, DSpace, or Apache Solr.

## Demo Concept

The target experience is a Census-style Open Science portal that supports:

- Search and faceted discovery across public research datasets.
- Dataset landing pages with metadata, files, versions, citations, and related research.
- Mapping data visualization for geospatial datasets.
- USGS overlays for contextual hazards, boundaries, and earth-science reference layers.
- Repository-backed ingestion of public Census datasets and related federal public data.
- Section 508 and WCAG evidence through automated and manual accessibility checks.
- Docker-based local development with PostgreSQL, DSpace, Solr, and application services.

## Stack

- Angular 22 with Angular Material for the public discovery and visualization UI.
- Nx 23 for workspace orchestration, generators, project graph, and affected-task execution.
- NgRx and RxJS for typed async frontend state and API workflows.
- MapLibre GL for accessible geospatial visualization.
- Java 21 and Spring Boot for the typed backend API, built with Gradle inside a container image.
- OpenAPI as the contract source of truth, with generated frontend types and a drift check.
- DSpace 9.0 for repository content, metadata, item/version/file management, and REST APIs.
- Apache Solr for discovery search, facets, and relevance.
- PostgreSQL for DSpace persistence and for application sync state, as two separate databases.
- Docker Compose for local development, with DSpace behind an optional profile.
- Playwright and axe-core for automated WCAG and Section 508 evidence, plus manual assistive-technology checklists.

Sync orchestration lives in the Java API rather than in a separate harvester service; a Node harvester was considered and rejected to keep repository writes next to the typed backend.

## Public Data Sources

Initial Census-oriented collections:

- American Community Survey Public Use Microdata Sample, especially ACS PUMS.
- Survey of Income and Program Participation.
- Current Population Survey public-use datasets.
- LEHD Origin-Destination Employment Statistics and LODES.
- TIGER/Line geospatial files.

USGS overlay candidates:

- USGS earthquakes feed and catalog.
- USGS National Map layers.
- USGS hydrography or elevation reference data where useful.

## Repository Structure

```text
civics-research-repository/
├── apps/
│   ├── discovery-ui/            Angular 22 discovery, map, admin, and evidence UI
│   ├── discovery-ui-e2e/        Playwright storyboard, WCAG, and Section 508 specs
│   └── repository-api/          Java 21 / Spring Boot API, sync orchestration, DSpace and Solr gateways
├── libs/
│   ├── data-sources/            census, usgs
│   ├── maps/                    usgs-overlays, visualization
│   ├── repository/              api-client (OpenAPI-generated types), models
│   └── shared/                  accessibility, material, ui
├── tools/
│   ├── dspace/                  DSpace seed structure, SAF package, and crr metadata schema
│   └── scripts/                 OpenAPI drift check, DSpace readiness/seed verification, web-server launcher
├── schemas/
│   └── openapi/                 repository-api.yaml contract (source of truth)
├── documentation/
│   ├── README.md
│   ├── architecture.md
│   ├── architecture-diagrams.md
│   ├── accessibility-manual-evidence.md
│   ├── accessibility-evidence/
│   ├── aws-modernization.md
│   ├── data-sources.md
│   ├── data-storage-sync.md
│   ├── mapping-visualization.md
│   ├── accessibility-508-wcag.md
│   ├── nx-angular-wcag.md
│   ├── backend-java-api.md
│   ├── docker-dspace-solr-postgres.md
│   └── usgs-national-map-evaluation.md
├── planning/
│   ├── README.md
│   ├── TODO.md
│   ├── ROADMAP.md
│   ├── DECISIONS.md
│   ├── ACCEPTANCE_CRITERIA.md
│   └── RISKS.md
├── .agents/
│   ├── AGENTS.md
│   ├── java-api-contracts.md
│   ├── nx-angular-wcag.md
│   └── mcp/
├── docker-compose.yml
└── README.md
```

## Current Status

The Nx workspace, Angular UI, OpenAPI contract, accessibility evidence, Docker platform, and Java API are all in place, and sync writes normalized metadata into DSpace idempotently. The vertical slice is connected everywhere except one link:

```text
Public dataset metadata
  -> harvester                     static adapter constants
  -> DSpace item                   working, idempotent
  -> Solr discovery index          indexed from fixtures, not DSpace   <-- open
  -> Angular search result         served from fixtures                <-- open
  -> dataset detail page           served from fixtures                <-- open
  -> map visualization             working, live USGS with fallback
```

Closing that gap — making DSpace metadata drive discovery and dataset detail — is the current top priority. The full list of gaps between the architecture and the implementation is in [Known Seams](documentation/architecture-diagrams.md#known-seams); the ordered plan is in [planning/ROADMAP.md](planning/ROADMAP.md#near-term-order).

Architecture is documented as C4 context and container views plus ingestion, search, and map sequences in [architecture-diagrams.md](documentation/architecture-diagrams.md). The cloud target is in [aws-modernization.md](documentation/aws-modernization.md). Accessibility has automated coverage in `quality:all` and manual checklists in [accessibility-manual-evidence.md](documentation/accessibility-manual-evidence.md); no manual run has been recorded yet, so the project currently has automated-scan results rather than complete Section 508 evidence.

## Local Setup

```bash
cp .env.sample .env
```

`.env` is git-ignored and supplies the DSpace administrator credentials used by both the seed job and the Java API's metadata reconciliation. The committed `.env.sample` holds fictitious local-demo values and works as-is, because the seed job creates the administrator from the same variables. With no `.env`, the API still runs — DSpace writes are simply disabled and sync stays diff-only.

## Development Scripts

```bash
pnpm run start:all
pnpm run docker:down
pnpm run dspace:up
pnpm run dspace:verify
pnpm run sync:dry-run
pnpm run sync:apply
pnpm run test:all
pnpm run quality:all
pnpm run openapi:generate
pnpm run openapi:check
pnpm run wcag:report
pnpm run section508:report
```

`start:all` runs the Docker Compose stack. The Java API is exposed at `http://localhost:8080/api`, the Angular UI at `http://localhost:4200`, PostgreSQL at `localhost:5432`, and Solr at `http://localhost:8983`.

The optional DSpace profile is available with `pnpm run dspace:up` and verifies at `http://localhost:8081/server/api`. It uses persistent Docker volumes for the DSpace asset store, DSpace PostgreSQL database, and DSpace Solr cores.

`wcag:report` and `section508:report` run the Playwright/axe checks with a console reporter so pass/fail results are visible in terminal output.

Frontend API types are generated from [schemas/openapi/repository-api.yaml](schemas/openapi/repository-api.yaml). Run `pnpm run openapi:generate` after contract changes and `pnpm run openapi:check` before committing to prevent OpenAPI/frontend type drift.

Implementation planning is tracked in [planning/README.md](planning/README.md), with the active backlog in [planning/TODO.md](planning/TODO.md).
