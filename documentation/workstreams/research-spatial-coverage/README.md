# Research Spatial Coverage Foundation

## Purpose

This workstream establishes the authoritative geography boundary needed before Civics Research Repository expands its thematic and research-coverage maps.

The governing rule is:

> Map where the data or research says it applies, not where its publisher happens to live.

Publisher, laboratory, author, or institution location must never be silently substituted for research coverage.

## Implemented in this pull request

### Shared county geometry

`AdministrativeGeometryService` provides reusable Census TIGERweb county geometry keyed by stable Census GEOIDs.

The service:

- supports explicit county geometry vintages instead of silently using the newest boundaries;
- currently supports January 1, 2023 and January 1, 2025 county geometry;
- requests GeoJSON in WGS84 (`outSR=4326`);
- validates state FIPS, county GEOIDs, duplicate GEOIDs, and Polygon/MultiPolygon geometry;
- returns counties in deterministic GEOID order;
- caches successful responses by `(vintage, stateFips)`;
- returns defensive copies from the cache;
- never falls back to generated rectangles when authoritative geometry is unavailable.

### SAIPE geometry hardening

`SaipeCountyChoroplethService` now joins retained 2023 SAIPE values to matching 2023 Census county geometry by GEOID.

The service no longer generates rectangular county cells. A retained SAIPE value without matching authoritative county geometry fails explicitly instead of being dropped or rendered with invented geometry.

The response records both thematic and geometry provenance, including:

- thematic vintage;
- geometry vintage;
- Census geometry source URL;
- Census geometry attribution;
- SAIPE source URL and attribution.

### Capability truth

`MapLayerService` advertises the SAIPE layer only where this repository actually retains SAIPE values. The current retained fixture supports North Dakota, California, and Texas; other geographies are not presented as SAIPE-capable merely because the upstream program exists.

## Architectural boundaries

Thematic values and geometry remain separate authorities:

- thematic services own measures and value provenance;
- `AdministrativeGeometryService` owns administrative geometry retrieval and validation;
- joins happen through stable geography identifiers such as state FIPS and county GEOID.

This boundary is intended to be reused by Population Estimates, County Business Patterns, Business Dynamics Statistics, Building Permits, and later administrative research-coverage summaries.

The application must not create a separate polygon implementation for every thematic measure.

## Research coverage semantics

The broader spatial roadmap still distinguishes thematic geography from research-object coverage.

A future application-owned spatial sidecar may represent explicit research coverage such as:

- authoritative administrative areas;
- publisher-supplied points;
- bounding boxes;
- polygons when source semantics justify them.

That future model must preserve source evidence and derivation method and must not mutate the certified C2 corpus identity merely because spatial enrichment evolves.

Useful derivation classes include:

- `PUBLISHER_SUPPLIED`;
- `AUTHORITATIVE_GAZETTEER_MATCH`;
- explicitly documented `DERIVED` transformations.

Do not add a generic title-text geocoder that turns arbitrary words into locations.

## Source strategy

### Curated repository metadata

Existing area-scoped TIGER/Line, ACS PUMS, and LODES metadata can support a first **Repository research by area** summary without a new publisher crawl. The value means matching repository/search objects whose metadata explicitly names the area; it does not claim that every publication scientifically covers the entire administrative area.

### Data.gov

Use explicit DCAT spatial metadata when present. The current retained records preserve raw-harvest references, so a future deterministic spatial-availability probe and targeted enrichment can use those references without replaying the entire certified 500K catalog crawl.

### DOE OSTI

Do not map laboratory, sponsor, or publisher location as research coverage. OSTI records should remain unmapped unless authoritative content/site/spatial coverage is actually supplied.

### NASA CMR

CMR is a strong future federated spatial source because collection and granule records have explicit spatial semantics. Collection coverage and granule coverage must remain distinct concepts and should use a pinned/documented publisher representation.

### PubMed and OpenAlex

Institution or affiliation geography may become a separate analytic relationship view later, but it must not be labeled research coverage unless the source actually provides research geography.

## Maps taxonomy

The stable research-purpose taxonomy is:

1. **Geography & Boundaries** — administrative geometry used to orient and join measures.
2. **Community & Economy** — workforce, poverty, population, business, and housing measures.
3. **Environment & Hazards** — hydrography, terrain, and event/hazard context.
4. **Research Coverage** — where research objects explicitly say they apply and administrative summaries of matching repository/search objects.

Only show a child layer when its backing capability is actually available. Planned layers should not appear as permanently disabled advertising.

## Accessibility

Authoritative geometry does not remove the existing map-equivalence requirements. Every meaningful map value must remain available through semantic HTML and shared application state.

New layers must preserve:

- keyboard-operable controls;
- textual measure, vintage, source, and provenance;
- semantic table/list equivalents for mapped values;
- color-independent meaning and selection;
- access that does not require panning, dragging, or canvas hit-testing;
- focus stability when selection changes.

## Next implementation sequence

1. Make the Maps control surface capability-aware so unsupported SAIPE controls are hidden for the selected geography.
2. Add **Repository research by area** using already-retained explicit administrative metadata.
3. Reuse shared county geometry for Population Estimates.
4. Add County Business Patterns with measure/industry configuration.
5. Add Business Dynamics Statistics and Building Permits.
6. Add a deterministic Data.gov spatial-availability probe and targeted sidecar enrichment.
7. Extend NASA CMR collection mapping with explicit spatial extent, followed by bounded granule coverage.
8. Consider 3DEP terrain and PUMA/ACS-derived measures after the common geometry/value contracts are proven.

See [DATA_LAYER_MATRIX.md](DATA_LAYER_MATRIX.md) for the source-by-source rationale and sequencing.
