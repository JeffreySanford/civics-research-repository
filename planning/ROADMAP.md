# Roadmap

## Near-Term Order

Phases 0 through 4 are delivered. The vertical slice runs end to end: DSpace is the system of record
for writes and reads, discovery is projected into Solr, and `pnpm run start:all` (alias `demo:up`)
starts the full stack with seed and reindex. The repository holds 181 research objects across 15
programs, preserves 1.00 GiB of source bytes as real bitstreams, and models publications,
methodology, projects, typed relationships and access restrictions alongside datasets.

What remains is not architecture. The architecture works. What remains is what a researcher actually
experiences, and closing a few seams behind it. In priority order:

### 1. Discovery experience — delivered

**Defaults are fixed.** Discovery no longer applies TIGER/Line, LODES and ACS on the reader's behalf,
so the research package is visible in the default view: 181 objects across 15 programs. The three
remain a labelled shortcut.

**Pagination is done.** 181 objects across 8 pages, with a stated range, URL state, and focus moved
to the results heading on each page change.

**Done.** Defaults, pagination, the Program/Geography/Type/Year facets, weighted relevance, and the
repository's own metadata indexed for search. A reader can now find the spatial-mismatch paper by
its author, the methodology report by "disclosure avoidance", and the restricted microdata by
"Title 13" — none of which matched anything before, because Solr could not see subjects, authors or
citations.

The in-memory fallback matches on tokens with the same minimum-match rule, so losing Solr changes
the ranking rather than the result set. It still cannot see subjects, authors or citations: those
are indexed for Solr and are not carried on `SearchResult`.

Tracked as P12 in [TODO.md](TODO.md).

### 2. Connect discovery to the map — navigation delivered

Discovery now offers "Explore ‹area› workforce on the map", which opens the workspace focused with
the workforce layers on and the reference layers off, states its research context, and links back to
the search that led there. The area comes from the search response's geography facet, so the map is
told where to look rather than reading it out of the rendered cards.

The data behind it is live too. Commuting flows are aggregated from the published LODES
origin-destination file at request time, with county names and centroids from the Census Gazetteer;
states whose file is too large to derive within a map request fall back to a stored sample and say
so. Two-way selection between the accessible flow table and the map is done.

What is left for the workforce view is the WAC side: a workplace-employment layer shading geographies
by job counts, which would pair with the commuting lines to answer "where are the jobs" as well as
"who travels to them". Tracked as P14 in [TODO.md](TODO.md).

### 3. Harvest the catalog from live publishers

Which files exist, and for which vintages, is still curated in `tools/dspace/catalog.json` rather than
discovered from Census and USGS APIs. Per-file facts such as size and release date already come from
live HEAD requests where reachable; catalog discovery is the larger open ingestion piece. Tracked as
the open item under P1 in [TODO.md](TODO.md#current-priorities).

### 4. Persistent repository identity

A DSpace UUID is resolved per operation and discarded, so nothing records that a source identifier
became a particular repository item. Every subsystem re-interprets the string
`tiger-line-north-dakota-2025` independently. Persisting the UUID, the publisher's freshness, and the
indexing timestamp closes the chain — source identifier to DSpace UUID to Solr document to route —
and is what makes relationships, versions and citations resolvable later rather than re-derived.

This is the last structural gap in the sync subsystem and the one an outside reader notices.
Tracked as P15 in [TODO.md](TODO.md).

### 5. Generalise sync to research objects

The catalog and SAF path model the full research-object vocabulary. Live sync does not:
`PublicDatasetMetadata` carries no resource type, access level, license, DOI, researchers or
relations, so a harvested object cannot express what a seeded one can. Renaming it
`ResearchObjectMetadata` and widening the DSpace payload mapper closes the loop. Deliberately behind
the user-facing work — this rebuilds a pipeline that currently functions.

### 6. Finish manual accessibility evidence

Checklists are **delivered** in
[accessibility-manual-evidence.md](../documentation/accessibility-manual-evidence.md). Map-to-list
selection is implemented; Checklist 4 item M12 still needs a human click because WebGL hit tests
cannot be asserted automatically. What remains is executing a run with NVDA and JAWS and recording it.
This is the difference between "the automated scans pass" and "here is how Section 508 evidence is
produced".

### 7. Optional IaC for the documented AWS target

C4 diagrams and the modernization narrative exist. Terraform or CDK for the documented target is still
open (P4 / PI 6.1).

### 8. Dependency, contract and platform cleanup

Move NgRx to stable 22 when published, revisit generated controller interfaces when Spring 7 support
lands, cover `JdbcSyncJobStore` with Testcontainers, and add typed API error responses where the
contract still returns generic failures. On the platform side: decide whether the e2e suite gets its
own workflow or a nightly schedule, and whether `main` gets branch protection — the latter interacts
with the current direct-to-main workflow and is a governance choice rather than a fix.

### Delivered since this list was last written

- **Interview demo package.** Demo script, ingestion, accessibility-evidence and mapping walkthroughs,
  and a tradeoffs record all exist under [documentation/demo](../documentation/demo).
- **Preservation.** 76 mirrored files, 1.00 GiB, and four measured pipeline figures on the Evidence
  page. Tracked as P10.
- **Open Science research objects.** Types, typed relations, access levels, license, DOI, researcher
  identity, four DSpace collections, and one worked research package. Tracked as P11 and described in
  [open-science-research-objects.md](../documentation/open-science-research-objects.md).
- **Continuous integration.** The repository had no `.github` directory; every gate ran only where
  someone typed the command. Tracked as P13.
- **Live commuting flows.** Aggregated from the published LODES origin-destination file rather than a
  stored sample, which understated the largest North Dakota flow by 16x. Tracked as P14.
- **Planning reconciled.** Eight TODO items and two acceptance criteria described work that was
  already delivered — including the TIGER/Line adapter the first sync slice runs on.

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

The slice above is **delivered**. Further work extends ingestion breadth and demo artifacts rather than repeating it.

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

Status: delivered.

Primary goal: create a Java backend that is contract-first from day one.

Decisions closed: Gradle in a container image, Java 21, DSpace 9.0 images, OpenAPI Generator Gradle plugin for model DTOs. Still open: the Nx Java plugin, and generated Spring controller interfaces once the generator supports Spring 7.

Implementation order:

1. Add Java build wrapper and Nx target integration.
2. Generate or scaffold `apps/repository-api`.
3. Generate Java DTOs from OpenAPI.
4. Add controller interfaces for search, datasets, maps, and accessibility evidence.
5. Add sync orchestration interfaces and sync-state DTOs.
6. Add mock service implementations returning seeded fixtures.
7. Add backend validation and API tests.

## Phase 2 - DSpace, PostgreSQL, and Solr

Status: delivered.

Primary goal: start the local repository platform through Docker.

The read path from DSpace through Solr projection to Angular is live. The fixture catalog survives only as a labelled fallback when the repository is unavailable.

Implementation order:

1. Select DSpace-supported Docker baseline.
2. Add Docker Compose services for PostgreSQL, Solr, and DSpace REST.
3. Add local environment sample.
4. Add persistent Docker volumes for DSpace assets, PostgreSQL, Solr, and small-to-medium mirrored demo artifacts.
5. Create seed community, collection, and visual geospatial North Dakota item from TIGER/Line or LODES.
6. Run startup sync when the app starts.
7. Verify DSpace REST access. Completed for the DSpace profile on `http://localhost:8081/server/api`.
8. Verify Solr discovery indexing.

Storage rule: store metadata, manifests, source links, checksums where available, small fixtures, and small-to-medium mirrored demo artifacts. Do not mirror large public datasets until a later sprint explicitly needs that behavior.

## Phase 3 - Angular Discovery UI

Status: delivered against repository-backed data.

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

Layer toggles, per-area layer resolution, list-to-map selection, and optional map debug diagnostics (`environment.mapDebugEnabled`) are implemented and covered by storyboard checks.

Implementation order:

1. Decide MapLibre GL vs Leaflet based on Census/USGS layer formats.
2. Build MapLibre GL map shell, layer controls, legend, attribution, and feature list.
3. Add TIGER/Line or LODES sample layer.
4. Add USGS earthquake overlay.
5. Add accessible non-map representation and synchronized selection state.

## Phase 5 - Demo Evidence Package

Status: in progress. Automated evidence and architecture diagrams are delivered; spoken walkthrough scripts are not.

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
