# Platform Evolution

This document preserves the delivered story that was previously mixed into the active roadmap and TODO list.

## Baseline workspace

The repository began as an Nx/Angular/OpenAPI demonstration with accessibility and Docker requirements defined before the full backend existed.

Delivered foundations:

- Angular 22, Material, NgRx and RxJS,
- Nx workspace orchestration,
- Java 21 / Spring Boot,
- OpenAPI-generated TypeScript and Java DTOs,
- Playwright, axe-core and component accessibility testing,
- Docker Compose service definitions.

## Repository-backed vertical slice

The first North Dakota TIGER/Line slice established the architectural rules that remain in place:

- DSpace is the system of record,
- the browser calls only the Java API,
- application Solr is a rebuildable discovery projection,
- application operational state is separate from DSpace persistence,
- fixture data is explicitly labelled,
- synchronization supports dry-run, diff and idempotent apply.

## Breadth and preservation

The catalog expanded from a single dataset to broad Census/USGS coverage across states, territories and national programs. Generated SAF packages replaced hand-authored directory copies. Source verification, vintage checks, inventory measurement and bounded bitstream mirroring added a defensible preservation story.

The Evidence page now separates subscribed, mirrored/stored, curated and indexed measures instead of collapsing them into one “data size” claim.

## Open Science research objects

The platform moved beyond a dataset shelf by adding:

- publications,
- methodology and projects,
- authors and DOI metadata,
- access levels and access notes,
- public and restricted objects,
- typed relationships,
- type-aware discovery and detail views,
- multiple DSpace collections.

A worked LEHD/LODES package connects real publications, methodology, public data and restricted microdata without pretending restricted files are downloadable.

## Discovery experience

Discovery evolved to include:

- repository-backed facets,
- all-program defaults,
- paging and URL state,
- Type and Year facets,
- eDisMax relevance and phrase boosts,
- searchable authors, subjects, citations and DOI metadata,
- explicit result provenance,
- a path from geographic workforce discovery to the map workspace.

## Federated metadata foundation

PR #3, `Start PI-1 federated metadata catalog foundation`, merged on August 30, 2026. It expanded the authority model without weakening the original repository rules:

- DSpace remains authoritative for curated repository objects,
- external publishers remain authoritative for federated records,
- application PostgreSQL stores reproducible federated metadata and harvest evidence,
- Solr and OpenSearch remain derived search projections.

The delivered federation foundation added:

- controlled per-record `origin` and `sourceSystem` provenance,
- data-driven `programName`/publisher facets while retaining curated `ResearchProgram` compatibility,
- namespaced federated identity,
- JDBC federated metadata persistence with bounded batches,
- durable harvest runs, opaque checkpoints, restart/resume/cancel semantics and quarantine,
- typed retry/permanent failure handling and bounded `Retry-After` awareness,
- bounded deterministic snapshots for intentionally paused scale checkpoints,
- a combined DSpace + federated discovery catalog,
- bounded streaming deterministic projection into Solr and OpenSearch,
- guarded snapshot -> projection linkage with drift rejection and durable evidence history,
- canonical `/research/:id` detail routing across repository and federated origins while retaining `/datasets/:id` compatibility,
- federated detail messaging that preserves publisher authority and does not invent locally stored files,
- corpus/storage evidence views and persistent local-storage measurements,
- mixed-origin browser and accessibility coverage.

The first live Data.gov proof accepted 1,000/1,000 records with no rejects/skips, persisted a deterministic bounded snapshot, linked it to a deterministic 1,181-object mixed search projection and verified the ordinary public search/facet path. The earlier adapter version's 75 quarantined date-only `modified` values were retained as regression evidence and drove a versioned normalization fix rather than being hidden.

PI-1 scale work then moved to a fresh branch instead of extending the large foundation PR. The first 10K invocation resumed the same durable Data.gov run from 1K to 10K—100 total pages, 10,000 accepted, 0 rejected and 0 skipped—proving the resume path before the remaining 10K snapshot/projection/storage/resource evidence is captured.

## Geospatial research views

The map evolved from a visual overlay demo into an accessible research view combining:

- TIGER/Line boundaries,
- LODES workplace employment,
- LODES commuting flows,
- SAIPE context,
- USGS hydrography,
- USGS earthquakes,
- synchronized visual and nonvisual selection,
- URL state, attribution, methodology and fallback provenance.

## Accessibility evidence

Accessibility work progressed from route-level axe scans to a layered evidence architecture:

- template lint prevention,
- component-state scans,
- browser semantics and axe,
- keyboard preconditions,
- contrast, reflow and zoom,
- forced-colors and dark-mode checks,
- map-equivalence tests,
- generated evidence records and drift checks,
- explicit manual keyboard, NVDA, JAWS, map and cognitive checklists.

The remaining accessibility work is execution and recording of manual evidence, not an unimplemented accessibility architecture.

## Documentation alignment

On August 20, 2026, the README, architecture, diagrams, demo script, accessibility plan, roadmap and TODO were realigned around the mature product model. A generated platform-status document and drift check were added so volatile facts no longer need to be copied manually across narrative documents.

On August 30, 2026, the PI-1 documentation was realigned again after the federation foundation merged and the live Data.gov path advanced to a proven 10K resumable harvest. The historical merge gate was closed, a living Data.gov scale-evidence record was added, and the active roadmap/backlog were narrowed to work that remains genuinely open.
