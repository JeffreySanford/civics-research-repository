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

## Planned Stack

- Angular for the public discovery and visualization UI.
- DSpace for repository content, metadata, item/version/file management, and REST APIs.
- Apache Solr for discovery search, facets, and relevance.
- PostgreSQL for DSpace persistence.
- Docker Compose for local development.
- Optional NestJS or Node-based harvester for public dataset metadata ingestion.
- MapLibre GL or Leaflet for accessible geospatial visualization.

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
├── documentation/
│   ├── README.md
│   ├── architecture.md
│   ├── data-sources.md
│   ├── mapping-visualization.md
│   ├── accessibility-508-wcag.md
│   └── docker-dspace-solr-postgres.md
├── planning/
│   └── TODO.md
└── README.md
```

## Current Status

Planning and documentation scaffold only. Implementation will start with one vertical slice:

```text
Public dataset metadata
  -> harvester
  -> DSpace item
  -> Solr discovery index
  -> Angular search result
  -> dataset detail page
  -> map visualization with USGS overlay
```
