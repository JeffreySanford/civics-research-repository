# Mapping and USGS Overlay Walkthrough

Deep dive for the maps workspace demo stop: layer toggles, accessible feature list, MapLibre worker behavior, fixture vs live data, and North Dakota default geography.

## Maps route

**URL:** http://localhost:4200/maps

Query parameters carry shareable state: selected Census area, visible layers, and selected feature id. Opening the map from a dataset detail page carries geography on the link so layers match the research object.

See [mapping-visualization.md](../mapping-visualization.md) for accessibility requirements and the list–map synchronization specification.

## Three layer toggles

The demo exposes three independently toggled groups:

| Toggle              | Type            | Content                                             |
| ------------------- | --------------- | --------------------------------------------------- |
| TIGER/Line boundary | Census boundary | State/tract preview geometry for the selected area  |
| LODES sample        | Census data     | Workplace area characteristics sample for the area  |
| USGS earthquakes    | USGS overlay    | Recent earthquake events from the FDSN GeoJSON feed |

**Show:** turning one layer off removes it from the map and legend together—the list and legend read from the same NgRx toggle state the renderer uses. Hiding earthquakes also clears the selection ring so no highlight remains on an empty canvas.

**Say:** Layer visibility is not cosmetic; it drives what the accessible feature list describes. Hiding a layer clears selection for features that belonged to it.

## Accessible feature list

Beside the MapLibre canvas, a focusable list enumerates features currently visible:

- Each entry is a control with a self-sufficient accessible name (place, magnitude, layer context).
- Activating or focusing a list entry pans the map and marks the feature selected without stealing focus from keyboard users.
- A polite live region announces the selected feature.
- Selection syncs to the URL for deep linking and restore on refresh.

This satisfies the Section 508 expectation that map information has a non-map equivalent. axe passing alone does not prove list–map equivalence; manual Checklist 4 item M12 (map-to-list focus) remains the highest-value open manual check.

## MapLibre worker and rendering

The UI uses **MapLibre GL** with a Web Worker for tile parsing and rendering:

- Main thread: Angular components, layer toggle controls, feature list, attribution panel.
- Worker: vector/raster tile decode and map draw calls.

Implications for the demo:

- Canvas content is not automatically in the accessibility tree—that is why the feature list exists.
- Trusted pointer events are required for map hit-testing; automated tests cover list-to-map direction; map-to-list is manual.
- Reduced-motion preferences should be honored for animated pans (see mapping-visualization requirements).

## Fixture vs live data

### Census layers (TIGER/Line, LODES)

Boundary and LODES sample layers use **fixture GeoJSON** bundled for local reliability. They represent the shape and labeling of real Census products without downloading full state shapefiles or LODES CSV archives into the browser.

Dataset metadata and source URLs still point to live census.gov and lehd.ces.census.gov files in DSpace.

### USGS earthquake overlay

The repository API fetches the live feed:

`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson`

When the feed fails or times out, the API returns a **bundled fixture** with `fallback: true` in the overlay response. The UI shows:

- Source and attribution outside the canvas.
- `updatedAt` and `staleAfter` timestamps.
- A visible fallback or stale-data state rather than silent old data.

**Show:** expand overlay metadata in the UI or call `GET /api/overlays/usgs/earthquakes?minMagnitude=2&days=7` and point out `fallback`, `sourceUrl`, and `attribution`.

## North Dakota default geography

Historical demo behavior opened the map centered on North Dakota with layers described for North Dakota regardless of URL area—a bug fixed in P10.

Current behavior:

- Default area on bare `/maps` is North Dakota (the first visual slice geography).
- Changing the Census area selector reloads layer definitions for that geography.
- Dataset detail **Open map workspace** links include geography so deep links open the correct state layers.

**Show:** switch area from North Dakota to Texas; TIGER/Line and LODES labels and feature list content change to match Texas while earthquake overlay remains national.

## Related API endpoints

| Endpoint                             | Purpose                                |
| ------------------------------------ | -------------------------------------- |
| `GET /api/maps/census-areas`         | Selectable area boundaries and extents |
| `GET /api/datasets/{id}/map-layers`  | Layer metadata for a dataset           |
| `GET /api/overlays/usgs/earthquakes` | Earthquake features and metadata       |

Types are generated from [repository-api.yaml](../../schemas/openapi/repository-api.yaml).

## Further reading

- [USGS National Map evaluation](../usgs-national-map-evaluation.md): 3DEP and 3HP reference overlay direction.
- [Architecture diagrams — map rendering sequence](../architecture-diagrams.md).
