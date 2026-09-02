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
bounded search aggregation / bounded features
        ↓
Maps: Research Coverage
        +
semantic area/feature results
```

## Stable Maps taxonomy

Maps is organized by what a reader is trying to understand rather than by publisher:

1. **Geography & Boundaries** — TIGER/Line and shared administrative geometry.
2. **Community & Economy** — LODES, SAIPE and future population/business/housing measures.
3. **Environment & Hazards** — USGS hydrography, earthquakes and future terrain context.
4. **Research Coverage** — where repository/search research objects explicitly say they apply.

Only categories and children with implemented backing capabilities should be shown. Do not keep disabled placeholders in the UI merely to advertise future work.

A checkbox controls whether a conceptual layer is rendered. Measure/year/industry/time-window/source are parameters inside that layer rather than additional permanent checkboxes.

## Research Coverage children

The first implemented child is:

- **Repository research by area** — bounded counts derived from explicit normalized administrative geography in the active search projection. The browser receives one search hit plus the geography facet rather than the matching result set, then joins supported facet values to the Census-area catalog for map symbols and the equivalent semantic table.

Later independently checkable children may include:

- **Data.gov spatial datasets** — explicit DCAT spatial coverage after sidecar enrichment.
- **NASA collection coverage** — authoritative collection-level spatial extent.
- **NASA granule coverage** — bounded viewport/time-filtered granules for selected collections.
- **Selected research object** — focused footprint/area when navigating from detail.

Each child remains independently checkable and uses the same category/disclosure pattern introduced by the map-layer-categories workstream.

## Current implemented slice

PR #18 establishes the first executable Discovery-to-Maps research path:

- Discovery preserves `q`, repeatable program filters, publisher, source system, geography, research-object type and vintage year when opening Maps.
- Maps turns those effective criteria into one bounded `/search` request with `page=0` and `pageSize=1`; Solr/OpenSearch still compute the geography facet across the complete matching projection.
- NgRx owns the request, response, errors and visibility state; a new request clears the old summary so stale counts cannot survive a criteria change.
- Only facet values that match a supported Census-area boundary enter `Repository research by area`.
- A selected geography is reapplied after the self-excluding geography facet so the map cannot advertise areas outside the effective search.
- Records with no supported explicit administrative geography remain visible in the `unmapped` count instead of being silently dropped.
- Publisher, author, laboratory and institution locations are never substituted for research geography.
- MapLibre draws bounded count symbols at Census-area centers; the accessible feature region exposes the same counts in a semantic table with links back to the corresponding Discovery criteria.
- The Research Coverage disclosure is presentation-only: collapsing it does not turn off its checked child layer.
- The Data.gov spatial-availability probe inspects retained raw-harvest metadata read-only and measures candidate spatial availability without rewriting the certified 500K Data.gov corpus.

This first slice is an administrative research-summary layer, not a claim that each research object covers every point inside the named area. Rich point/bounds/polygon footprint rendering remains a later sidecar/API concern.

## Discovery integration

Discovery passes a stable representation of the effective query/filter state to Maps, not merely a decorative query string.

The implemented map-side request preserves:

- query;
- source system;
- publisher;
- program;
- research-object type;
- vintage year;
- explicit geography.

Future footprint APIs should additionally bind their evidence to active projection identity/version where that identity is not already supplied by the search response/evidence envelope.

The existing search criteria abstraction is reused rather than creating a second incompatible map-search language.

## Bounded API design

Never send the complete matching result set to MapLibre.

The first administrative summary intentionally reuses the existing bounded search contract: a one-result page is enough because the geography facet is computed over the complete effective result set by the active search engine.

Later explicit-spatial work should use two bounded shapes where appropriate:

1. **Spatial summary** — counts grouped by administrative area and optionally source/type.
2. **Spatial features** — explicit footprints limited by viewport/bounds, zoom/detail level and a server-enforced result cap.

Those future APIs should report truncation/aggregation behavior explicitly.

Administrative values are labeled as **matching research-object counts** rather than implying that every record covers every point inside an area.

## Map rendering

### Administrative summaries

Render research count/intensity by supported administrative area with a textual table containing the same values. Reuse shared authoritative administrative geography rather than creating a second research-specific administrative geography model.

The current layer uses bounded symbols at retained Census-area centers. A future choropleth can reuse the authoritative geometry service once its summary contract requires polygons; this slice does not manufacture per-record polygons.

### Explicit footprints

Render only records with authoritative spatial coverage. Points, bounds and polygons must expose corresponding research-object entries in semantic HTML.

### Selection

Map selection and accessible list/table selection must share application state when interactive feature selection is introduced for research footprints.

For the current administrative summary:

- table links reconstruct the effective Discovery search plus the selected area;
- collapsing the Research Coverage category does not silently disable the checked child layer;
- no count or navigation action exists only through pointer interaction on the canvas.

## Scale behavior

The cursor/search-after workstream should be reused for associated research-object lists that require deep navigation.

Map APIs use aggregation and bounds rather than deep offset scans. The current summary is independent of result-list depth: the browser receives a one-record page plus aggregate facet values even when the effective search matches the million-record C2 projection.

For Data.gov, use the deterministic availability probe followed by a targeted spatial-enrichment pass using retained raw-harvest references. Do not rewrite the certified 500K corpus merely to add a map sidecar.

For NASA, keep collection and granule semantics separate. Collection coverage can summarize the product's overall extent; granule coverage must be bounded by collection, viewport and/or time before reaching the browser.

## Accessibility

This workstream preserves and extends the project's map-equivalence contract:

- every visible research layer has textual controls/content;
- all mapped counts have numerical/text equivalents;
- color is never the only carrier of magnitude or selection;
- layer and category controls are keyboard operable;
- panning/dragging has non-drag alternatives;
- focus is not obscured by map controls/panels;
- controls satisfy WCAG 2.2 target-size intent;
- status changes are announced without moving focus;
- 320 px reflow and 200% zoom remain usable.

The Research Coverage summary is valid list/table structure inside the existing accessible feature region rather than canvas-only content.

## Evidence

Implemented/focused evidence in this slice includes:

- unit coverage for bounded Research Coverage aggregation, selected-geography behavior and unmapped counts;
- NgRx effect coverage proving the search request is bounded to `page=0`, `pageSize=1` and errors remain isolated from other map layers;
- MapLibre visibility evidence covering the Research Coverage source/layers alongside the existing map toggle groups;
- browser evidence that all effective Discovery criteria reach the bounded map aggregation request;
- browser evidence that map legend counts and the semantic Research Coverage table agree;
- browser evidence that a selected geography excludes alternative self-excluding facet areas from the rendered summary;
- browser evidence that table links reconstruct the effective Discovery criteria;
- browser evidence that collapsing the Research Coverage category preserves checked/rendered state;
- deterministic Data.gov spatial-availability probe tests, including the distinction between candidate spatial tokens and validated geometry.

Still required before richer explicit-spatial children are considered complete:

- server-enforced viewport/time/result caps for explicit footprints;
- projection/query identity and truncation evidence for new dedicated spatial APIs;
- trusted map-click-to-list manual evidence for interactive research footprints;
- forced-colors and dark-mode checks for any new footprint symbology;
- proof in sidecar enrichment that publisher/institution locations cannot enter Research Coverage through an implicit fallback.

## Non-goals

This workstream does not:

- render every C2 record as a point;
- geocode publisher addresses as research coverage;
- make MapLibre authoritative for spatial state;
- replace Discovery with a map-first search engine;
- weaken the accessible HTML equivalent to accommodate canvas behavior;
- create one checkbox per metric/year/filter combination.

## Exit criteria

For the first administrative-summary slice:

1. Discovery criteria drive a bounded Research Coverage request.
2. Explicit normalized repository geography produces a truthful administrative-area research summary.
3. The browser never receives an unbounded research result set for mapping.
4. Every mapped administrative count has a semantic equivalent.
5. Research Coverage fits the same expandable category model as existing map layers without category collapse mutating selection.
6. Deep associated result navigation continues to reuse the existing cursor semantics rather than inventing map-specific offsets.
7. Data.gov spatial availability can be measured independently of the certified C2 corpus before a spatial sidecar is introduced.
