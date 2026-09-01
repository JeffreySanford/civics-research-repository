# Data-to-Map Layer Matrix

## Decision

Organize the Maps workspace by **research purpose**, not by publisher. The stable top-level taxonomy is:

1. **Geography & Boundaries** — geometry used to orient or join other measures.
2. **Community & Economy** — demographic, workforce, poverty, business, housing and population measures.
3. **Environment & Hazards** — terrain, water and event/hazard context.
4. **Research Coverage** — where research objects explicitly say they apply, plus administrative summaries of matching repository/search objects.

This taxonomy should survive the addition of new Census, USGS and federated sources without creating an agency-by-agency toolbar.

A category owns presentation only. Every child remains independently checkable and independently renderable. Closing a category never disables its checked children, and the closed summary reports the number of active children.

## Current curated catalog

The committed source inventory contains 181 research objects across 15 program values. The largest existing groups are ACS (56), TIGER/Line (56) and LODES (53). The remaining Census/USGS programs are mostly national catalog objects plus five LEHD research-package objects.

| Current program/data | Existing scope | Recommended category | Map use | Priority |
| --- | --- | --- | --- | --- |
| TIGER/Line | 56 area-scoped research objects; tract source archives | Geography & Boundaries | authoritative state/county/tract/PUMA geometry and joins | **P0 foundation** |
| LODES WAC | 53 area-scoped objects | Community & Economy | workplace jobs / employment intensity | already implemented |
| LODES/LEHD OD | bounded map flow service | Community & Economy | commuting origin-destination lines | already implemented |
| SAIPE | county data, one national catalog object | Community & Economy | poverty / median-income county choropleth | implemented, geometry hardening needed |
| Population Estimates | county-capable source | Community & Economy | population, change and growth-rate choropleths | **P1** |
| County Business Patterns | county-capable source | Community & Economy | establishments, employment, payroll; optional industry filter | **P1** |
| Business Dynamics Statistics | state/county-capable source/API | Community & Economy | job creation/destruction, establishment births/deaths | **P1/P2** |
| Building Permits Survey | county/place source | Community & Economy | housing units authorized; county choropleth or place circles | **P2** |
| Economic Census | source supports subnational business statistics | Community & Economy | establishments/employment/payroll/sales by county/industry | **P2** |
| ACS PUMS | 56 area-scoped objects; PUMA-capable microdata | Community & Economy | derived PUMA/state indicators, never raw-person points | **P2** |
| SIPP | national | Research Coverage only | national research-object coverage; no meaningful thematic geometry today | no thematic layer |
| CPS | national | Research Coverage only | national research-object coverage; no meaningful thematic geometry today | no thematic layer |
| USGS 3HP | national hydrography | Environment & Hazards | hydrography raster/reference | already implemented |
| USGS earthquakes | point events | Environment & Hazards | recent event points with magnitude/time | already implemented |
| USGS 3DEP | national elevation program; current catalog references a sample DEM | Environment & Hazards | hillshade/elevation reference through 3DEP dynamic service | **P2** |
| LEHD publications/methodology/project objects | national research package | Research Coverage | research-object relationships and linked LODES context, not invented local footprints | metadata layer only |

## Immediate map value from data already retained

### Repository research coverage by area

This needs no new publisher crawl.

The curated catalog already carries geography on its area-scoped objects. TIGER/Line and ACS are seeded across all configured areas; LODES is seeded for 53 areas, with Alaska, Michigan and Puerto Rico intentionally excluded for the selected vintage because the publisher does not provide the required file.

A first **Repository research coverage** layer can therefore aggregate matching curated research objects by administrative area:

```text
North Dakota       3 matching area-scoped objects
California         3 matching area-scoped objects
Alaska             2 matching area-scoped objects
Michigan           2 matching area-scoped objects
Puerto Rico        2 matching area-scoped objects
```

The exact count depends on the active Discovery criteria. The map value is a count of repository/search objects whose metadata explicitly names the area — not a claim that every publication studies the whole area.

Selecting an area should expose the corresponding research objects in semantic HTML and reuse the normal search/list cursor contract where the result set becomes large.

## Shared administrative geometry before more choropleths

Do not add a separate geometry implementation for every measure.

The current SAIPE service demonstrates why: it can fall back to generated rectangular county cells inside a state extent. That is acceptable scaffolding but should not become the geometry foundation for additional economic layers.

Introduce one reusable administrative-geometry boundary:

```text
AdministrativeGeometryService
  state / territory
  county / county-equivalent
  PUMA
  tract (bounded/on demand)

stable join keys
  state FIPS
  county FIPS
  PUMA code
  tract GEOID
```

Use authoritative TIGER/Line-derived geometry or a Census cartographic boundary representation. The thematic services should provide values keyed by geography ID; the map joins those values to the shared geometry.

This unlocks SAIPE, Population Estimates, CBP, BDS, Building Permits and Economic Census without duplicating geometry or accessibility logic.

## Recommended Community & Economy layer sequence

### P1A — Population change

The catalog already references the 2025 Population Estimates county file. Census Population Estimates cover states, counties, cities and towns. Start with county population and annual change/growth.

Why first:

- intuitive measure;
- small data footprint compared with microdata;
- same county geometry needed by SAIPE;
- straightforward accessible table: County / Population / Change / Growth rate.

### P1B — County Business Patterns

CBP is an especially strong layer because the 2023 source is already in the catalog and Census publishes county-level establishments, employment, first-quarter payroll and annual payroll, with industry detail.

Initial child layer:

- **Business employment by county**

Then allow a measure selector rather than creating four permanent checkboxes:

```text
Measure
  Employment
  Establishments
  Annual payroll

Industry
  All industries
  selected NAICS sector
```

The layer remains one renderable checkbox; measure/industry are layer parameters.

### P1C — Business dynamics

BDS now has a Census API with state, county and metro geography and measures such as job creation/destruction and establishment births/deaths.

A useful first layer is **Job creation rate by county**. Keep the year and measure inside the layer configuration rather than producing a checkbox for every indicator.

### P2 — Building permits

The current 2025 Building Permits source supports national, state, CBSA, county and place statistics. A county choropleth of housing units authorized is the cleanest first implementation; place-level symbols can follow after place geometry/coordinates are available.

### P2 — ACS PUMS-derived measures

ACS PUMS supports state and PUMA geography. Never draw person-level microdata points. Any map layer must aggregate with survey weights and disclose the statistic/methodology.

A later layer might show a PUMA-level labor-force or housing indicator, but this requires a PUMA geometry source and explicit weighted aggregation evidence. It is downstream of simpler published aggregate products.

## Environment & Hazards

Keep the existing USGS hydrography and earthquake children in this category.

Add **3DEP terrain/hillshade** only after the current sample-TIFF catalog representation is separated from the rendering source. USGS provides a national 3DEP dynamic elevation ImageServer capable of hillshade, slope, aspect and tinted-hillshade rendering. The map should use the service as a reference layer while the repository object continues to document provenance.

Do not expose hillshade, slope, aspect and tinted hillshade as four permanent checkboxes. Prefer one **3DEP terrain** child with a visualization-mode selector.

## Federated Research Coverage

### Data.gov — high value, requires enrichment

DCAT-US includes an explicit `spatial` field for spatial datasets. It can represent named geography, bounding coordinates, points or GeoJSON-style geometry depending on the source/version.

The current `DataGovHarvester` does **not** normalize `dcat.spatial`; therefore the certified 500K Data.gov checkpoint cannot currently be mapped from local normalized metadata alone.

However, each retained record may contain `harvestRecordRaw`, which is a URL to the source/raw harvest record. Use that as a targeted enrichment entry point rather than replaying the whole catalog cursor crawl.

Recommended flow:

```text
retained Data.gov record
  -> retained harvestRecordRaw reference
  -> bounded spatial enrichment fetch
  -> parse explicit DCAT spatial
  -> ResearchSpatialCoverage sidecar
```

The enrichment has its own version/evidence and does not mutate the C2 Gold Master identity.

Before a large enrichment run, add a read-only probe that samples a deterministic slice and records:

- records with spatial present;
- parseable admin area / point / bbox / polygon counts;
- malformed/unsupported values;
- source/publisher distribution;
- sample evidence IDs.

### DOE OSTI — do not force onto the map

The current OSTI mapping is bibliographic/research metadata. Publisher, sponsor or laboratory location is not research coverage. Keep OSTI out of Research Coverage unless an authoritative record explicitly supplies content/site/spatial coverage.

### NASA CMR — strongest federated spatial layer

NASA CMR explicitly models collection and granule spatial extent. CMR supports point, bounding rectangle, polygon and line semantics, and spatial search is a first-class API capability.

The current collection adapter does not yet retain those geometry fields. For the spatial workstream, prefer a documented UMM JSON response/version so the adapter receives explicit collection spatial metadata rather than relying on a minimal legacy JSON projection.

Two distinct map children can eventually exist:

- **NASA collection coverage** — collection-level footprints/bounds;
- **NASA granule coverage** — bounded viewport/time-filtered granules for selected collections.

Never silently make granules the same research-object type as collections.

### PubMed / OpenAlex

Do not label author or institution location as research coverage.

If institution geography is added later, expose it as a separately named analytic concept such as **Research institutions / affiliations**, with its own semantics. That is a relationship/location view, not a statement about where the research subject applies.

## Final control taxonomy

```text
Layers

▾ Geography & Boundaries          1 of 1 visible
   ☑ TIGER/Line boundary

▾ Community & Economy             3 of N visible
   ☑ LODES workplace employment
   ☑ LODES commuting flows
   ☑ SAIPE county poverty
   ☐ Population change
   ☐ Business employment
   ☐ Business dynamics
   ☐ Building permits
   ☐ ACS PUMS-derived measure

▾ Environment & Hazards           2 of N visible
   ☑ USGS 3HP hydrography
   ☑ USGS earthquake overlay
   ☐ USGS 3DEP terrain

▾ Research Coverage               0 of N visible
   ☐ Repository research by area
   ☐ Data.gov spatial datasets
   ☐ NASA collection coverage
   ☐ NASA granule coverage
```

Only show a child when its backing capability is actually available. A planned layer must not appear disabled indefinitely merely to advertise future work.

## Avoid checkbox explosion

A checkbox answers one question: **is this conceptual layer rendered?**

Variables belong inside a layer configuration:

- measure;
- year/vintage;
- industry/topic;
- time window;
- source system;
- aggregation level.

For example, CBP should be one checkable layer with `Employment / Establishments / Payroll` as a measure selector, not three permanent top-level children.

## API shape

Prefer a common thematic response contract where practical:

```text
ThematicAreaLayer
  id
  label
  source / sourceUrl / attribution
  geographyLevel
  vintage / updatedAt
  measureId / measureLabel / units
  values[]
    geographyId
    geographyLabel
    value
    optional secondary values
  provenance
```

Geometry is fetched/shared separately by geography level and joined by stable IDs.

For research coverage use separate bounded contracts because the semantics are different:

```text
ResearchCoverageSummary
ResearchCoverageFeaturePage
```

Do not force research footprints into the same model as county poverty or payroll.

## Accessibility contract

Every new layer inherits the existing map-equivalence rules:

- category summary remains keyboard operable and exposes active-child state;
- every child is independently operable;
- a collapsed category never disables a checked child;
- every mapped numeric value exists in a semantic table/list;
- measure/year/source/provenance are textual;
- color is not the only representation of value or selection;
- panning, dragging or canvas hit-testing is never required to obtain the information;
- selection is synchronized through application state without stealing focus;
- large matching research lists use bounded/cursor traversal.

## Recommended implementation order

1. Finish the category/disclosure PR with the four-category taxonomy, showing only the three categories that currently have implemented children.
2. Add authoritative shared county geometry and migrate SAIPE off generated rectangular cells.
3. Add Repository research-by-area coverage from already-retained curated metadata.
4. Add Population Estimates county layer.
5. Add CBP county layer with measure/industry configuration.
6. Add BDS, then Building Permits.
7. Add a deterministic Data.gov spatial-availability probe and targeted sidecar enrichment.
8. Extend NASA CMR collection mapping with explicit spatial extent; then bounded granule coverage.
9. Consider 3DEP terrain and PUMA/ACS layers after the common geometry/value contracts are proven.

This sequence creates visible product value early while preserving the evidence-first and accessibility boundaries.