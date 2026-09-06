# County Business Patterns thematic layer

Issue: #77

## Goal

Add a county-level Census County Business Patterns (CBP) thematic layer that reuses the shared county geometry and thematic-value architecture already proven by SAIPE and Vintage 2025 Population Estimates.

## Source decision

Use the U.S. Census Bureau **2023 County Business Patterns** county dataset as the pinned authoritative value source for this slice.

As of September 2026, Census identifies 2023 as the latest CBP reference year. The 2023 release was published June 26, 2025. Census also documents that all CBP API queries now require an API key.

For this repository, prefer the published downloadable 2023 CSV over a runtime browser/API-key dependency:

- authoritative dataset landing page: `https://www.census.gov/data/datasets/2023/econ/cbp/2023-cbp.html`;
- CBP program page: `https://www.census.gov/programs-surveys/cbp.html`;
- API documentation: `https://www.census.gov/data/developers/data-sets/cbp-zbp/cbp-api.html`;
- API variable metadata: `https://api.census.gov/data/2023/cbp/variables.html`.

The retained repository source metadata should record:

- source URL/file identity;
- reference year = 2023;
- capture/download date;
- file checksum;
- source encoding;
- parsed row counts;
- supported county GEOIDs;
- supported NAICS levels/codes used by the application;
- validation failures or unsupported rows.

Do not mix CBP reference years within one rendered configuration.

## Data semantics

The initial measure set is:

1. **Establishments** — `ESTAB`.
2. **Employment** — `EMP`, employment during the week of March 12.
3. **First-quarter payroll** — `PAYQTR1`, reported in thousands of dollars.
4. **Annual payroll** — `PAYANN`, reported in thousands of dollars.

The 2023 API metadata also exposes the related flag/noise fields for employment and payroll. The implementation must preserve Census publication/confidentiality semantics and must never reinterpret a withheld, dropped, flagged, or unavailable value as zero.

Census documentation notes that beginning with reference year 2017 a cell is published only when it contains at least three establishments; otherwise the cell is dropped from the release. This means absence can be a publication/confidentiality condition rather than evidence of zero activity.

## User model

One conceptual checkbox:

> County business activity

Configuration belongs inside the layer.

### Measures

Expose the four measures above. Recommended default: **Establishments** because it is directly interpretable and avoids implying that payroll/employment precision is stronger than the published confidentiality treatment allows.

### Industry

Initial industry configuration should be deliberately bounded.

Recommended first slice:

- `00` — Total for all sectors;
- 2-digit NAICS sectors available in the retained source;
- labels come from authoritative Census/NAICS metadata;
- do not expose the entire 2- through 6-digit national industry cube in the browser.

A later enhancement may add deeper NAICS drill-down if the bounded API and UX remain usable.

### Year

Expose only the pinned 2023 reference year in the first implementation. Keep year explicit in state/URL/API so a later additional reference year does not require a contract redesign.

## Data architecture

Prefer an application-owned value service rather than embedding the source table directly in Angular.

Conceptual flow:

```text
pinned Census 2023 CBP county file
        |
        v
validated CBP values keyed by county GEOID + NAICS + year
        |
        v
selected state + measure + industry + year
        |
        +--> AdministrativeGeometryService(state FIPS, compatible county vintage)
        |
        v
join values to authoritative county polygons by GEOID
        |
        v
shared county-thematic API response
        |
        v
Angular / NgRx / MapLibre + semantic table
```

Validation should reject or explicitly classify:

- malformed state/county identifiers;
- duplicate county + NAICS + year rows;
- unsupported NAICS codes/levels;
- nonnumeric values where a published numeric value is required;
- source flags or publication states that cannot safely be represented as a normal numeric observation;
- a published value whose county cannot be joined to authoritative geometry;
- cross-year mixing.

Do not synthesize missing county values or geometry.

## API direction

Generalize the existing county-thematic pattern where practical rather than creating a CBP-only map contract.

The response should expose enough structure for a reusable county-thematic UI:

```text
layer id
source / source URL
geography level = COUNTY
source reference year
geometry vintage
measure id / label / units
industry code / label / level
selected year
values[]
  county GEOID
  county label
  value | unavailable
  publication/flag metadata when applicable
provenance
```

Geometry remains a separate authoritative concern even if the browser receives a joined GeoJSON representation.

## Angular/NgRx state

State should make visible configuration explicit:

- layer visible;
- measure;
- industry;
- year;
- loading/error;
- selected county if supported by the existing Maps interaction model.

Measure/industry/year should round-trip through URL state so a configured CBP map can be linked reproducibly.

## Cartography

Use deterministic county-value breaks derived from the returned state-level published values.

Recommended first behavior:

- establishments and employment: sequential scale;
- payroll measures: sequential scale with units clearly stated as `$1,000` unless normalized for display;
- unavailable/withheld/dropped cells: visually distinct non-value treatment, never the zero-value color.

The legend must state:

- measure;
- units;
- NAICS code/label;
- reference year;
- source;
- break semantics;
- unavailable/publication-state semantics where present.

## Accessibility

Provide a semantic equivalent containing at least:

- county name/FIPS;
- selected value or unavailable/publication state;
- units;
- selected industry code/label;
- selected year;
- source/reference year;
- relevant flag/publication metadata.

Requirements:

- measure, industry, and year controls have explicit labels and selected state;
- changing configuration announces the updated layer context without excessive chatter;
- map color is not the only channel for distinguishing values/unavailable cells;
- forced-colors mode preserves controls and selected state;
- 320px reflow does not force horizontal scrolling for primary controls or semantic content.

## Tests

### Backend/service

- pinned fixture parsing;
- county GEOID validation;
- NAICS validation/bounding;
- measure/unit mapping;
- duplicate-row failure behavior;
- publication/unavailable semantics;
- source/reference-year provenance;
- strict value/geometry joins.

### Angular/component

- measure/industry/year state transitions;
- legend text/breaks;
- semantic table equivalence;
- unavailable/publication states;
- loading/empty/error states;
- NgRx reducer/effect/selectors.

### Storybook/axe

- establishments, all industries;
- sector-filtered state;
- payroll state;
- unavailable/suppressed-like publication state;
- loading/empty/error;
- representative reflow/forced-colors state.

### Playwright

- layer capability appears only when supported;
- configuration updates URL + legend + semantic table consistently;
- URL/state round-trip;
- published/unavailable values remain semantically distinct from zero;
- raw MapLibre assertions remain Chromium-only under `@maps`;
- semantic/accessibility behavior remains cross-browser.

## Non-goals

- no new county geometry service;
- no browser-held Census API key;
- no nationwide 6-digit NAICS cube delivered to Angular;
- no nonemployer-statistics merge in this slice;
- no derived business-location point data;
- no C2/C2.1 corpus or timing changes.

## Exit criteria

- authoritative 2023 CBP county values render using shared county geometry;
- map, legend, controls, URL/state, and semantic equivalent agree on measure/industry/year;
- source/reference-year provenance is visible;
- publication/confidentiality conditions remain explicit rather than manufactured as zero;
- the implementation generalizes the reusable county-thematic pattern rather than duplicating it;
- normal Maps workspace/API/Storybook/browser/accessibility gates pass.

## Implementation status

Planned on branch `codex/maps-county-business-patterns` for issue #77.
