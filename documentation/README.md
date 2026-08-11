# Documentation

This directory captures the product, architecture, data, accessibility, and platform plan for Civics Research Repository.

## Documents

- [Architecture](architecture.md): system model, bounded contexts, major workflows, and deployment direction.
- [Data Sources](data-sources.md): public Census and USGS source candidates, ingestion assumptions, and metadata model.
- [Mapping Visualization](mapping-visualization.md): geospatial UX, map layers, USGS overlays, and accessibility requirements.
- [508/WCAG Accessibility](accessibility-508-wcag.md): accessibility standards, automated checks, and manual validation evidence.
- [Docker, DSpace, Solr, PostgreSQL](docker-dspace-solr-postgres.md): local platform plan and service responsibilities.
- [Nx, Angular 22, Material Design, WCAG, and Section 508](nx-angular-wcag.md): frontend workspace baseline and automated accessibility direction.
- [Backend Java API](backend-java-api.md): Spring Boot, OpenAPI, DTO, validation, and Nx integration direction.

## Positioning

The demo should show a realistic federal open-science repository workflow:

1. A public dataset is represented as a research object.
2. Metadata and files are managed by DSpace.
3. Search and facets are powered by Solr.
4. Angular consumes repository APIs and presents the discovery experience.
5. Geospatial datasets include map previews and USGS contextual overlays.
6. Accessibility evidence is treated as a release artifact.
