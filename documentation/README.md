# Documentation

This directory captures the product, architecture, data, accessibility, and platform plan for Civics Research Repository.

## Documents

- [Architecture](architecture.md): system model, bounded contexts, major workflows, and deployment direction.
- [Data Sources](data-sources.md): public Census and USGS source candidates, ingestion assumptions, and metadata model.
- [Data Storage and Sync](data-storage-sync.md): storage boundaries, source sync model, cache policy, and expansion order.
- [Mapping Visualization](mapping-visualization.md): geospatial UX, map layers, USGS overlays, and accessibility requirements.
- [USGS National Map Evaluation](usgs-national-map-evaluation.md): follow-on National Map reference overlay options.
- [508/WCAG Accessibility](accessibility-508-wcag.md): accessibility standards, automated checks, and manual validation evidence.
- [Docker, DSpace, Solr, PostgreSQL](docker-dspace-solr-postgres.md): local platform plan and service responsibilities.
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

The project direction is defined enough to proceed, but the next implementation step should close a few decision gates before generating the Java backend and Docker platform:

- Java runtime and build tool.
- Nx Java integration plugin.
- OpenAPI-to-Java DTO generation.
- DSpace Docker baseline.
- Map library selection.

The active backlog and first vertical-slice criteria live in [planning](../planning/README.md).
