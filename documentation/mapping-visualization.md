# Mapping Visualization

## Goal

Build a usable geospatial discovery experience for public research datasets, with Census geography as the main dataset context and USGS overlays as environmental or reference context.

## Initial Map Experience

The first map should support:

- Dataset-driven map view from a dataset detail page.
- Layer toggles for Census and USGS overlays.
- Legend with clear units and source labels.
- Keyboard reachable controls.
- Non-color-only indicators.
- Accessible data summary outside the map.

## Candidate Census Layers

- TIGER/Line state, county, tract, and ZCTA geometries.
- LODES employment data summarized by geography.
- ACS geography-linked indicators in a later phase.

## Candidate USGS Overlays

- Recent earthquake events.
- Hydrography or water reference layers.
- Elevation/topographic reference layers.

## USGS Attribution And Freshness

USGS-authored data is generally public domain, but the platform should still acknowledge USGS as the source. The current earthquake overlay uses:

- Attribution: `U.S. Geological Survey Earthquake Hazards Program`.
- Source URL: `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson`.
- Source label: `USGS Earthquake Catalog GeoJSON`.

Overlay responses must carry normalized metadata alongside map features:

- `source`: human-readable feed or fixture name.
- `sourceUrl`: stable public URL for the source or query family.
- `attribution`: visible credit line for UI and exports.
- `updatedAt`: time the source response or fallback fixture was generated.
- `staleAfter`: time after which the UI should warn that the overlay may be stale.
- `fallback`: whether local fallback data is being shown.
- `query`: filter and bounding-box values used to request the overlay.

The map must show attribution and update/freshness status outside the canvas so the same information is available to keyboard and screen-reader users. If the live USGS request fails, the UI can keep Census and LODES layers visible while showing an overlay-unavailable or fallback state.

References:

- [USGS Copyrights and Credits](https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits)
- [Acknowledging or Crediting USGS](https://www.usgs.gov/information-policies-and-instructions/acknowledging-or-crediting-usgs)

## Visualization Scenarios

### LODES Employment With USGS Context

Show LODES employment patterns for North Dakota and allow a USGS contextual overlay such as hydrography or recent earthquake events.

### TIGER/Line Boundary Preview

Show a dataset landing page for TIGER/Line Census tracts and render a preview map with boundaries, source metadata, and download links.

### Research Object Map Tab

Dataset detail tabs:

```text
Overview | Files | Metadata | Versions | Map | Citation
```

The `Map` tab should be available only when the research object has geospatial metadata.

## Accessibility Requirements

Maps are visual and interactive, so the UI must provide equivalent access to the underlying information:

- Keyboard access to layer controls and feature list.
- Visible focus states.
- Text summary of selected geography, filters, and visible layer counts.
- Accessible table of mapped features.
- Non-color-only legend labels.
- Sufficient contrast for boundaries, symbols, and labels.
- Reduced motion behavior for animated transitions.
- Clear source attribution.

## Candidate Libraries

Use MapLibre GL first for vector-tile-oriented maps and modern rendering.

Leaflet remains a possible later comparison implementation behind a small map-engine adapter if there is a concrete reason to show both. Do not build both engines in the first slice; it would double rendering, testing, and accessibility work before the core repository workflow is proven.
