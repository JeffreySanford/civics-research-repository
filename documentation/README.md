# Documentation

This directory captures the product, architecture, data, accessibility, and platform plan for Civics Research Repository.

## Documents

- [Architecture](architecture.md): system model, datastore roles, bounded contexts, major workflows, and deployment direction.
- [Architecture Diagrams](architecture-diagrams.md): C4 context and container views, ingestion/search/map sequences, and the known seams between the architecture and the implementation.
- [Data Sources](data-sources.md): public Census and USGS source candidates, ingestion assumptions, and metadata model.
- [Data Storage and Sync](data-storage-sync.md): storage boundaries, source sync model, cache policy, and expansion order.
- [Mapping Visualization](mapping-visualization.md): geospatial UX, map layers, USGS overlays, and accessibility requirements.
- [USGS National Map Evaluation](usgs-national-map-evaluation.md): follow-on National Map reference overlay options.
- [508/WCAG Accessibility](accessibility-508-wcag.md): accessibility standards, automated checks, and manual validation direction.
- [Manual Accessibility Evidence](accessibility-manual-evidence.md): keyboard, NVDA, JAWS, map-equivalence, and cognitive checklists, plus the recording template and known limitations.
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

The early decision gates are closed: Java 21 with Gradle in Docker, DSpace 9.0 as the Docker baseline, MapLibre GL as the map library, and OpenAPI as the contract source of truth with generated frontend types and a drift check in `quality:all`. One gate remains open — generating Java DTOs from OpenAPI rather than hand-writing records.

The current work is no longer scaffolding but closing the gap between the architecture and the implementation. In priority order:

1. Make DSpace metadata drive discovery and dataset detail, replacing the fixture path.
2. Disambiguate the application and DSpace datastores by name and documented role.
3. Provide one command that starts the entire demo including DSpace.
4. ~~Architecture diagrams and AWS modernization documentation.~~ Delivered.
5. Record a manual accessibility evidence run against the delivered checklists.

The active backlog and first vertical-slice criteria live in [planning](../planning/README.md).
