# USGS 3DEP terrain

Issue: #68

## Goal

Add authoritative terrain context that materially improves map orientation while remaining visually subordinate to thematic/research overlays and without introducing a new local elevation-data pipeline.

## Source decision

Use the USGS 3D Elevation Program Bare Earth DEM dynamic service or an equivalent authoritative USGS 3DEP service endpoint approved by the repository API boundary.

USGS supports dynamic terrain renderings including:

- hillshade;
- tinted hillshade;
- slope;
- aspect;
- contours.

This slice should use the service directly through the repository's existing proxy/boundary pattern rather than downloading nationwide DEM data.

## User model

One conceptual checkbox:

> USGS terrain

Configuration belongs inside the layer.

### Visualization mode

Initial modes:

1. **Hillshade** — default; neutral geographic context.
2. **Tinted elevation** — optional terrain/elevation visualization.
3. **Slope** — optional analytic terrain context.

Do not expose separate permanent checkboxes for each rendering mode.

An opacity control is optional. Add it only if it can be implemented cleanly with keyboard support, meaningful labeling, URL/state behavior where appropriate, and without cluttering the layer panel.

## Rendering hierarchy

Terrain is context, not the primary thematic value.

Recommended draw order:

```text
OSM/base map
USGS terrain context
administrative boundaries
community/economy choropleths
research extents / event points / commuting flows
selection/highlight layers
```

The default hillshade opacity should be low enough that county choropleths, points, flows, labels, and selection states remain readable.

## Browser/API boundary

Follow the same principle as the existing hydrography implementation:

```text
Angular / MapLibre
        |
        | repository API tile/image contract
        v
repository API
        |
        v
USGS 3DEP dynamic service
```

The browser should not need:

- source credentials;
- ArcGIS/USGS-specific URL construction knowledge beyond the generated application contract;
- nationwide DEM storage;
- source-specific retry policy.

The repository API should own service URL construction/validation, permitted modes, attribution, and any source-specific query normalization.

## State

NgRx/UI state should expose at least:

- visible;
- selected visualization mode;
- loading/available/error as required by the existing layer model.

Mode should persist across hide/show toggles. If Maps URL state already captures comparable configuration, terrain mode should round-trip there too.

## Failure behavior

A remote raster service must fail safely.

- Maps remains usable when 3DEP is unavailable.
- The terrain checkbox/configuration exposes an explicit service failure or unavailable state.
- Existing thematic/research overlays continue to render.
- Do not replace authoritative terrain with synthetic imagery.
- Repeated source failures should not flood the browser with redundant announcements.

## Accessibility

Terrain itself is contextual raster imagery, so no attempt should be made to invent a pixel-by-pixel semantic elevation equivalent in this slice.

Accessibility requirements instead cover the user-facing state and purpose:

- layer toggle has a meaningful accessible name;
- visualization mode controls are keyboard operable and report selected state;
- semantic layer status identifies source, mode, visibility and failure state;
- the app explicitly treats terrain as visual context rather than the sole carrier of research meaning;
- forced-colors mode preserves controls and thematic semantic equivalents even if the terrain raster is not useful visually;
- reflow keeps the terrain controls usable at 320px.

## Tests

### Repository API

- supported mode validation;
- service URL construction/normalization;
- attribution metadata;
- invalid mode rejection;
- remote failure propagation without synthetic fallback.

### Angular/component

- layer toggle/state persistence;
- mode changes;
- loading/error status;
- interaction with other visible layers;
- optional opacity control if implemented.

### Storybook/axe

- hidden;
- hillshade visible;
- tinted elevation;
- slope;
- service loading;
- service failure;
- forced-colors/reflow-representative controls.

### Playwright

- 3DEP source/layer registers in Chromium;
- visibility toggles correctly;
- mode switching changes the source/render request or layer configuration deterministically;
- geography/pan state is preserved;
- thematic overlays remain visible/operable over terrain;
- service failure does not break Maps;
- cross-browser semantic controls remain accessible even where raw WebGL/raster proof stays Chromium-scoped.

## Non-goals

- no local nationwide DEM ingestion;
- no 3D extrusion/flyover UI;
- no contour-vector generation pipeline;
- no elevation-profile analysis;
- no claim that raster imagery is itself an accessible data table;
- no C2/C2.1 corpus or benchmark changes.

## Exit criteria

- default hillshade materially improves geographic orientation;
- terrain remains subordinate to thematic/research layers;
- source/mode/attribution/failure state are explicit;
- no bulk elevation pipeline is introduced;
- controls and semantic status meet the Maps accessibility contract;
- normal Maps/browser/accessibility gates pass.
