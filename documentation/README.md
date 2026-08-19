# Documentation

This directory captures the product, architecture, data, accessibility, and platform plan for Civics Research Repository.

## Documents

- [Architecture](architecture.md): system model, datastore roles, bounded contexts, major workflows, and deployment direction.
- [Architecture Diagrams](architecture-diagrams.md): C4 context and container views, ingestion/search/map sequences, and the known seams between the architecture and the implementation.
- [Data Sources](data-sources.md): public Census and USGS source candidates, ingestion assumptions, and metadata model.
- [Data Storage and Sync](data-storage-sync.md): storage boundaries, source sync model, cache policy, and expansion order.
- [Open Science Research Objects](open-science-research-objects.md): the research-object model — types, typed relationships, access levels, license, DOI and researcher identity — and the worked Census research package.
- [Mapping Visualization](mapping-visualization.md): geospatial UX, map layers, USGS overlays, and accessibility requirements.
- [USGS National Map Evaluation](usgs-national-map-evaluation.md): follow-on National Map reference overlay options.
- [508/WCAG Accessibility](accessibility-508-wcag.md): accessibility standards, automated checks, and manual validation direction.
- [Manual Accessibility Evidence](accessibility-manual-evidence.md): keyboard, NVDA, JAWS, map-equivalence, and cognitive checklists, plus the recording template and known limitations.
- [Interview demo package](demo/README.md): demo script, ingestion walkthrough, mapping/USGS walkthrough, and architecture tradeoffs for stakeholder interviews.
- [Docker, DSpace, Solr, PostgreSQL](docker-dspace-solr-postgres.md): local platform plan and service responsibilities.
- [AWS Modernization](aws-modernization.md): EKS target, ECS/Fargate alternate, RDS, Solr persistence tradeoffs, CloudFront, observability, backup, and migration sequence.
- [Nx, Angular 22, Material Design, WCAG, and Section 508](nx-angular-wcag.md): frontend workspace baseline and automated accessibility direction.
- [Backend Java API](backend-java-api.md): Spring Boot, OpenAPI, DTO, validation, and Nx integration direction.
- [Planning](../planning/README.md): roadmap, decisions, acceptance criteria, risks, and PI/sprint backlog.

## Positioning

The demo should show a realistic federal open-science repository workflow:

1. A public dataset is represented as a research object.
2. Metadata and files are managed by DSpace.
3. Search and facets are powered by Solr.
4. Angular consumes repository APIs and presents the discovery experience.
5. Geospatial datasets include map previews and USGS contextual overlays.
6. Accessibility evidence is treated as a release artifact.

## Planning Alignment

The early decision gates are closed: Java 21 with Gradle in Docker, DSpace 9.0 as the Docker baseline, MapLibre GL as the map library, OpenAPI as the contract source of truth with generated frontend types and Java model DTOs on every build. Generated Spring controller interfaces remain deferred until the generator supports Spring 7.

The vertical slice is connected. What remains is breadth and explainability:

1. ~~Make DSpace metadata drive discovery and dataset detail.~~ **Delivered.**
2. ~~Disambiguate the application and DSpace datastores by name and documented role.~~ **Delivered.**
3. ~~Provide one command that starts the entire demo including DSpace.~~ **Delivered** — `pnpm run start:all` (alias `demo:up`).
4. ~~Architecture diagrams and AWS modernization documentation.~~ **Delivered.**
5. ~~Harvest the catalog from live publishers rather than `tools/dspace/catalog.json` alone.~~ **Baseline delivered** — `pnpm run catalog:harvest`; full publisher auto-discovery remains incremental.
6. ~~Create the interview demo walkthrough scripts.~~ **Delivered** — `documentation/demo/`.
7. Record a manual accessibility evidence run against the delivered checklists.

The active backlog and first vertical-slice criteria live in [planning](../planning/README.md).
