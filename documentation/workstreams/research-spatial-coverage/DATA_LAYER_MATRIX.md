# Data-to-Map Layer Matrix

## Decision

Organize Maps by **research purpose**, not by publisher.

The stable top-level taxonomy is:

1. **Geography & Boundaries** — geometry used to orient or join other measures.
2. **Community & Economy** — demographic, workforce, poverty, business, housing, and population measures.
3. **Environment & Hazards** — terrain, water, and event/hazard context.
4. **Research Coverage** — where research objects explicitly say they apply, plus administrative summaries of matching repository/search objects.

A category owns presentation only. Every child remains independently checkable and renderable. Closing a category never disables checked children.

Only show a child when its backing capability is actually available. Do not expose permanently disabled future layers merely to advertise planned work.

## Current catalog and map value

The committed curated inventory contains 181 research objects. The major area-scoped groups are TIGER/Line, ACS PUMS, and LODES; the repository also retains national Census/USGS catalog objects and LEHD research-package metadata.

### Geography & Boundaries

**TIGER/Line**

- Existing scope: area-scoped research objects and tract source archives.
- Map role: authoritative state/county/tract/PUMA geometry and stable joins.
- Priority: foundation.
- Current status: state-level preview exists; shared authoritative county geometry is implemented in this workstream.

### Community & Economy

**LODES workplace employment**

- Existing scope: retained area-scoped LODES WAC objects.
- Map role: workplace jobs/employment intensity.
- Current status: implemented.

**LODES commuting flows**

- Existing scope: bounded flow service.
- Map role: origin-destination lines and selected flow context.
- Current status: implemented.

**SAIPE**

- Existing scope: retained county-value fixture for North Dakota, California, and Texas plus repository catalog metadata.
- Map role: poverty/median-income county choropleth.
- Current status: implemented and migrated to authoritative 2023 county geometry in this workstream.
- Capability rule: do not advertise SAIPE where no retained values exist.

**Population Estimates**

- Existing source capability: county-level population measures.
- First map role: population, annual change, and growth-rate county choropleth.
- Priority: next county thematic layer after capability-aware Maps controls.
- Geometry: reuse `AdministrativeGeometryService`.

**County Business Patterns**

- Existing source capability: county establishments, employment, first-quarter payroll, annual payroll, and industry detail.
- First map role: business employment by county.
- Priority: high.
- UI model: one conceptual layer with measure and industry parameters rather than separate checkboxes for every metric.

**Business Dynamics Statistics**

- Existing source capability: state/county/metro measures such as job creation/destruction and establishment births/deaths.
- First map role: job creation rate by county.
- Priority: high after Population Estimates/CBP.

**Building Permits**

- Existing source capability: national, state, CBSA, county, and place statistics.
- First map role: housing units authorized by county.
- Priority: later county layer; place symbols can follow when place geometry/coordinates are available.

**Economic Census**

- Existing source capability: subnational establishments/employment/payroll/sales by industry.
- Map role: later configurable county/business layer.
- Priority: later.

**ACS PUMS**

- Existing scope: area-scoped metadata with PUMA-capable microdata.
- Map rule: never draw person-level microdata points.
- Future role: weighted PUMA/state indicators only, with explicit survey-weight methodology and authoritative PUMA geometry.

### Environment & Hazards

**USGS 3HP hydrography**

- Map role: hydrography reference.
- Current status: implemented.

**USGS earthquakes**

- Map role: recent event points with magnitude/time context.
- Current status: implemented.

**USGS 3DEP**

- Current catalog representation includes a sample DEM reference.
- Future map role: terrain/hillshade through an authoritative rendering service while repository metadata continues to document provenance.
- UI model: one 3DEP terrain layer with visualization mode, not separate permanent checkboxes for hillshade/slope/aspect variants.

## Immediate research-coverage value from retained metadata

### Repository research by area

This is the first Research Coverage child that can be implemented without a new publisher crawl.

Area-scoped curated objects already carry explicit administrative geography. A map summary can aggregate matching repository/search objects by area.

The value means:

> count of matching research objects whose metadata explicitly names this administrative area

It does **not** mean that every publication scientifically studies or covers every location inside that area.

Selection should expose the corresponding research objects in semantic HTML and reuse bounded/cursor search behavior where result sets become large.

## Shared administrative geometry

Do not add a separate polygon implementation for each thematic measure.

The shared geometry boundary should expose stable join identifiers such as:

```text
state / territory -> state FIPS
county / county-equivalent -> county GEOID
PUMA -> PUMA code
tract -> tract GEOID
```

Current county implementation:

```text
AdministrativeGeometryService
  -> explicit geometry vintage
  -> Census TIGERweb GeoJSON
  -> WGS84
  -> deterministic GEOID order
  -> validated Polygon/MultiPolygon features
  -> cache by vintage/state FIPS
  -> no synthetic fallback
```

Thematic services provide values keyed by geography identifier. Geometry is authoritative Census geometry and is joined separately.

This boundary is intended to unlock SAIPE, Population Estimates, County Business Patterns, Business Dynamics Statistics, Building Permits, and Economic Census without duplicating geometry or accessibility logic.

## Federated Research Coverage

### Data.gov

DCAT-US can carry explicit spatial metadata. The current normalized adapter does not yet retain `dcat.spatial`, while retained records may preserve a raw-harvest reference.

Do not replay the entire 500K certified catalog merely to discover spatial fields.

Recommended sequence:

```text
retained Data.gov record
  -> retained raw-harvest reference
  -> deterministic spatial-availability probe
  -> bounded targeted enrichment
  -> parse explicit DCAT spatial
  -> application-owned spatial sidecar
```

The probe should record:

- sampled record count;
- records with spatial metadata;
- parseable admin area / point / bbox / polygon counts;
- malformed/unsupported values;
- source/publisher distribution;
- representative evidence IDs.

Spatial enrichment should have its own version/evidence and should not silently mutate the certified C2 Gold Master identity.

### DOE OSTI

Do not force bibliographic records onto the map. Laboratory, sponsor, or publisher location is not research coverage.

Only map OSTI records when an authoritative record explicitly supplies content/site/spatial coverage.

### NASA CMR

NASA CMR is the strongest future federated spatial source because collection and granule records have explicit spatial semantics.

Keep two concepts distinct:

- **NASA collection coverage** — collection-level footprints or bounds;
- **NASA granule coverage** — bounded viewport/time-filtered granules for selected collections.

Do not silently make granules the same research-object type as collections. Prefer a pinned/documented publisher representation when extending the adapter.

### PubMed and OpenAlex

Do not label author or institution location as research coverage.

If affiliation geography is added later, expose it under a separate analytic concept such as **Research institutions / affiliations**.

## Control model

A checkbox answers one question: **is this conceptual layer rendered?**

Variables belong inside layer configuration:

- measure;
- year/vintage;
- industry/topic;
- time window;
- source system;
- aggregation level.

For example, County Business Patterns should be one checkable layer with `Employment / Establishments / Payroll` as a measure selector, not three permanent top-level children.

## Thematic API direction

Prefer a common thematic value contract where practical:

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

Research coverage should use separate bounded contracts because its semantics are different from population/payroll/poverty values.

Possible future contracts:

```text
ResearchCoverageSummary
ResearchCoverageFeaturePage
```

Do not force research footprints into the same model as county thematic measures.

## Accessibility contract

Every new layer inherits the map-equivalence rules:

- category summary remains keyboard operable and exposes meaningful child state;
- every child is independently operable;
- collapsing a category never disables a checked child;
- mapped numeric values have a semantic table/list equivalent;
- measure, year, source, and provenance are textual;
- color is not the only representation of value or selection;
- panning, dragging, and canvas hit-testing are never required to obtain the information;
- selection is synchronized through application state without stealing focus;
- large matching research lists use bounded/cursor traversal.

## Recommended implementation order

1. Complete authoritative shared county geometry and SAIPE migration. **Implemented in this workstream.**
2. Make Maps controls capability-aware for the selected geography.
3. Add Repository research-by-area coverage from retained explicit administrative metadata.
4. Add Population Estimates county values.
5. Add County Business Patterns with measure/industry configuration.
6. Add Business Dynamics Statistics, then Building Permits.
7. Add a deterministic Data.gov spatial-availability probe and targeted sidecar enrichment.
8. Extend NASA CMR collection mapping with explicit spatial extent, then bounded granule coverage.
9. Consider 3DEP terrain and PUMA/ACS-derived measures after the common geometry/value contracts are proven.