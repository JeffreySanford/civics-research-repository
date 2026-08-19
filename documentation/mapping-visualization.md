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
- Hydrography or water reference layers from The National Map after the earthquake overlay is stable.
- Elevation/topographic reference layers from The National Map in a later advanced map slice.

The National Map evaluation is captured in [USGS National Map Evaluation](usgs-national-map-evaluation.md). The recommended follow-on path is a single hydrography reference overlay from the 3D Hydrography Program, rendered as a raster reference layer first and only expanded to WFS feature summaries if needed. Legacy NHD is retired and out of scope; the geospatial metadata schema targets 3HP specifications so layer toggles and legends are not built twice.

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

## Workforce View

Search and the map used to be two demonstrations sitting next to each other. A discovery search that
names a Census area now offers **Explore ‹area› workforce on the map**, which opens the workspace
already focused, with the layers the research question needs and the ones it does not turned off:

```
Discovery: "North Dakota workforce"
      |
      | geography facet -> North Dakota
      v
/maps?area=North Dakota&view=workforce&tiger=on&lodes=on&saipe=on
      &hydrography=off&earthquakes=off&q=North Dakota workforce
      |
      v
North Dakota Workforce Explorer
  TIGER/Line  geography
  LODES       workers and commuting
  SAIPE       socioeconomic context
```

Three decisions worth recording:

- **The area comes from the search response's geography facet, not from the rendered result cards.**
  Discovery decides what the query is about and tells the map; the map then fetches its own overlay
  data from the Maps API. A map that read its focus out of the visible list would change meaning
  when the reader paged. `United States` is excluded, because a national object is not a map extent.
- **The link names the area it will open.** "Explore North Dakota workforce on the map" leaves no
  question about where the reader is about to land.
- **Hydrography and earthquakes are explicitly off.** They are reference layers with nothing to say
  about workforce, and carrying them in would make the workspace a GIS sampler again.

The workspace also states its research context — area, the discovery query that led here, and which
data is active — with a link back to those search results. Without it the map opens with three
layers already on and no explanation, which reads as a default rather than a decision. A plain visit
to `/maps` is unchanged and keeps its generic identity.

### Two-way flow selection

The commuting flows are an accessible table, not a description of the map:

| Origin   | Destination | Workers |
| -------- | ----------- | ------- |
| Burleigh | Cass        | 1,240   |

Selecting a row highlights that flow on the map and fits the viewport to it. Clicking the flow on
the map selects the row and moves focus to it. Neither view writes to the other: the selection is a
single `selectedLodesFlowId` in the NgRx maps feature, and both the table and the map read it
through store selectors. The map applies it by subscribing to `selectSelectedLodesFlow` with
`takeUntilDestroyed`, the same contract the earthquake selection already used.

Three rules the reducer enforces, each of which would otherwise leave the two views disagreeing:

- **Reselecting the same row clears it.** Selection is state, not a one-way door.
- **Hiding the LODES layer drops the selection.** Otherwise the table announces a highlight nobody
  can see and the map holds one it is no longer drawing.
- **Loading a new overlay drops a selection it does not contain.** Flows are per-geography, so
  switching from North Dakota to Texas replaces the whole set.

The highlight is drawn as a heavier line above the base layer rather than by filtering the others
out: answering "where is this flow" by deleting its context is not an answer. The selected row is
marked with `aria-selected`, a background, and an inset border that survives forced-colors mode, so
the selection is never carried by colour alone.

Each selection has its own named live region — `Map feature selection` and `Commuting flow
selection`. They are independent, and sharing one status would have each overwrite the other's
announcement.

### Where the flows come from

Derived from the published LODES origin-destination file at request time, not stored:

```
{st}_od_main_JT00_2023.csv.gz
   -> block GEOID truncated to 5 characters = county FIPS
   -> summed by (home county, work county)
   -> intra-county pairs dropped
   -> largest 8 kept
   -> county names and centroids joined from the Census Gazetteer
```

Intra-county pairs are dropped because they are the largest numbers in the file and draw nothing: a
line from a county to itself is a dot. Cass County to Cass County is 87,272 jobs and says only that
most people work where they live.

**2023 is the newest vintage.** There is no LODES9 series and no 2024 OD or WAC file; verified
against the publisher. That is the ceiling for everyone, not a limit of this repository.

**Why this replaced the stored sample.** The committed sample put Morton to Burleigh at 520 workers.
The real 2023 figure is 8,615, and the sample ranked a different flow first. It was labelled a
sample and it was still misleading by an order of magnitude.

#### Three tiers, and the flag that says which

| Tier                                 | When                                                    | `fallback` |
| ------------------------------------ | ------------------------------------------------------- | ---------- |
| Derived from the published file      | the file is reachable and within budget                 | `false`    |
| Committed sample                     | derivation declined or failed, and a stored file exists | `true`     |
| Generated from the area bounding box | neither of the above                                    | `true`     |

The published files run from 1.2 MB for Wyoming to 97 MB for California, and the large ones carry
tens of millions of block pairs. A HEAD request checks the size first, and anything above
`civics.maps.lodes.max-download-mb` (default 30) is declined rather than attempted: a stored
fallback that arrives beats live data that never renders. Alaska returns 404 for every vintage
because it does not participate in LEHD, which the catalog already records.

Results are cached per state for the process lifetime. The vintage is an annual publication, so
there is nothing to invalidate within a run. Set `civics.maps.lodes.live-enabled=false` to run the
demo entirely offline.

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

## Map and Feature List Synchronization

**Status: implemented, with one direction pending manual confirmation.** The accessible feature list currently renders the same data as the map but shares no state with it. That satisfies "an equivalent exists" and fails "the equivalent is usable", which is the distinction that matters for a canvas-based map.

axe cannot detect this gap. A MapLibre canvas with a parallel `<ul>` passes every automated rule while a screen-reader user still has no way to tell which earthquake the map is showing, or to move the map to the event they are reading about. The risk register has warned about exactly this since the beginning; this section turns the warning into a requirement.

### Required behavior

The map and the feature list are two views of one selection, and selection must be settable from either side.

- Every feature in the list is a focusable control with an accessible name that identifies it without relying on the map — place, magnitude, and time for an earthquake; name and geography for a Census layer.
- Moving focus to a list item selects that feature: the map pans to its coordinate and renders it as visually selected. Panning must not steal focus.
- Selecting a feature on the map — click, or keyboard activation of a map control — moves programmatic focus to the corresponding list item and marks it `aria-selected`.
- The selected feature is announced through a polite live region, so a screen-reader user learns what changed without inspecting the map.
- Selection survives layer toggles where the feature is still visible, and clears when its layer is hidden.
- Selection is reflected in the URL alongside the existing area and layer parameters, so a selected feature can be linked to and restored.

### Verification

Automated checks can prove the wiring, not the experience:

- A storyboard check that keyboard-tabbing to a feature updates the map's selected state.
- A storyboard check that activating a map feature moves focus to the matching list item.
- A storyboard check that the announcement region receives the selected feature's name.

The experience itself is verified by Checklist 4 in [accessibility-manual-evidence.md](accessibility-manual-evidence.md). List-to-map synchronization is automated; map-to-list is implemented but requires a human click (Checklist 4 item M12) because WebGL hit tests cannot be asserted synthetically.

### Verification status

- List to map is automated and passing: focusing or activating an entry selects the feature, sets `aria-pressed`, updates the announcement, moves the map, and records the selection in the URL.
- Map to list is **implemented but not automatically verified**. Driving a WebGL hit test requires trusted pointer events against a rendered marker; synthetic events dispatched into the canvas do not reach MapLibre's handler, so an automated check would assert nothing. It needs a human click, which Checklist 4 item M12 covers. Do not report this direction as verified until that run is recorded.
