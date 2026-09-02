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
7. Cache successful results by geometry vintage and state FIPS.
8. Return a defensive copy to callers.
9. Fail explicitly on network, publisher, validation, or unsupported-vintage errors.

There is intentionally no synthetic geometry fallback.

Supported county vintages in this slice:

- 2023 for SAIPE 2023 joins;
- 2025 for current county-boundary consumers.

### SAIPE migration

The SAIPE choropleth now follows this flow:

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

`MapLayerService` asks `SaipeCountyChoroplethService.supportsGeography()` before advertising the SAIPE child layer. This keeps map metadata aligned with what the service can actually serve.

## Immediate UI follow-up

The dataset-layer API is now truthful, but the standalone Maps control family is still largely static. The next UI slice should make layer controls capability-aware for the selected geography.

For SAIPE specifically:

- supported geography: show the SAIPE child control;
- unsupported geography: do not render the SAIPE child control;
- switching geography while a now-unsupported layer is selected must clear or reconcile that state accessibly;
- category counts must reflect the currently available children;
- the category itself should disappear only when it has no available children.

Do not leave unsupported controls permanently disabled merely to advertise planned functionality.

## Reuse path

After capability-aware controls, reuse the same administrative-geometry boundary for:

1. Repository research-by-area summaries.
2. Population Estimates county values.
3. County Business Patterns county values.
4. Business Dynamics Statistics.
5. Building Permits.

PUMA and tract geometry should be added only when a concrete bounded consumer requires them.

## Future research spatial sidecar

The larger research-coverage model remains a later phase rather than a merge blocker for this foundation PR.

That phase should add:

- typed coverage records keyed by stable research-object ID;
- application-owned persistence;
- source field/evidence references;
- derivation method and enrichment version;
- source-specific Data.gov and NASA fixtures;
- bounded APIs for summaries/features;
- optional search projections only after domain/storage evidence is stable.

Spatial enrichment must not silently alter the certified C2 corpus composition or projection identity.