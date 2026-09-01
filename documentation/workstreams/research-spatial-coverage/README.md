# Research Spatial Coverage Foundation

## Purpose

The million-record C2 corpus gives Civics Research Repository broad research metadata, but most federated records are not yet modeled with first-class spatial coverage. This workstream introduces a provenance-preserving spatial model before the UI begins drawing research objects on Maps.

The governing rule is simple:

> Map where the research says it applies, not where its publisher happens to live.

Publisher, laboratory, author or institution location must never be silently substituted for research coverage.

The source-by-source map opportunity analysis and recommended layer taxonomy are maintained in [DATA_LAYER_MATRIX.md](DATA_LAYER_MATRIX.md). That matrix separates administrative geometry, thematic measures, environmental context and research-object coverage so adding new sources does not recreate a flat agency-oriented toolbar.

## Proposed domain model

Introduce an engine-neutral spatial sidecar keyed by stable research-object identity. Keeping spatial enrichment separate from the immutable C2 composition prevents an enrichment pass from changing the already-certified corpus identity.

A coverage record should support:

- `ADMIN_AREA` — named/state/county/FIPS or another authoritative administrative geography;
- `POINT` — explicit publisher/source coordinates;
- `BBOX` — west/south/east/north bounds;
- `POLYGON` — later, when source semantics justify geometry storage.

Each coverage record should include:

- research object ID;
- coverage type;
- label;
- normalized geometry or administrative identifier;
- source system;
- source field/evidence reference;
- derivation method;
- source/update timestamp when available;
- enrichment timestamp/version;
- confidence/authority classification where useful.

## Derivation methods

At minimum distinguish:

- `PUBLISHER_SUPPLIED` — explicit spatial metadata from the authoritative source;
- `AUTHORITATIVE_GAZETTEER_MATCH` — a named geography resolved against an approved gazetteer/reference dataset;
- `DERIVED` — an explicit transformation with documented rules.

Do not add a generic title-text geocoder that silently turns arbitrary words into locations.

## Source strategy

### Curated repository metadata

The existing DSpace catalog already carries explicit administrative geography for area-scoped TIGER/Line, ACS PUMS and LODES research objects. That makes **Repository research by area** the first spatial research-coverage layer that can be implemented without a new publisher crawl or geocoding step. It is an aggregation of explicit catalog metadata, not an inferred subject footprint.

### Data.gov

Retain and normalize explicit DCAT spatial coverage where the source publishes it. Do not infer coverage from the publishing agency address.

The current retained Data.gov records preserve `harvestRecordRaw` references but the current adapter does not normalize `dcat.spatial`. Add a deterministic spatial-availability probe first, then use the retained raw-record references for a targeted enrichment pass rather than replaying the entire 500K catalog cursor crawl. Keep that enrichment in the spatial sidecar so the certified C2 corpus identity does not change accidentally.

### DOE OSTI

Keep bibliographic records unmapped unless a record contains authoritative research/site/geospatial coverage. DOE laboratory location is not a substitute for the content's coverage.

### NASA Earthdata CMR

CMR is the strongest near-term federated spatial source. Build on the existing collection harvester and add collection/granule spatial and temporal semantics deliberately. Granules should be modeled distinctly rather than silently changing collection semantics. Prefer a pinned/documented UMM JSON representation when extending the adapter so collection spatial geometry has an explicit publisher contract.

### PubMed / OpenAlex

Institution/affiliation geography may be useful as a separate relationship dimension later, but it must not be labeled as research coverage unless the source actually provides research geography.

## Shared administrative geometry

Before multiplying county choropleths, introduce a reusable administrative-geometry boundary backed by authoritative TIGER/Line or Census cartographic geometry.

It should support stable join keys for:

- state/territory FIPS;
- county/county-equivalent FIPS;
- PUMA code;
- tract GEOID for bounded/on-demand cases.

Thematic services should return values keyed by those identifiers rather than constructing their own polygons. This allows SAIPE, Population Estimates, County Business Patterns, Business Dynamics Statistics, Building Permits and later ACS-derived measures to share the same geometry, accessibility and selection behavior.

The existing generated county rectangles used as SAIPE fallback are demo scaffolding, not the geometry contract for future layers.

## Storage and projection

Spatial coverage should be durable application-owned metadata/evidence, not search-engine authority.

Search indexes may project spatial fields for filtering/aggregation, but the application-owned coverage record remains the evidence source.

The existing C2 retained corpus/composition/projection identities should remain unchanged unless a future explicitly versioned research corpus chooses to make spatial coverage part of its semantic identity.

## API direction

Provide typed read APIs suitable for the following workstream without sending unbounded research objects to the browser:

- coverage by research-object ID;
- bounded coverage summaries by query/filter/admin area;
- viewport/bounds-limited feature retrieval;
- source/type/provenance breakdowns.

Thematic county/PUMA measures should use a separate reusable value contract joined to shared administrative geometry; do not force population/payroll/poverty values and research-object footprints into one ambiguous schema.

## Accessibility

Spatial coverage is not complete merely because geometry draws in MapLibre.

Every meaningful map value must have a semantic equivalent through shared application state:

- area/count summaries in lists/tables;
- research-object links;
- provenance/derivation text;
- stale/unavailable state where applicable;
- keyboard selection that does not require canvas interaction.

## Evidence

Required evidence includes:

- domain validation tests for each coverage type;
- rejection of invalid coordinate/bbox shapes;
- provenance/derivation preservation;
- deterministic gazetteer resolution where used;
- proof that publisher location is not silently mapped as coverage;
- source-specific fixture tests;
- OpenAPI/generated-contract checks;
- accessibility tests for exposed spatial metadata;
- geometry/value join tests using stable administrative identifiers;
- proof that fallback/demo geometry is visibly disclosed and cannot masquerade as authoritative boundary geometry.

## Exit criteria

1. Spatial coverage has a typed, provenance-preserving model.
2. Spatial enrichment can evolve without mutating the certified C2 composition by accident.
3. Shared authoritative administrative geometry exists for the first thematic layers.
4. Curated repository geography can drive a bounded research-by-area summary.
5. Data.gov/NASA source-specific mappings have committed fixtures and explicit rules.
6. Research coverage can be queried in bounded form for Maps.
7. No source is mapped from publisher/institution location without explicit semantics.
