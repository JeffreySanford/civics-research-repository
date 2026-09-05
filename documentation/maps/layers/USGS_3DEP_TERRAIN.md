# USGS 3DEP terrain

Issue: #68

## Purpose

The Maps workspace uses the U.S. Geological Survey 3D Elevation Program (3DEP) as an orientation layer. Terrain is contextual imagery only: it helps a reader understand relief and landform without becoming the sole carrier of research, economic, demographic, or hazard meaning.

This slice is intentionally service-backed. It does not download, normalize, or retain a nationwide elevation corpus.

## Authoritative source

- Program: U.S. Geological Survey 3D Elevation Program
- Service: 3DEP Bare Earth DEM dynamic ImageServer
- Source service: `https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer`
- Attribution: `U.S. Geological Survey 3D Elevation Program`

The application exposes three visualization choices from the upstream service:

| Application mode | Upstream raster function |
| --- | --- |
| Hillshade | `Hillshade Gray` |
| Tinted elevation | `Hillshade Elevation Tinted` |
| Slope | `Slope Map` |

Hillshade is the default. Aspect, contours, and additional upstream renderings remain outside this slice.

## Browser/API boundary

The Angular application never constructs ArcGIS rendering rules and never calls the USGS ImageServer directly. `MapLayerService` advertises one generic `USGS_REFERENCE` capability with the stable ID `usgs-3dep-terrain` and a repository-owned tile template:

```text
/overlays/usgs/terrain/export?bbox={bbox-epsg-3857}&mode=hillshade
```

`UsgsTerrainTileService` translates the application mode to the allow-listed upstream raster function. Requests are bounded to the Web Mercator tile extent requested by MapLibre and fixed to a 256 by 256 PNG response.

An unknown visualization mode or malformed bounding box is rejected rather than forwarded upstream. An upstream I/O, HTTP, or non-image failure is exposed as service unavailable instead of being disguised as valid transparent terrain.

The browser therefore does not need:

- source credentials;
- ArcGIS raster-function grammar;
- nationwide DEM storage;
- source-specific retry or fallback policy.

## State and capability model

Terrain remains one conceptual layer, not three permanent checkboxes.

NgRx owns:

- `terrainVisible`, default `false`;
- `terrainMode`, default `hillshade`.

The URL persists the same state:

- `terrain=on|off`;
- `terrainMode=hillshade|tinted|slope`.

Changing Census geography does not reset terrain visibility or mode while the `usgs-3dep-terrain` capability remains available.

Hydrography and terrain both intentionally use the existing `USGS_REFERENCE` layer type. Frontend selectors therefore identify them by explicit stable IDs instead of assuming the first reference layer is hydrography.

## Cartography and draw order

The MapLibre source is `usgs-3dep-terrain` and the raster layer is `usgs-3dep-terrain-raster`.

The implemented hierarchy is:

```text
OSM/base map
USGS terrain context
administrative boundaries
community/economy choropleths
research extents / event points / commuting flows
selection/highlight layers
```

Terrain raster opacity is fixed at `0.42` for this slice so default Hillshade remains subordinate to the evidence-bearing overlays. An opacity control was not added because it is not needed to satisfy the orientation goal and would add another state dimension to the layer panel.

Mode switching replaces only the terrain raster source/layer and preserves the conceptual layer toggle.

## Failure behavior

A remote raster service fails explicitly and locally:

- invalid mode or bounding-box input is rejected;
- upstream terrain failure is surfaced as service unavailable;
- Maps and all non-terrain layers remain usable;
- no synthetic terrain or local bulk fallback is substituted;
- the semantic status identifies the terrain failure without claiming other map data failed.

## Accessibility

The raster pixels are never treated as a semantic elevation dataset. The accessible contract instead exposes:

- one named keyboard-operable `USGS 3DEP terrain` checkbox;
- one named visualization select when the layer is visible;
- semantic available/off/loading/ready/error/unsupported status;
- selected visualization mode in the semantic status and visible-layer legend;
- source attribution and link;
- explicit wording that terrain is contextual imagery only.

Forced-colors/high-contrast users continue to receive native checkbox/select state and textual semantic status. No terrain meaning depends on a color swatch, and research/thematic semantic equivalents remain independent of the raster.

## Automated evidence

Repository API coverage verifies:

- application mode allow-listing;
- upstream raster-function mapping;
- bounded export request construction;
- attribution/capability metadata;
- invalid input rejection;
- explicit service-unavailable behavior.

Angular unit coverage verifies:

- default Hillshade mode;
- strict mode parsing and stable labels;
- repository-proxy tile-template construction;
- deterministic mode replacement;
- NgRx visibility and mode state;
- capability removal behavior;
- terrain and hydrography remain distinct despite sharing `USGS_REFERENCE`;
- terrain is represented in the common map-debug layer groups.

Storybook provides available, loading, ready, error, and unsupported states with axe coverage. The first CI run containing the terrain stories completed all Storybook interaction suites successfully: 25 tests across 6 suites.

Playwright coverage is scoped to the issue's browser contract:

- keyboard operation and named controls;
- URL, legend, and semantic-status alignment;
- real MapLibre source/layer registration;
- hidden-to-visible state;
- deterministic Hillshade/Tinted elevation/Slope source replacement;
- visibility/mode persistence when Census geography changes.

Final PR readiness still depends on the repository's normal workspace and browser evidence gates.

## Research isolation

This feature does not change the accepted C2/C2.1 search corpus, Solr/OpenSearch projection identity, workload definitions, search timings, or statistical evidence. 3DEP terrain remains a Maps presentation capability outside that research experiment.

## Non-goals

- no local nationwide DEM ingestion;
- no 3D extrusion/flyover UI;
- no contour-vector generation pipeline;
- no elevation-profile analysis;
- no pixel-derived semantic elevation table;
- no additional permanent checkboxes for upstream rendering functions;
- no C2/C2.1 corpus or benchmark changes.
