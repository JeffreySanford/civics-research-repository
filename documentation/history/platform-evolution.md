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
