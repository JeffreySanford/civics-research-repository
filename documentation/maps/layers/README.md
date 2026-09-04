# Maps layer roadmap

This folder is the durable planning home for the final Maps implementation slices and later layer candidates.

## Final implementation sequence

The recommended order is deliberate:

1. [Data.gov research extents](DATA_GOV_RESEARCH_EXTENTS.md) — issue #66
   - fix the current low-value polygon carpet without changing the certified search corpus;
   - make the visual semantics match what Data.gov spatial metadata actually says.
2. [Vintage 2025 county Population Estimates](POPULATION_ESTIMATES.md) — issue #67
   - prove the reusable county-thematic architecture with a second Census measure beyond SAIPE;
   - reuse authoritative county geometry and stable GEOID joins.
3. [USGS 3DEP terrain](USGS_3DEP_TERRAIN.md) — issue #68
   - add high-value visual terrain context without reopening bulk-data ingestion.

Deferred candidates live in [BACKLOG.md](BACKLOG.md) and issue #69. They are intentionally not prerequisites for completing the three slices above.

## Shared design rules

### Organize by research purpose

Maps categories describe what a user is trying to understand, not which publisher supplied the data:

- Geography & Boundaries;
- Community & Economy;
- Environment & Hazards;
- Research Coverage.

### One conceptual layer per checkbox

A checkbox answers only whether a conceptual layer is rendered. Variables such as measure, year, industry, topic, time window, source mode, and aggregation level belong inside the layer configuration rather than becoming permanent sibling checkboxes.

### Keep spatial semantics honest

- Publisher-declared research extent is not automatically a collection site or observation location.
- Publisher, laboratory, author, and institution locations are not research coverage.
- Administrative thematic values such as population or poverty are joined to authoritative geography by stable identifiers.
- Research footprints use their own bounded contract and are not forced into the same model as county thematic values.

### Reuse authoritative geometry

County thematic layers reuse `AdministrativeGeometryService` and stable county GEOIDs. New measures should add values, provenance, and configuration rather than another polygon implementation.

### Accessibility is part of the layer contract

Every meaningful visual layer must have an equivalent or complementary semantic representation. Contextual raster imagery such as terrain may remain visual context only, but its controls, selected state, source, failure state, and purpose must remain accessible without reading pixels.

All new layer controls must remain:

- keyboard operable;
- named and stateful in semantic HTML;
- usable under reflow/zoom and forced colors;
- covered by Storybook/axe and browser evidence appropriate to the layer type.

### Preserve the completed research program

These Maps slices do not change the certified C2/C2.1 corpus, search projection identity, treatment, workload, or accepted timing evidence. No accepted C2.1 timing run is repeated merely because a map layer changes.

## Completion definition

The final three slices are complete when:

- #66 replaces the uniform Data.gov polygon carpet with a clear bounded extent-selection experience;
- #67 adds a current county Population Estimates choropleth with authoritative geometry, provenance, and semantic equivalence;
- #68 adds service-backed USGS terrain that remains visually subordinate to thematic/research overlays;
- the existing Maps quality, accessibility, Storybook, and Playwright gates remain green;
- deferred ideas remain documented rather than silently expanding scope.

At that point Maps should read as a finished federal research/GIS experience rather than an inventory of every available data source.
