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

- MapLibre GL for vector-tile-oriented maps and modern rendering.
- Leaflet for simpler layer composition and broad plugin support.

The implementation decision should be made after confirming required layer formats from Census and USGS sources.
