# Research Spatial Coverage Foundation

## Purpose

The million-record C2 corpus gives Civics Research Repository broad research metadata, but most federated records are not yet modeled with first-class spatial coverage. This workstream introduces a provenance-preserving spatial model before the UI begins drawing research objects on Maps.

The governing rule is simple:

> Map where the research says it applies, not where its publisher happens to live.

Publisher, laboratory, author or institution location must never be silently substituted for research coverage.

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

### Data.gov

Retain and normalize explicit DCAT spatial coverage where the source publishes it. Do not infer coverage from the publishing agency address.

### DOE OSTI

Keep bibliographic records unmapped unless a record contains authoritative research/site/geospatial coverage. DOE laboratory location is not a substitute for the content's coverage.

### NASA Earthdata CMR

CMR is the strongest near-term spatial source. Build on the existing collection harvester and add collection/granule spatial and temporal semantics deliberately. Granules should be modeled distinctly rather than silently changing collection semantics.

### PubMed / OpenAlex

Institution/affiliation geography may be useful as a separate relationship dimension later, but it must not be labeled as research coverage unless the source actually provides research geography.

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
- accessibility tests for exposed spatial metadata.

## Exit criteria

1. Spatial coverage has a typed, provenance-preserving model.
2. Spatial enrichment can evolve without mutating the certified C2 composition by accident.
3. Data.gov/NASA source-specific mappings have committed fixtures and explicit rules.
4. Research coverage can be queried in bounded form for Maps.
5. No source is mapped from publisher/institution location without explicit semantics.
