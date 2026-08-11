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
- [x] Capture mapping visualization and USGS overlay direction.
- [x] Capture Docker, DSpace, Solr, and PostgreSQL direction.
- [x] Create GitHub repository.
- [x] Push initial documentation scaffold.

### Sprint 0.2 - Architecture and Prototype Scope

- [ ] Create C4 context diagram.
- [ ] Create container diagram for Angular, DSpace, Solr, PostgreSQL, and harvester.
- [ ] Create sequence diagram for public dataset ingestion.
- [ ] Create sequence diagram for search and faceted discovery.
- [ ] Create sequence diagram for dataset map rendering.
- [ ] Define first vertical slice acceptance criteria.
- [ ] Decide Angular map library: MapLibre GL or Leaflet.
- [ ] Confirm DSpace Docker baseline.

## PI 1 - Local Repository Platform

Goal: run the repository stack locally with DSpace, PostgreSQL, Solr, and seed metadata.

### Sprint 1.1 - Docker Platform

- [ ] Add Docker Compose file.
- [ ] Add PostgreSQL service for DSpace.
- [ ] Add Solr service for DSpace discovery.
- [ ] Add DSpace REST service.
- [ ] Add local environment sample.
- [ ] Document startup and reset commands.
- [ ] Verify DSpace API is reachable locally.
- [ ] Verify Solr is reachable locally.

### Sprint 1.2 - DSpace Seed Repository

- [ ] Define DSpace community for Census public research data.
- [ ] Define DSpace collection for ACS PUMS.
- [ ] Create seed metadata for one ACS PUMS North Dakota item.
- [ ] Attach source URLs and documentation URLs.
- [ ] Confirm item appears through DSpace REST.
- [ ] Confirm item is indexed into Solr discovery.

## PI 2 - Public Data Harvester

Goal: ingest public metadata from Census and USGS sources into repository-ready objects.

### Sprint 2.1 - Census Metadata Harvester

- [ ] Choose harvester runtime: NestJS, Node script, or Python.
- [ ] Implement ACS PUMS metadata source adapter.
- [ ] Normalize title, program, vintage, geography, file format, source URL, and citation fields.
- [ ] Generate DSpace-ready item payload.
- [ ] Add dry-run mode.
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

## PI 3 - Angular Discovery UI

Goal: build an accessible Angular UI for search, facets, dataset details, versions, and citations.

### Sprint 3.1 - Search and Facets

- [ ] Scaffold Angular discovery application.
- [ ] Define repository API client.
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

## PI 4 - Mapping and USGS Overlays

Goal: deliver the visual map demo mentioned in the role context, with USGS overlays and accessible fallback data.

### Sprint 4.1 - Map Foundation

- [ ] Select MapLibre GL or Leaflet.
- [ ] Build map shell component.
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

- [ ] Add axe-core integration.
- [ ] Add Playwright accessibility smoke tests.
- [ ] Add keyboard navigation tests for search.
- [ ] Add keyboard navigation tests for dataset detail tabs.
- [ ] Add dialog focus tests if dialogs are introduced.
- [ ] Add responsive reflow checks.
- [ ] Add color contrast verification.

### Sprint 5.2 - Manual Evidence

- [ ] Create manual keyboard test checklist.
- [ ] Create NVDA smoke-test checklist.
- [ ] Create JAWS smoke-test checklist.
- [ ] Create map accessibility checklist.
- [ ] Store release evidence under documentation.
- [ ] Document known limitations.

## PI 6 - AWS Modernization Documentation

Goal: describe a credible federal modernization path without requiring paid cloud deployment for the demo.

### Sprint 6.1 - AWS Architecture

- [ ] Document ECS/Fargate option.
- [ ] Document EKS/Kubernetes option.
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
