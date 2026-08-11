# Roadmap

## Implementation Strategy

Build one working vertical slice before expanding sources or UI breadth:

```text
OpenAPI contract
  -> Java API DTOs and controller skeleton
  -> DSpace seed item
  -> Solr-discoverable repository object
  -> Angular typed API client
  -> NgRx search/detail/map state
  -> accessible search result and dataset detail
  -> map tab with USGS overlay
  -> WCAG/Section 508 console evidence
```

## Phase 0 - Baseline Complete

Status: mostly complete.

- Project name and GitHub repository are set.
- Documentation and planning directories exist.
- Nx workspace exists.
- Angular 22 and Material baseline exists.
- Playwright and axe-core accessibility checks exist.
- OpenAPI source contract exists.
- Frontend DTO generation and drift check exist.

Remaining cleanup:

- Review Nx 24 inferred-target migration warnings.
- Resolve the Analog/Vitest Angular library warning.
- Add architecture diagrams.

## Phase 1 - Contracted Java API

Primary goal: create a Java backend that is contract-first from day one.

Required decisions:

- Maven vs Gradle.
- Java runtime target.
- Nx Java plugin.
- OpenAPI Java DTO generation approach.

Implementation order:

1. Add Java build wrapper and Nx target integration.
2. Generate or scaffold `apps/repository-api`.
3. Generate Java DTOs from OpenAPI.
4. Add controller interfaces for search, datasets, maps, and accessibility evidence.
5. Add mock service implementations returning seeded fixtures.
6. Add backend validation and API tests.

## Phase 2 - DSpace, PostgreSQL, and Solr

Primary goal: start the local repository platform through Docker.

Implementation order:

1. Select DSpace-supported Docker baseline.
2. Add Docker Compose services for PostgreSQL, Solr, and DSpace REST.
3. Add local environment sample.
4. Create seed community, collection, and ACS PUMS North Dakota item.
5. Verify DSpace REST access.
6. Verify Solr discovery indexing.

## Phase 3 - Angular Discovery UI

Primary goal: replace starter UI with a typed, accessible discovery workflow.

Implementation order:

1. Generate Angular API client methods from OpenAPI.
2. Add NgRx feature state for search.
3. Build search route, result list, facets, and URL state.
4. Add dataset detail route with files, versions, citation, metadata, and map tab shell.
5. Expand WCAG/508 tests beyond the root route.

## Phase 4 - Mapping and USGS Overlay

Primary goal: deliver the mapping data visualization with USGS overlays.

Implementation order:

1. Decide MapLibre GL vs Leaflet based on Census/USGS layer formats.
2. Build map shell, layer controls, legend, attribution, and feature list.
3. Add TIGER/Line or LODES sample layer.
4. Add USGS earthquake overlay.
5. Add accessible non-map representation and synchronized selection state.

## Phase 5 - Demo Evidence Package

Primary goal: make the demo explainable and reviewable.

Implementation order:

1. Add automated WCAG/508 console evidence artifacts.
2. Add manual keyboard and screen-reader checklists.
3. Add demo script.
4. Add architecture walkthrough.
5. Add known tradeoffs and next-step recommendations.
