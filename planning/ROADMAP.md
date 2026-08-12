# Roadmap

## Near-Term Order

Phases 0 through 4 are substantially delivered. The work that remains is not more features — it is closing the distance between what the documentation claims and what runs, and producing the artifacts that make the system explainable. In priority order:

### 1. Make DSpace drive one complete vertical slice

Replace the in-memory seed list and hard-coded `DatasetService` fixtures as the primary runtime path with real repository metadata. Keep the fixtures only as a test and demo-recovery fallback, clearly labelled as such.

This is first because it is the difference between a demo that _describes_ a repository architecture and one that _demonstrates_ it. The sync path already writes to DSpace; nothing reads back from it.

### 2. Disambiguate the two PostgreSQL and two Solr systems

Rename the application database to `civics_ops`, and state explicitly that the custom Solr core is the public discovery projection. See DECISIONS.md, "Datastore Roles and Naming".

### 3. Add a true one-command demo environment

`start:all` does not activate the DSpace profile, so no single command produces a demonstrable system. Add `demo:up`: DSpace, both PostgreSQL instances, both Solr instances, the Java API, Angular, seed, sync, and health checks. This matters disproportionately during a live demonstration.

### 4. Diagrams and AWS modernization

**Delivered.** C4 context and container views and the ingestion, search, and map sequences are in [architecture-diagrams.md](../documentation/architecture-diagrams.md); the modernization target is in [aws-modernization.md](../documentation/aws-modernization.md). These were likely worth more than another feature, since they were the visibly missing pieces of the original job-alignment plan.

### 5. Finish manual accessibility evidence

Checklists are **delivered** in [accessibility-manual-evidence.md](../documentation/accessibility-manual-evidence.md): keyboard, NVDA, JAWS, map equivalence, and cognitive review. What remains is executing a run and recording it. The automated axe work is strong, but the risk register is right that a map can pass axe and still be inaccessible — and a recorded run is what turns "I know WCAG" into "I know how Section 508 evidence is produced."

## Implementation Strategy

Build one working vertical slice before expanding sources or UI breadth:

```text
OpenAPI contract
  -> Java API DTOs and controller skeleton
  -> startup/admin/script sync
  -> DSpace seed item in persistent Docker storage
  -> Solr-discoverable repository object
  -> Angular typed API client
  -> NgRx search/detail/map state
  -> accessible search result, dataset detail, and admin sync view
  -> map tab with USGS overlay
  -> WCAG/Section 508 console and UI evidence
```

## Phase 0 - Baseline

Status: complete.

- Project name and GitHub repository are set.
- Documentation and planning directories exist.
- Nx workspace exists.
- Angular 22 and Material baseline exists.
- Playwright and axe-core accessibility checks exist.
- OpenAPI source contract exists.
- Frontend DTO generation and drift check exist.

Remaining cleanup:

- Review Nx 24 inferred-target migration warnings.
- Architecture diagrams: delivered.
- Analog/Vitest Angular library warning: resolved.

## Phase 1 - Contracted Java API

Status: delivered except Java DTO generation.

Primary goal: create a Java backend that is contract-first from day one.

Decisions closed: Gradle in a container image, Java 21, DSpace 9.0 images. Still open: the Nx Java plugin, and generating Java DTOs from OpenAPI rather than hand-writing records — currently only the frontend half of the contract has a drift check.

Implementation order:

1. Add Java build wrapper and Nx target integration.
2. Generate or scaffold `apps/repository-api`.
3. Generate Java DTOs from OpenAPI.
4. Add controller interfaces for search, datasets, maps, and accessibility evidence.
5. Add sync orchestration interfaces and sync-state DTOs.
6. Add mock service implementations returning seeded fixtures.
7. Add backend validation and API tests.

## Phase 2 - DSpace, PostgreSQL, and Solr

Status: platform delivered. The read path back out of DSpace is the open item, tracked as near-term priority 1.

Primary goal: start the local repository platform through Docker.

Implementation order:

1. Select DSpace-supported Docker baseline.
2. Add Docker Compose services for PostgreSQL, Solr, and DSpace REST.
3. Add local environment sample.
4. Add persistent Docker volumes for DSpace assets, PostgreSQL, Solr, and small-to-medium mirrored demo artifacts.
5. Create seed community, collection, and visual geospatial North Dakota item from TIGER/Line or LODES.
6. Run startup sync when the app starts.
7. Verify DSpace REST access. Completed for the optional local DSpace profile on `http://localhost:8081/server/api`.
8. Verify Solr discovery indexing.

Storage rule: store metadata, manifests, source links, checksums where available, small fixtures, and small-to-medium mirrored demo artifacts. Do not mirror large public datasets until a later sprint explicitly needs that behavior.

## Phase 3 - Angular Discovery UI

Status: delivered, against fixture data. Repointing it at repository-backed data is near-term priority 1.

Primary goal: replace starter UI with a typed, accessible discovery workflow.

Implementation order:

1. Generate Angular API client methods from OpenAPI.
2. Add NgRx feature state for search.
3. Build search route, result list, facets, and URL state.
4. Add dataset detail route with files, versions, citation, metadata, and map tab shell.
5. Add admin sync view with dry-run/apply controls and sync status.
6. Add accessibility evidence view.
7. Expand WCAG/508 tests beyond the root route.

## Phase 4 - Mapping and USGS Overlay

Status: delivered.

Primary goal: deliver the mapping data visualization with USGS overlays.

Implementation order:

1. Decide MapLibre GL vs Leaflet based on Census/USGS layer formats.
2. Build MapLibre GL map shell, layer controls, legend, attribution, and feature list.
3. Add TIGER/Line or LODES sample layer.
4. Add USGS earthquake overlay.
5. Add accessible non-map representation and synchronized selection state.

## Phase 5 - Demo Evidence Package

Status: in progress. This is now the largest remaining body of work alongside near-term priorities 1 through 3.

Primary goal: make the demo explainable and reviewable.

Implementation order:

1. ~~Add automated WCAG/508 console evidence artifacts.~~ Delivered.
2. ~~Add manual keyboard and screen-reader checklists.~~ Delivered; a recorded run is still outstanding.
3. ~~Add architecture walkthrough material.~~ Delivered as C4 and sequence diagrams.
4. ~~Add AWS modernization documentation.~~ Delivered.
5. Add the demo script.
6. Add the dataset ingestion, accessibility, and mapping walkthroughs.
7. Add known tradeoffs and next-step recommendations.

## Later Federation

After the Census and USGS path is working, optional federation can add NOAA Climate Data Online and NASA POWER as proof that the repository model can describe public science datasets from agencies beyond Census.
