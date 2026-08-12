# Architecture

C4 context and container views, plus ingestion, search, and map sequences, are in [architecture-diagrams.md](architecture-diagrams.md). This document covers the model and the reasoning; the diagrams cover the shape.

## Reference Architecture

```text
Public User / Repository Steward
  |
  v
Angular Discovery UI (:4200)
  - Search, facets, dataset detail
  - Versions, files, citations
  - Mapping visualizations
  - Admin sync workflow
  - 508/WCAG evidence views
  |
  | REST / JSON, types generated from OpenAPI
  v
Java repository-api (:8080/api)
  - Search, dataset, map-layer, and overlay endpoints
  - Sync orchestration: dry-run, diff, apply
  - Owns every outbound integration
  |
  +--> Application PostgreSQL (:5432)
  |      - Sync job state
  |
  +--> Discovery Solr, `discovery` core (:8983)
  |      - Public discovery projection
  |      - Full-text search, facets, relevance
  |
  +--> DSpace REST (:8081) -- system of record
  |      - Communities, collections, items
  |      - Metadata, bitstreams, relationships
  |      |
  |      +--> DSpace PostgreSQL (:5433)
  |      +--> DSpace Solr cores (:8984)
  |
  +--> USGS Earthquake Catalog
         - Live GeoJSON, bundled fixture fallback
```

The Angular UI never calls DSpace, Solr, or USGS directly. Every integration is owned by the Java API, which keeps the browser contract to a single typed OpenAPI surface and keeps credentials server-side.

## Core Architectural Principle

DSpace remains the system of record. Solr is not the source of truth and should not become a warehouse for raw public-use microdata records. Solr indexes repository-level research objects: titles, abstracts, subjects, geography, program, vintage, file formats, citations, identifiers, documentation text, and relationship metadata.

Stated as a rule: **the `discovery` Solr core is a projection of DSpace and must always be rebuildable from it.** Anything that exists only in Solr is a bug, because it cannot survive a reindex.

The implementation satisfies this rule. `DiscoveryProjectionService` is the only writer of the `discovery` core and builds it entirely from DSpace items, and `pnpm run reindex` rebuilds it on demand. When the repository yields nothing the fixture catalog is indexed instead, and that substitution is reported through the API as `resultSource: FIXTURE` rather than passed off as repository content.

## Datastore Roles

Four datastores across two systems, which is easy to misread. Each has one job:

| Datastore                                   | Role                                             | Owner            |
| ------------------------------------------- | ------------------------------------------------ | ---------------- |
| Application PostgreSQL `civics_ops` (:5432) | Application operational state — sync job history | `repository-api` |
| DSpace PostgreSQL (:5433)                   | Repository system of record                      | DSpace           |
| Discovery Solr, `discovery` core (:8983)    | Public discovery projection, rebuildable         | `repository-api` |
| DSpace Solr (:8984)                         | DSpace internal search and OAI cores             | DSpace           |

The application database is named `civics_ops` and owned by the `civics` role, so the split is legible at a glance: `civics_ops` is application state, `dspace` is the repository. See [planning/DECISIONS.md](../planning/DECISIONS.md) under "Datastore Roles and Naming".

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

The first visual slice targets TIGER/Line Census Tracts for North Dakota, with ACS PUMS kept as the follow-on metadata-rich example.

1. ~~Create a DSpace community and collection.~~ Done.
2. ~~Create one DSpace item with metadata, source links, and documentation references.~~ Done, via the SAF seed package and `crr.*` schema.
3. ~~Synchronize normalized source metadata into that item.~~ Done, idempotently, for Dublin Core and `crr.*` fields.
4. ~~Make DSpace metadata drive discovery and dataset detail.~~ Done. Search, facets, dataset detail, and related research are read from DSpace; fixtures remain only as a labelled fallback.
5. ~~Build Angular search results and dataset detail pages.~~ Done.
6. ~~Add a map preview and one USGS overlay.~~ Done.
7. ~~Capture automated accessibility evidence.~~ Done. Manual evidence checklists exist; no run has been recorded.

Remaining: live source harvesting in place of static adapter constants. The file manifest is reconciled as `crr.file.manifest` metadata, so `sync:diff` now reaches `SKIP_ITEM`.

## Deployment Direction

Local development runs on Docker Compose. The AWS target — EKS as the recommendation, ECS/Fargate as the alternate, RDS PostgreSQL, the Solr persistence tradeoff, CloudFront for the frontend, and the observability and backup posture — is documented in [aws-modernization.md](aws-modernization.md). Nothing is deployed; the document is the artifact.
