# Searchable Research Coverage on Maps

## Purpose

This workstream connects Discovery and the research spatial-coverage foundation so a filtered research question can be explored geographically without turning the browser into a million-feature renderer.

Example workflow:

```text
Discovery
  "climate" + NASA + 2024
        ↓
engine-neutral search criteria
        ↓
spatial summary / bounded features
        ↓
Maps: Research Coverage
        +
semantic area/feature results
```

## Stable Maps taxonomy

Maps should be organized by what a reader is trying to understand rather than by publisher:

1. **Geography & Boundaries** — TIGER/Line and shared administrative geometry.
2. **Community & Economy** — LODES, SAIPE and future population/business/housing measures.
3. **Environment & Hazards** — USGS hydrography, earthquakes and future terrain context.
4. **Research Coverage** — where repository/search research objects explicitly say they apply.

Only categories and children with implemented backing capabilities should be shown. Do not keep disabled placeholders in the UI merely to advertise future work.

A checkbox controls whether a conceptual layer is rendered. Measure/year/industry/time-window/source are parameters inside that layer rather than additional permanent checkboxes.

## Research Coverage children

Potential independently checkable children are:

- **Repository research by area** — count/summary choropleth from explicit curated geography metadata; this is the first implementation candidate because it needs no new external crawl.
- **Data.gov spatial datasets** — explicit DCAT spatial coverage after sidecar enrichment.
- **NASA collection coverage** — authoritative collection-level spatial extent.
- **NASA granule coverage** — bounded viewport/time-filtered granules for selected collections.
- **Selected research object** — focused footprint/area when navigating from detail.

Each child remains independently checkable and uses the same category/disclosure pattern introduced by the map-layer-categories workstream.

## Discovery integration

Discovery should pass a stable representation of the effective query/filter state to Maps, not merely a decorative query string.

The map-side request must preserve relevant criteria such as:

- query;
- source system;
- publisher;
- program;
- research-object type;
- year/date;
- exact identifiers where meaningful;
- active projection identity/version.

The existing search criteria abstraction should be reused rather than creating a second incompatible map-search language.

## Bounded API design

Never send the complete matching result set to MapLibre.

Prefer two bounded API shapes:

1. **Spatial summary** — counts grouped by administrative area and optionally source/type.
2. **Spatial features** — explicit footprints limited by viewport/bounds, zoom/detail level and a server-enforced result cap.

The API should report truncation/aggregation behavior explicitly.

A first repository summary can aggregate curated objects by their explicit administrative geography. It should label the value as a **matching research-object count** rather than implying that every record covers every point inside the area.

## Map rendering

### Administrative summaries

Render research count/intensity by state/county/other supported area with a textual table containing the same values. Reuse shared authoritative administrative geometry rather than creating geometry inside the research-coverage service.

### Explicit footprints

Render only records with authoritative spatial coverage. Points, bounds and polygons must expose corresponding research-object entries in semantic HTML.

### Selection

Map selection and accessible list/table selection must share application state.

- table/list selection may move/highlight the map without stealing focus;
- map-originated selection must have an announcement path and matching semantic target;
- collapsing the Research Coverage category does not silently disable checked child layers;
- no information or action exists only through pointer interaction on the canvas.

## Scale behavior

The cursor/search-after workstream should be reused for associated research-object lists.

Map APIs should use aggregation and viewport bounds rather than deep offset scans. Server caps, truncation metadata and projection identity must be visible in evidence.

For Data.gov, prefer a deterministic availability probe followed by a targeted spatial-enrichment pass using retained raw-harvest references. Do not rewrite the certified 500K corpus merely to add a map sidecar.

For NASA, keep collection and granule semantics separate. Collection coverage can summarize the product's overall extent; granule coverage must be bounded by collection, viewport and/or time before reaching the browser.

## Accessibility

This workstream must preserve and extend the project's map-equivalence contract:

- every visible research layer has textual controls/content;
- all mapped counts have numerical/text equivalents;
- color is never the only carrier of magnitude or selection;
- layer and category controls are keyboard operable;
- panning/dragging has non-drag alternatives;
- focus is not obscured by map controls/panels;
- controls satisfy WCAG 2.2 target-size intent;
- status changes are announced without moving focus;
- 320 px reflow and 200% zoom remain usable.

## Evidence

Required evidence:

- API contract/unit tests for query-to-spatial criteria;
- server-enforced bounds/result caps;
- projection/query identity attached to spatial evidence;
- MapLibre source/layer visibility tests;
- semantic list/table parity tests;
- keyboard category/layer tests;
- trusted map-click-to-list manual evidence;
- axe/WCAG 2.2-oriented browser evidence;
- forced-colors and dark-mode checks;
- proof that category collapse never mutates child rendering state;
- proof that publisher/institution locations cannot enter Research Coverage through an implicit fallback.

## Non-goals

This workstream does not:

- render every C2 record as a point;
- geocode publisher addresses as research coverage;
- make MapLibre authoritative for spatial state;
- replace Discovery with a map-first search engine;
- weaken the accessible HTML equivalent to accommodate canvas behavior;
- create one checkbox per metric/year/filter combination.

## Exit criteria

1. Discovery criteria can drive a bounded Research Coverage map request.
2. Curated repository geography produces a truthful first administrative-area research summary.
3. Administrative summaries and explicit footprints use authoritative spatial evidence.
4. The browser never receives an unbounded research result set for mapping.
5. Every meaningful mapped value has a semantic equivalent.
6. Research Coverage fits the same expandable category model as existing map layers.
7. Search/list traversal reuses cursor semantics where deep result navigation is needed.
