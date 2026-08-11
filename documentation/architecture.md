# Architecture

## Reference Architecture

```text
Public User
  |
  v
Angular Discovery UI
  - Search
  - Facets
  - Dataset detail pages
  - Versions
  - Files
  - Citations
  - Mapping visualizations
  - 508/WCAG evidence views
  |
  | REST / JSON
  v
DSpace REST API
  - Communities
  - Collections
  - Items
  - Metadata
  - Bitstreams
  - Relationships
  - Access rules
  |
  +--> PostgreSQL
  |      - Repository metadata
  |      - Item relationships
  |      - Workflow state
  |
  +--> Apache Solr
         - Discovery index
         - Full-text search
         - Facets
         - Relevance

Public Data Harvester
  |
  +--> Census public APIs and downloads
  +--> USGS public APIs and map services
```

## Core Architectural Principle

DSpace remains the system of record. Solr is not the source of truth and should not become a warehouse for raw public-use microdata records. Solr indexes repository-level research objects: titles, abstracts, subjects, geography, program, vintage, file formats, citations, identifiers, documentation text, and relationship metadata.

## Major Bounded Contexts

### Discovery UI

Angular application for public search, filtering, dataset details, version browsing, download affordances, citation copy, and geospatial previews.

### Repository

DSpace manages communities, collections, items, metadata, relationships, bitstreams, and repository workflow states.

### Search

Solr powers keyword search, faceted navigation, relevance ranking, documentation indexing, and result counts.

### Ingestion

Harvester process imports public metadata and file references from Census and USGS resources. Early implementation should ingest metadata and source links before attempting full file mirroring.

### Mapping

Mapping layer renders TIGER/Line, LODES, and other geospatial datasets with USGS contextual overlays where useful.

## Initial Vertical Slice

1. Select one Census dataset release, preferably ACS PUMS for North Dakota.
2. Create a DSpace community and collection.
3. Create one DSpace item with metadata, source links, and documentation references.
4. Confirm Solr indexes the item for discovery.
5. Build Angular search results and dataset detail pages.
6. Add a map preview for one geospatial dataset.
7. Add one USGS overlay.
8. Capture accessibility evidence for the workflow.

## Deployment Direction

Local development starts with Docker Compose. AWS modernization documentation should describe a future containerized path using ECS/Fargate or EKS, PostgreSQL on RDS, Solr with persistent storage or a managed search replacement decision, and CloudFront for the Angular frontend.
