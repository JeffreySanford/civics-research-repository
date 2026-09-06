# County Business Patterns thematic layer

Issue: #77

## Goal

Add a county-level Census County Business Patterns (CBP) thematic layer that reuses the shared county geometry and thematic-value architecture already proven by SAIPE and Vintage 2025 Population Estimates.

## Source decision

Use the U.S. Census Bureau **2023 County Business Patterns county file** as the pinned authoritative value source for this slice.

As of September 2026, Census identifies 2023 as the latest CBP reference year. The release was published June 26, 2025. Census also documents that all CBP API queries now require an API key, so this repository should retain a validated extract from the downloadable county file rather than introduce a runtime browser credential dependency.

Authoritative references:

- dataset: `https://www.census.gov/data/datasets/2023/econ/cbp/2023-cbp.html`;
- county archive: `https://www2.census.gov/programs-surveys/cbp/datasets/2023/cbp23co.zip`;
- county record layout: `https://www2.census.gov/programs-surveys/cbp/technical-documentation/records-layouts/2020_record_layouts/county-layout-2020.txt`;
- CBP program: `https://www.census.gov/programs-surveys/cbp.html`;
- API documentation for comparison only: `https://www.census.gov/data/developers/data-sets/cbp-zbp/cbp-api.html`.

The retained source metadata must record source identity, reference year, capture date, checksum, encoding, parsed row counts, supported county GEOIDs, supported NAICS codes, and validation failures.

## File schema

The downloadable county file and the Census API use different field names. This implementation follows the **county file schema**:

- `FIPSTATE` — two-digit state FIPS;
- `FIPSCTY` — three-digit county FIPS;
- `NAICS` — industry code;
- `EMP_NF` — employment noise flag;
- `EMP` — mid-March employment;
- `QP1_NF` — first-quarter payroll noise flag;
- `QP1` — first-quarter payroll in $1,000;
- `AP_NF` — annual payroll noise flag;
- `AP` — annual payroll in $1,000;
- `EST` — establishment count.

Do not accidentally code the pinned-file parser against API-only names such as `ESTAB`, `PAYQTR1`, or `PAYANN`.

For 2020-2023 county files, Census defines the noise flags as:

- `G` — 0 to less than 2% noise;
- `H` — 2 to less than 5% noise;
- `J` — at least 5% noise.

The application may expose those flags semantically but must not imply they are ordinary measurement-error confidence intervals.

## County-map eligibility

The real 2023 county file also contains `FIPSCTY=999` aggregate records such as `01999`. Those rows are useful CBP aggregates, but they do not identify a county polygon and therefore cannot participate in a strict county GEOID-to-TIGERweb join.

The repository-owned county map resource consequently:

- retains only rows whose `FIPSCTY != 999`;
- records the excluded retained-level aggregate-row count in `source.json`;
- never invents geometry for an `XX999` identifier;
- keeps a source row with any other five-digit county GEOID subject to strict 2023 TIGERweb join validation.

This is an eligibility filter for a **county map**, not a statement that the excluded aggregate is zero, missing, or suppressed.

## Publication/confidentiality semantics

Census documentation states that beginning with reference year 2017 a cell is published only when it contains at least three establishments; otherwise the cell is dropped from the release. Therefore a missing county/industry row is not evidence of zero business activity.

The implementation must distinguish:

- published numeric zero;
- published numeric value;
- row/cell unavailable because it is absent from the release;
- supported county with no published value for the selected industry;
- invalid source data.

Never manufacture zeroes for absent rows.

## User model

One conceptual checkbox:

> County business activity

Configuration stays inside the layer.

### Measures

1. **Establishments** — `EST`.
2. **Employment** — `EMP`.
3. **First-quarter payroll** — `QP1` (`$1,000`).
4. **Annual payroll** — `AP` (`$1,000`).

Default: **Establishments**.

### Industry

The first slice is deliberately bounded:

- `TOTAL` — all sectors, sourced from `------`;
- published retained sector rows available as `NN----` in the county file;
- authoritative labels from Census/NAICS reference metadata;
- no browser delivery of the full 2- through 6-digit national industry cube.

The downloadable source uses a single retained row for the combined sector families. The UI must label them by their full published range rather than imply a narrower sector:

- source `31----` → **31–33 Manufacturing**;
- source `44----` → **44–45 Retail Trade**;
- source `48----` → **48–49 Transportation and Warehousing**.

The other retained sector identifiers use their normal two-digit label. Census documents that 2017-2023 CBP uses 2017 NAICS.

### Year

The first implementation supports reference year **2023** only. Year remains explicit in API/state/URL so later vintages can be added without redesigning the contract.

## Data architecture

```text
pinned Census cbp23co-derived extract
        |
        v
validated county-eligible values keyed by county GEOID + NAICS + year
        |
        v
selected state + measure + industry + year
        |
        +--> AdministrativeGeometryService(state FIPS, 2023 county vintage)
        |
        v
strict GEOID join
        |
        v
county-thematic API response
        |
        v
Angular / NgRx / MapLibre + semantic table
```

Validation must reject or explicitly classify malformed FIPS identifiers, duplicate county/NAICS rows, unsupported NAICS levels, malformed numeric values, impossible noise flags, source/geometry join failures, and cross-year mixing. `XX999` aggregates are excluded before county-map joins and counted in provenance.

## API direction

Generalize the existing county-thematic pattern where practical rather than creating a CBP-specific rendering pipeline.

The response needs:

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
  available
  value | null
  noise/publication metadata where applicable
provenance
```

Every county in the returned 2023 geometry should remain represented semantically. If the selected industry has no published CBP row for a real county, return `available=false` and `value=null`; do not synthesize zero. Conversely, any retained CBP county GEOID that cannot join to the selected 2023 geometry is an integrity failure.

Geometry remains authoritative and separate even if the browser receives joined GeoJSON.

## Angular / NgRx state

Track layer visibility, measure, industry, year, loading/error, and selected county where supported. Measure/industry/year must round-trip through URL state.

## Cartography

Use deterministic state-level breaks from published numeric county values only.

- establishments/employment: sequential scale;
- payroll: sequential scale with explicit `$1,000` units unless display normalization is clearly labeled;
- unavailable rows: distinct non-value treatment, never the zero-value color.

The legend must state measure, units, NAICS code/label, reference year, source, breaks, and unavailable semantics.

## Accessibility

The semantic equivalent must expose county/FIPS, selected value or unavailable state, units, selected NAICS code/label, year, source, and relevant noise/publication metadata.

Measure, industry, and year controls must be keyboard operable and named. Map color cannot be the only value/unavailable channel. Forced-colors and 320px reflow must preserve primary controls and semantic content.

## Evidence

Backend/service:

- retained-source parsing;
- `XX999` county-map exclusion and provenance count;
- county GEOID and NAICS validation;
- measure/unit mapping;
- duplicate-row failures;
- noise/publication semantics;
- source provenance;
- strict value/geometry joins.

Angular/Storybook:

- measure/industry/year transitions;
- legend and semantic-table equivalence;
- published-zero versus unavailable behavior;
- populated/loading/empty/error states;
- axe coverage.

Playwright:

- capability appears only when supported;
- controls, URL, legend, map, and semantic table stay aligned;
- URL restoration;
- unavailable values remain distinct from zero;
- raw MapLibre checks remain Chromium-only under `@maps`;
- semantic/accessibility checks remain cross-browser.

## Non-goals

- no new county geometry service;
- no browser-held Census API key;
- no nationwide 6-digit NAICS cube in Angular;
- no nonemployer-statistics merge;
- no business-location point synthesis;
- no C2/C2.1 corpus or timing changes.

## Exit criteria

- authoritative 2023 CBP values render against shared 2023 county geometry;
- `XX999` aggregates are absent from the county resource and counted in provenance;
- controls, URL, legend, map, and semantic table agree on measure/industry/year;
- source/reference-year provenance is visible;
- missing/publication states remain explicit rather than manufactured as zero;
- the implementation reuses/generalizes the county-thematic architecture;
- normal Maps workspace/API/Storybook/browser/accessibility gates pass.

## Implementation status

In progress on `codex/maps-county-business-patterns` / PR #78.
