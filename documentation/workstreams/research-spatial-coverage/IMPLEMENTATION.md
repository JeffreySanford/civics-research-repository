# Implementation

## Completed foundation

### AdministrativeGeometryService

The shared county-geometry service is implemented before additional thematic choropleths are added.

Current behavior:

1. Validate a two-digit state FIPS and an explicitly supported geometry vintage.
2. Query the matching Census TIGERweb county layer as GeoJSON.
3. Request stable county fields and WGS84 geometry.
4. Validate the response as a non-empty FeatureCollection.
5. Validate each county GEOID, state binding, uniqueness, and Polygon/MultiPolygon geometry.
6. Sort features deterministically by GEOID.
7. Cache successful responses by geometry vintage and state FIPS.
8. Return defensive copies to callers.
9. Fail explicitly on network, publisher, validation, or unsupported-vintage errors.

There is intentionally no synthetic geometry fallback.

Supported county vintages in this slice:

- 2023 for SAIPE 2023 joins;
- 2025 for current county-boundary consumers.

### SAIPE migration

The SAIPE choropleth follows this flow:

```text
selected geography
  -> state FIPS
  -> retained SAIPE 2023 county values
  -> AdministrativeGeometryService(state FIPS, 2023)
  -> join by county GEOID
  -> GeoJSON features with SAIPE measures + authoritative polygons
```

A retained SAIPE GEOID that has no matching authoritative geometry is an error. The service does not silently omit the value and does not invent a polygon.

### Layer capability truth

Maps controls are capability-aware. Unsupported SAIPE controls are not advertised for a selected geography, category counts reflect currently available children, and collapsing a category never changes checked child state.

## Data.gov research spatial sidecar

The research-coverage model is now implemented as a versioned application-owned sidecar rather than a future placeholder.

The active Data.gov sidecar:

- is keyed to retained C2 Data.gov source identifiers;
- records source snapshot/capture time, C2 composition SHA-256, and active projection identity;
- stages rebuilds before atomic activation so a failed refresh cannot replace the previous active build;
- preserves current Data.gov source provenance independently from the immutable certified C2 corpus identity;
- retains geospatial source matches even when publisher geometry is absent;
- distinguishes `VALID`, `ANTIMERIDIAN_CANDIDATE`, `NO_PUBLISHER_GEOMETRY`, and `QUARANTINED` states;
- stores full publisher `spatial_shape` GeoJSON where safe instead of manufacturing geometry;
- preserves source centroid and raw `dcat.spatial` evidence without treating either as canonical polygon semantics;
- never substitutes publisher, laboratory, author, or institution locations for research coverage.

The measured geometry census justified retaining publisher GeoJSON directly for the current Data.gov population; PostGIS/simplification tiers are not required for this slice.

## Bounded Research Spatial API

`GET /maps/research-coverage` is the scale-control boundary between the active sidecar and Maps.

The endpoint:

- reuses Discovery criteria instead of defining a second search language;
- binds each response to one active sidecar build and projection identity;
- requires a WGS84 viewport;
- reports matching, mapped, unmapped, quarantined, antimeridian, viewport, omitted, and truncation counts explicitly;
- returns only a deterministic bounded feature set;
- defaults to 200 returned features with a hard maximum of 500;
- treats antimeridian candidates through explicit safe render anchors rather than naïve world-spanning envelopes;
- never sends the complete sidecar population to the browser.

See [BOUNDED_RESEARCH_SPATIAL_API.md](BOUNDED_RESEARCH_SPATIAL_API.md) for the complete contract.

## Research Coverage Maps UI

Maps now renders the bounded Data.gov publisher research geometry directly.

Implemented behavior:

- effective Discovery criteria are preserved when entering Maps;
- the selected Census boundary provides an accessible initial viewport before WebGL is available;
- MapLibre `moveend` events refresh the bounded spatial request once the interactive map is active;
- request fingerprints suppress duplicate viewport requests;
- NgRx latest-request semantics prevent stale responses from replacing newer state;
- ordinary publisher geometry renders through fill, line, and point MapLibre layers;
- antimeridian candidates render only through their explicit safe source-derived anchor;
- missing or quarantined publisher geometry remains visible in semantic counts rather than disappearing;
- truncation and omitted-feature counts are stated explicitly;
- the semantic Research Coverage table exposes the same bounded research-object set returned to MapLibre.

The browser therefore receives only the current bounded feature set, not hundreds of thousands of sidecar rows.

## Accessibility and evidence

Research Coverage follows the repository's map-equivalence rule: MapLibre is not the sole information channel.

The extracted semantic Research Coverage component provides:

- mapped/unmapped/quarantined counts;
- viewport and truncation status;
- source/projection/build provenance;
- research object title, publisher, program/type, geometry semantics, and source link;
- a meaningful empty-viewport state;
- loading/status text independent of canvas rendering.

Automated evidence includes:

- direct axe unit coverage;
- Storybook states for loading, populated/truncated, empty viewport, no publisher geometry/antimeridian evidence, and no response;
- global Storybook addon-a11y enforcement;
- Storybook interaction test-runner evidence;
- Playwright proof that Discovery criteria and WGS84 viewport reach the bounded API;
- Chromium MapLibre visibility evidence for the publisher fill/line/point layer group;
- regression coverage that category disclosure remains presentation-only.

Manual screen-reader, keyboard, focus-path, forced-colors, and other dated Section 508 evidence remain separate release evidence and are not replaced by automated axe/browser checks.

## Reuse path

The shared administrative-geometry boundary remains the correct basis for thematic county/PUMA/tract values, while explicit research footprints use the separate sidecar/bounded-spatial contract.

Next thematic candidates remain:

1. Population Estimates county values.
2. County Business Patterns county values and industry configuration.
3. Business Dynamics Statistics.
4. Building Permits.

For Research Coverage, NASA CMR collection spatial extent is the strongest next source. Collection and granule coverage must remain separate concepts, and granule results must be bounded by collection, viewport and/or time before reaching the browser.

Spatial enrichment must continue to preserve the certified C2 corpus composition and projection identity rather than rewriting the Gold Master merely to make records mappable.
