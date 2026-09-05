# Vintage 2025 county Population Estimates

Issue: #67

## Goal

Add a current county-level Census Population Estimates layer that proves the shared thematic architecture can support additional measures without duplicating geometry or accessibility logic.

## Source decision

Use the Census Population Estimates Program **Vintage 2025** county series covering 2020–2025.

As of September 2026, Vintage 2025 is the most recent completed consistent county series. Census also states that current estimates are not supported through the Census Data API at this time. Therefore this slice should ingest/pin an authoritative published Vintage 2025 source file rather than introducing a fictional live API dependency.

The retained source must record:

- source URL/file identity;
- Census Vintage 2025 designation;
- capture/download date;
- file checksum where practical;
- supported estimate years;
- parsed county GEOID/value count;
- validation failures or unsupported rows.

Do not mix vintages within one rendered measure.

## User model

One conceptual checkbox:

> County population

Configuration belongs inside the layer.

### Measures

Initial supported measures:

1. **Population** — resident population estimate for the selected year.
2. **Annual numeric change** — current selected year minus prior year.
3. **Annual growth rate** — annual percent change.

Recommended default: latest-year annual growth rate because it communicates change clearly while raw population and numeric change remain available.

### Year

Expose only years present in the pinned Vintage 2025 source and valid for the selected measure. Growth/change requires a prior-year value.

## Data architecture

Prefer a small application-owned thematic value service rather than embedding Census tables directly in Angular.

Conceptual flow:

```text
pinned Census Vintage 2025 county file
        |
        v
validated population-estimates values keyed by county GEOID
        |
        v
selected state + measure + year
        |
        +--> AdministrativeGeometryService(state FIPS, compatible vintage)
        |
        v
join values to authoritative county polygons by GEOID
        |
        v
ThematicAreaLayer-style API response
        |
        v
Angular / NgRx / MapLibre + semantic table
```

Validation should reject:

- malformed state/county identifiers;
- duplicate county GEOIDs for the same year/measure;
- nonnumeric values where numeric values are required;
- a value whose county cannot be joined to authoritative geometry;
- cross-vintage mixing.

Do not synthesize missing county values or geometry.

## API direction

Follow the existing SAIPE/thematic pattern where practical. The response should expose enough structure for a generic county-thematic UI:

```text
layer id
source / source URL
geography level = COUNTY
source vintage
geometry vintage
measure id / label / units
selected year
values[]
  county GEOID
  county label
  value
  optional prior value / change metadata
provenance
```

Geometry remains a separate authoritative concern even if the API returns a joined GeoJSON representation for the browser.

## Angular/NgRx state

State should make visible configuration explicit:

- layer visible;
- measure;
- year;
- loading/error;
- selected county, if supported by the existing Maps interaction model.

Measure/year should round-trip through URL state if comparable Maps controls already do so, so the demo can be linked reproducibly.

## Cartography

### Population

Use a sequential scale, ideally with quantile/threshold breaks derived deterministically from the returned state-level county values.

### Numeric change / growth rate

Use a diverging scale centered at zero so loss and growth are visually distinct.

The legend must state:

- measure;
- units;
- year/year pair;
- source vintage;
- break semantics.

Avoid implying statistical significance from color alone.

## Accessibility

Provide a semantic equivalent containing at least:

- county name;
- selected value;
- units;
- selected year or year pair;
- source/vintage;
- any missing/unavailable state.

Requirements:

- measure and year controls have explicit labels and selected state;
- changing measure/year announces the updated layer context without excessive chatter;
- map colors are not the only channel for distinguishing values;
- forced-colors mode preserves control/selection usability even if the choropleth itself becomes visually simplified;
- 320px reflow does not force horizontal scrolling for primary controls/table content.

## Tests

### Backend/service

- pinned fixture parsing;
- county GEOID validation;
- deterministic derived change/growth calculations;
- duplicate/missing geometry failure behavior;
- source/vintage provenance.

### Angular/component

- measure/year state transitions;
- legend text/breaks;
- semantic table equivalence;
- loading/empty/error states;
- NgRx reducer/effect/selectors.

### Storybook/axe

- population;
- positive/negative growth;
- one-value edge case;
- missing data;
- loading/error;
- forced-colors/reflow-representative state.

### Playwright

- layer capability appears only when supported;
- measure/year selection updates map + semantic table consistently;
- URL/state round-trip where applicable;
- selected county semantics remain correct;
- normal Maps accessibility and browser evidence remain green.

## Non-goals

- no new county geometry service;
- no mixing Vintage 2025 values with older Census estimate vintages;
- no demographic-characteristics expansion in this slice;
- no nationwide bulk data warehouse;
- no C2/C2.1 corpus or timing changes.

## Exit criteria

- Population Estimates render for supported states using authoritative county geometry;
- map, legend, controls, URL/state and semantic equivalent agree on measure/year;
- source/vintage provenance is visible;
- failures/missing values remain explicit rather than manufactured;
- the implementation establishes a reusable pattern for later county thematic layers such as CBP/BDS/Building Permits;
- normal Maps/browser/accessibility gates pass.

## Implementation status

Implemented for issue #67.

The delivered slice uses the pinned Census Population Estimates Program
`CO-EST2025-ALLDATA` Vintage 2025 county series.

Implementation characteristics:

- 3,144 validated county/county-equivalent GEOIDs from the pinned source;
- source file identity, Windows-1252 encoding, capture date, SHA-256 checksum,
  parsed row counts, and supported years retained as provenance;
- Population for 2020-2025;
- Annual numeric change for 2021-2025;
- Annual growth rate for 2021-2025;
- Annual change cross-validated against the published `NPOPCHG` fields;
- no growth rate manufactured when the prior-year population is zero;
- authoritative 2025 Census county geometry reused through
  `AdministrativeGeometryService`;
- strict GEOID value/geometry joins with duplicate and missing geometry/value
  failures kept explicit;
- SAIPE and Population Estimates capabilities advertised independently;
- one `County population` conceptual layer with measure/year configuration;
- default measure is latest-year annual growth rate;
- Population uses deterministic sequential county-value breaks;
- annual change and growth use a zero-centered diverging scale;
- the same computed break contract drives MapLibre and the textual legend;
- measure, year, and visibility round-trip through URL state;
- semantic county table exposes FIPS, selected value, current/prior population,
  units, year/year pair, and source/geometry provenance;
- Storybook populated/population/one-value/empty/loading/error states;
- axe coverage for populated, loading, and unavailable states;
- Playwright evidence for control-to-map/table/URL equivalence and MapLibre
  visibility.

### Accepted evidence

- Angular unit/axe: 197 passed.
- Storybook interactions: 20 passed.
- Focused Chromium Population Estimates + map-layer visibility: 13 passed,
  retry-free.
- Population semantic/browser evidence: 6 passed across Chromium, Firefox,
  and WebKit, retry-free.
- Full comparison/WCAG/Section 508 browser gate: 346 passed, 26 intentionally
  skipped.
- Production Angular build: successful.
- Repository API tests and runtime image build: successful.
- OpenAPI lint/generation/check: successful.

This work does not modify the accepted C2/C2.1 corpus, projection identity, or
search timing evidence.
