# TODO

## PI 0 - Repository Foundation

Goal: establish the project direction, documentation base, and working backlog.

### Sprint 0.1 - Naming and Repo Setup

- [x] Choose package name: Civics Research Repository.
- [x] Create documentation directory.
- [x] Create planning directory.
- [x] Create initial TODO backlog.
- [x] Capture high-level architecture direction.
- [x] Capture public data source candidates.
- [x] Capture public data storage and sync policy.
- [x] Capture mapping visualization and USGS overlay direction.
- [x] Capture Docker, DSpace, Solr, and PostgreSQL direction.
- [x] Create GitHub repository.
- [x] Push initial documentation scaffold.

### Sprint 0.2 - Architecture and Prototype Scope

- [x] Add Nx, Angular 22, Material Design, WCAG, and Section 508 workspace baseline.
- [x] Add project-specific `.agents` guidance.
- [x] Add MCP template notes for Nx and accessibility evidence.
- [x] Define first vertical slice acceptance criteria.
- [x] Add planning roadmap.
- [x] Add decision log.
- [x] Add risk register.
- [ ] Create C4 context diagram.
- [ ] Create container diagram for Angular, Java API, DSpace, Solr, PostgreSQL, and harvester.
- [ ] Create sequence diagram for public dataset ingestion.
- [ ] Create sequence diagram for search and faceted discovery.
- [ ] Create sequence diagram for dataset map rendering.
- [x] Decide Angular map library: MapLibre GL first.
- [ ] Confirm DSpace Docker baseline.

### Sprint 0.3 - Nx Workspace Generation

- [x] Install pnpm dependencies.
- [x] Verify Nx 23.1.1 local CLI.
- [x] Confirm Nx 23 Angular generator does not support `--dry-run`.
- [x] Generate Angular 22 `discovery-ui` app.
- [x] Generate Playwright e2e project.
- [x] Generate shared UI library.
- [x] Generate shared Material library.
- [x] Generate shared accessibility library.
- [x] Generate repository models and API client libraries.
- [x] Generate map visualization and USGS overlay libraries.
- [x] Generate Census and USGS data-source libraries.
- [x] Add first accessibility target using Playwright and axe-core.
- [x] Verify `pnpm nx show projects`.
- [x] Verify `pnpm nx run discovery-ui:build`.
- [x] Verify `pnpm nx run-many -t test --all`.
- [x] Verify `pnpm nx run-many -t lint --all`.
- [x] Verify `pnpm nx run discovery-ui-e2e:accessibility`.
- [ ] Review Nx 24 migration warnings for inferred ESLint and Vitest targets.
- [ ] Resolve Analog/Vitest Angular `tsconfig.app.json` warning for non-buildable Angular libraries.

## PI 1 - Local Repository Platform

Goal: run the repository stack locally with a typed Java API, DSpace, PostgreSQL, Solr, and seed metadata.

### Sprint 1.0 - Java API Contract Foundation

- [x] Decide backend direction: Java/Spring Boot preferred over NestJS for federal alignment.
- [x] Add backend Java API documentation.
- [x] Add OpenAPI-first repository API contract.
- [x] Add OpenAPI-to-frontend type generation.
- [x] Add OpenAPI generated type drift check.
- [x] Add OpenAPI lint/check into `quality:all`.
- [x] Add Java API contract agent guidance.
- [x] Add Java API MCP template notes.
- [x] Add NgRx packages compatible with Angular 22.
- [x] Wire root NgRx Store, Effects, Router Store, and DevTools providers.
- [x] Generate Angular TypeScript API types from OpenAPI.
- [x] Choose Java runtime target: 21.
- [ ] Choose Maven or Gradle.
- [ ] Install/enable Maven wrapper or choose Gradle wrapper strategy.
- [ ] Select Nx Java integration plugin.
- [ ] Select OpenAPI-to-Java DTO generation tool.
- [ ] Generate `apps/repository-api`.
- [ ] Generate Java DTOs from OpenAPI.
- [x] Generate Angular TypeScript API client methods from OpenAPI.
- [ ] Add typed NgRx feature state for search.
- [ ] Add typed NgRx feature state for dataset detail.
- [ ] Add typed NgRx feature state for map overlays.
- [ ] Add typed NgRx feature state for accessibility evidence.
- [x] Add typed NgRx feature state for admin sync.

### Sprint 1.1 - Docker Platform

- [x] Add Docker Compose file.
- [x] Add persistent Docker volumes for API artifacts, PostgreSQL, Solr, pnpm store, and container `node_modules`.
- [x] Add PostgreSQL service for DSpace.
- [x] Add Solr service for discovery.
- [ ] Add DSpace REST service.
- [x] Add Java API service.
- [x] Add Angular UI service.
- [x] Add local environment sample.
- [ ] Document startup and reset commands.
- [ ] Verify DSpace API is reachable locally.
- [x] Verify Solr is reachable locally.
- [x] Verify startup sync creates or updates the seed repository objects.

### Sprint 1.2 - DSpace Seed Repository

- [ ] Define DSpace community for Census public research data.
- [ ] Define DSpace collection for the first visual geospatial source.
- [ ] Create seed metadata for one TIGER/Line or LODES North Dakota item.
- [ ] Attach source URLs and documentation URLs.
- [ ] Store small-to-medium mirrored demo artifacts where useful.
- [ ] Confirm item appears through DSpace REST.
- [ ] Confirm item is indexed into Solr discovery.

## PI 2 - Public Data Harvester

Goal: ingest public metadata from Census and USGS sources into repository-ready objects.

### Sprint 2.1 - Census Metadata Harvester

- [x] Decide harvester placement: Java API owns sync orchestration and sync state.
- [ ] Define sync state model for source ID, source URL, DSpace item ID, last sync status, and source freshness.
- [ ] Implement TIGER/Line or LODES metadata source adapter for first visual slice.
- [ ] Add startup sync path.
- [ ] Add admin UI-triggered sync endpoint.
- [ ] Add script/CLI sync entry point.
- [ ] Normalize title, program, vintage, geography, file format, source URL, and citation fields.
- [ ] Generate DSpace-ready item payload.
- [ ] Add dry-run mode.
- [ ] Add diff mode to compare source metadata with DSpace item state.
- [ ] Add logging and error handling.
- [ ] Add unit tests for metadata normalization.

### Sprint 2.2 - Additional Census Sources

- [ ] Add SIPP metadata adapter.
- [ ] Add CPS metadata adapter.
- [ ] Add LODES metadata adapter.
- [ ] Add TIGER/Line metadata adapter.
- [ ] Add source-specific documentation links.
- [ ] Add source freshness notes.

### Sprint 2.3 - USGS Overlay Sources

- [ ] Add USGS earthquake feed adapter.
- [ ] Evaluate USGS National Map layer options.
- [ ] Document overlay attribution requirements.
- [ ] Normalize USGS overlay metadata.
- [ ] Add sample overlay fixture for local map development.

### Sprint 2.4 - Optional Cross-Agency Federation

- [ ] Evaluate NOAA Climate Data Online as a later federation source.
- [ ] Evaluate NASA POWER as a later federation source.
- [ ] Confirm metadata model extensions needed for non-Census science datasets.
- [ ] Keep optional sources out of the first vertical slice unless the Census/USGS path is already working.

## PI 3 - Angular Discovery UI

Goal: build an accessible Angular UI for search, facets, dataset details, versions, citations, and typed async data flows.

### Sprint 3.1 - Search and Facets

- [x] Scaffold Angular discovery application.
- [x] Replace starter shell with routed app navigation.
- [x] Define repository API client methods from generated OpenAPI types.
- [ ] Build search page.
- [ ] Build result card/list component.
- [ ] Build facet panel.
- [ ] Add URL-driven search state.
- [ ] Add loading, empty, and error states.
- [ ] Add keyboard interaction tests.

### Sprint 3.2 - Dataset Details

- [ ] Build dataset detail route.
- [ ] Build metadata summary.
- [ ] Build file/download section.
- [ ] Build citation section.
- [ ] Build versions tab.
- [ ] Build related research section.
- [ ] Add accessible tab behavior.

### Sprint 3.3 - Admin Sync Workflow

- [x] Build admin route.
- [x] Add sync status summary.
- [x] Add manual dry-run sync button.
- [x] Add manual apply sync button.
- [x] Show create, update, skip, and failure results.
- [x] Add typed NgRx state for sync jobs.

## PI 4 - Mapping and USGS Overlays

Goal: deliver the visual map demo mentioned in the role context, with USGS overlays and accessible fallback data.

### Sprint 4.1 - Map Foundation

- [x] Select MapLibre GL first.
- [ ] Build MapLibre GL map shell component.
- [ ] Add dataset-driven layer loading.
- [ ] Add layer toggle controls.
- [ ] Add source attribution display.
- [ ] Add accessible feature list.
- [ ] Add non-color-only legend.

### Sprint 4.2 - Census Geospatial Layers

- [ ] Add TIGER/Line boundary preview.
- [ ] Add LODES sample layer or fixture.
- [ ] Add geography filter integration.
- [ ] Add dataset detail map tab.
- [ ] Add map state to URL where practical.

### Sprint 4.3 - USGS Overlay Integration

- [ ] Add USGS earthquake overlay.
- [ ] Add overlay filter by time range or magnitude.
- [ ] Add visible source and update timestamp.
- [ ] Add accessible event list synchronized with map selection.
- [ ] Add overlay error and stale-data states.

## PI 5 - Section 508 and WCAG Evidence

Goal: make accessibility evidence visible, repeatable, and tied to release workflows.

### Sprint 5.1 - Automated Checks

- [x] Add axe-core integration.
- [x] Add Playwright accessibility smoke tests.
- [x] Add WCAG console report script.
- [x] Add Section 508 console report script.
- [ ] Expand automated scans to search route.
- [ ] Expand automated scans to dataset detail route.
- [ ] Expand automated scans to map route or map tab.
- [ ] Add keyboard navigation tests for search.
- [ ] Add keyboard navigation tests for dataset detail tabs.
- [ ] Add keyboard navigation tests for map layer controls.
- [ ] Add dialog focus tests if dialogs are introduced.
- [ ] Add responsive reflow checks.
- [ ] Add color contrast verification.

### Sprint 5.2 - Manual Evidence

- [ ] Build accessibility evidence UI route.
- [ ] Create manual keyboard test checklist.
- [ ] Create NVDA smoke-test checklist.
- [ ] Create JAWS smoke-test checklist.
- [ ] Create map accessibility checklist.
- [ ] Store release evidence under documentation.
- [ ] Document known limitations.

## PI 6 - AWS Modernization Documentation

Goal: describe a credible container-first modernization path without requiring paid cloud deployment for the demo.

### Sprint 6.1 - AWS Architecture

- [ ] Document Docker-first local architecture.
- [ ] Document EKS/Kubernetes modernization option.
- [ ] Document ECS/Fargate only as an alternate container deployment option.
- [ ] Document RDS PostgreSQL option.
- [ ] Document Solr persistence and operational tradeoffs.
- [ ] Document CloudFront/static frontend option.
- [ ] Document logging, monitoring, and backup considerations.

### Sprint 6.2 - Interview Demo Package

- [ ] Create demo script.
- [ ] Create architecture walkthrough.
- [ ] Create dataset ingestion walkthrough.
- [ ] Create accessibility evidence walkthrough.
- [ ] Create mapping/USGS overlay walkthrough.
- [ ] Create known tradeoffs and next steps document.
