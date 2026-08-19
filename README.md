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
- Docker Compose for local development; `pnpm run start:all` brings up DSpace and the application stack together.
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
│   └── scripts/                 Stack orchestration, OpenAPI drift check, DSpace seed verification
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

The vertical slice is connected end to end. DSpace is the system of record for both writes and reads:

```text
Public dataset metadata
  -> harvester                     static adapter constants          <-- open
  -> DSpace item                   working, idempotent
  -> Solr discovery index          projected from DSpace
  -> Angular search result         served from the repository
  -> dataset detail page           served from the repository
  -> map visualization             working, live USGS with fallback
```

Discovery, facets, dataset detail, and related research all read from DSpace. The generated fixture catalog survives only as a fallback for when the repository is unavailable, and every API response carries `resultSource` / `source` (`REPOSITORY` or `FIXTURE`) so the UI shows a placeholder-data notice rather than passing fixtures off as repository content. `pnpm run reindex` rebuilds the projection on demand.

### Repository breadth

The repository holds **181 research objects across 15 programs**: TIGER/Line, LODES, and ACS PUMS for all 52 states and territories, eleven national program objects, and one complete research package. Discovery reads all of them from DSpace, so facet counts are real rather than generated.

By type: 177 datasets, 2 publications, 1 methodology report, 1 project.

Breadth is a property of [tools/dspace/catalog.json](tools/dspace/catalog.json), which `tools/scripts/generate-saf.mjs` expands into SAF packages at seed time. Adding a geography or a program is a change to that table. The generated packages are git-ignored, because committing 181 near-identical directories would bury the source of truth.

### Research objects, not only datasets

The repository models publications, methodology and projects alongside datasets, with typed relationships, access levels, licenses, DOIs and researcher identity. The worked example is a real Census research package: two CES working papers, the LODES methodology report that documents the data product they rest on, the public LODES tables, and the Title 13 restricted LEHD microdata behind all of it — described so the research stays citable, holding no files and able to hold none.

Discovery facets on type, result cards carry an access badge when access is not public, and a publication's detail page shows its authors, DOI and typed edges rather than map layers. See [open-science-research-objects.md](documentation/open-science-research-objects.md).

### Preservation

The DSpace assetstore holds **76 mirrored source files, 1.00 GiB**, about 58% of the 1.73 GiB the repository subscribes to. Mirroring is bounded by a per-file cap and a total budget; everything else stays an authoritative link. The Evidence page's Data pipeline tab reports subscribed, mirrored, curated and indexed as four separate figures, each measured rather than asserted.

Remaining gaps are listed in [Known Seams](documentation/architecture-diagrams.md#known-seams); the ordered plan is in [planning/ROADMAP.md](planning/ROADMAP.md#near-term-order).

Architecture is documented as C4 context and container views plus ingestion, search, and map sequences in [architecture-diagrams.md](documentation/architecture-diagrams.md). The cloud target is in [aws-modernization.md](documentation/aws-modernization.md). Accessibility has automated coverage in `quality:all` and manual checklists in [accessibility-manual-evidence.md](documentation/accessibility-manual-evidence.md); no manual run has been recorded yet, so the project currently has automated-scan results rather than complete Section 508 evidence.

## Local Setup

```bash
cp .env.sample .env
```

`.env` is git-ignored and supplies the DSpace administrator credentials used by both the seed job and the Java API's metadata reconciliation. The committed `.env.sample` holds fictitious local-demo values and works as-is, because the seed job creates the administrator from the same variables. With no `.env`, the API still runs — DSpace writes are simply disabled and sync stays diff-only.

## Development Scripts

```bash
pnpm run start:all              # primary daily command (aliases: dev, demo:up)
pnpm run demo:down
pnpm run docker:down
pnpm run start:all:recreate
pnpm run start:all:rebuild
pnpm run start:all:attach
pnpm run docker:reset:everything
pnpm run dspace:up
pnpm run dspace:seed
pnpm run dspace:verify:seed
pnpm run sync:dry-run
pnpm run sync:diff
pnpm run sync:apply
pnpm run reindex
pnpm run test:all
pnpm run quality:all
pnpm run openapi:generate
pnpm run openapi:check
pnpm run wcag:report
pnpm run section508:report
```

### Daily development

`pnpm run start:all` is the one command for daily development and demonstrations. Aliases: `pnpm dev` and `pnpm demo:up`.

It runs the full stack in order:

1. DSpace profile (PostgreSQL, Solr, database migration, REST)
2. Wait for DSpace REST
3. Generate SAF packages (skipped when [tools/dspace/catalog.json](tools/dspace/catalog.json) is unchanged)
4. Seed DSpace (idempotent)
5. Application stack (PostgreSQL, Solr, Java API, Angular UI)
6. Rebuild the discovery Solr projection from DSpace
7. Print URLs when every service is healthy

By default it runs detached. Re-running is safe — seed, SAF generation, and sync are all idempotent. A cold run after `docker:reset:everything` takes several minutes because DSpace migrates its database; a warm restart takes about ninety seconds.

When ready:

- Discovery UI — `http://localhost:4200`
- Repository API — `http://localhost:8080/api`
- DSpace REST — `http://localhost:8081/server/api`
- Discovery Solr — `http://localhost:8983/solr`
- DSpace Solr — `http://localhost:8984/solr`

If DSpace is unreachable, the API serves fixture data with a warning and the UI shows a placeholder-data notice. That is acceptable for local development but means discovery is not reading from the repository. Check `pnpm run dspace:verify:seed` or re-run `pnpm run start:all`.

### Smart container management

Startup is orchestrated by [tools/scripts/stack.mjs](tools/scripts/stack.mjs) through shared logic in [tools/scripts/compose-stack.mjs](tools/scripts/compose-stack.mjs). You should not need to kill containers manually.

- Healthy running containers are left alone
- Only unhealthy, dead, or crash-looping containers are recreated
- Named volumes are preserved (DSpace assetstore, both PostgreSQL databases, both Solr cores)
- Compose still recreates a service when its image or configuration changed

Before any container starts, the launcher checks that `pnpm-lock.yaml` matches `package.json`. A mismatch would make the UI container exit immediately with `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`; the check turns that into a clear fix (`pnpm install --no-frozen-lockfile`).

### Stopping the stack

- `pnpm run demo:down` — stops everything (application stack and DSpace profile), keeps all volumes
- `pnpm run docker:down` — stops the application stack only; DSpace keeps running

`docker:reset:everything` is the only command that destroys volumes, DSpace included.

### Escape hatches

- `pnpm run start:all:recreate` — force-recreate every container, then start detached
- `pnpm run start:all:rebuild` — rebuild images first, then force-recreate
- `pnpm run start:all:attach` — start detached, then tail discovery-ui logs

The optional DSpace profile is also available piecemeal with `pnpm run dspace:up`, `pnpm run dspace:seed`, and `pnpm run dspace:verify:seed` when working on repository integration outside the unified startup flow.

`wcag:report` and `section508:report` run the Playwright/axe checks with a console reporter so pass/fail results are visible in terminal output.

Frontend API types are generated from [schemas/openapi/repository-api.yaml](schemas/openapi/repository-api.yaml). Run `pnpm run openapi:generate` after contract changes and `pnpm run openapi:check` before committing to prevent OpenAPI/frontend type drift.

Implementation planning is tracked in [planning/README.md](planning/README.md), with the active backlog in [planning/TODO.md](planning/TODO.md).
