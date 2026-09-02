# Testing

## AdministrativeGeometryService

`AdministrativeGeometryServiceTest` uses a local HTTP fixture rather than the live Census endpoint so CI proves request and validation semantics deterministically.

Coverage includes:

- current-vintage county lookup defaults to 2025;
- explicit 2023 and 2025 geometry use separate URLs/cache entries;
- query contains the expected state FIPS filter;
- query requests `GEOID,STATE,COUNTY,BASENAME,NAME`;
- query requests WGS84 (`outSR=4326`);
- query requests deterministic `GEOID ASC` order;
- query requests GeoJSON;
- returned counties are normalized into stable GEOID order;
- mutating a returned GeoJSON object does not mutate the cached copy;
- invalid state FIPS is rejected before network access;
- unsupported geometry vintage is rejected before network access.

The production service additionally rejects malformed JSON, empty/non-FeatureCollection responses, duplicate GEOIDs, wrong-state GEOIDs, and non-polygon geometry.

## SaipeCountyChoroplethService

`SaipeCountyChoroplethServiceTest` supplies authoritative-looking fixture geometry keyed by the same retained SAIPE GEOIDs.

Coverage includes:

- North Dakota returns 53 retained county values on 2023 geometry;
- thematic and geometry vintage are both 2023;
- geometry source provenance is retained;
- county features retain Census GEOID properties and add SAIPE values;
- California returns only the 10 values actually retained by the fixture;
- North Dakota, California, and Texas report SAIPE capability;
- Florida does not report SAIPE capability;
- requesting Florida fails rather than fabricating values;
- omitting one authoritative GEOID causes the matching retained SAIPE value to fail explicitly.

## MapLayerService

`MapLayerServiceTest` verifies that map metadata follows actual capability:

- SAIPE is present where retained values exist;
- SAIPE is absent for unsupported Florida;
- geography is resolved from the dataset identifier;
- multi-word area slugs work;
- longest geography match wins where names overlap;
- unmapped dataset identifiers fall back to national metadata;
- existing LODES/USGS layer contracts remain intact.

## Pull-request gates

The final branch should pass:

```text
pnpm exec nx format:check --all
OpenAPI lint and generated-type drift checks
fixture/evidence/platform-status drift checks
performance-statistics harness tests
workspace lint
workspace unit tests
production discovery UI build
Repository API tests
Repository API runtime image build
Browser Evidence
```

Live TIGERweb availability is not required for deterministic unit CI. Runtime publisher failures are explicit and do not trigger generated geometry fallback.

## Browser follow-up

When the Maps controls become capability-aware, add browser evidence for:

- SAIPE control visible for a supported geography;
- SAIPE control absent for an unsupported geography;
- category child counts updating with geography;
- selected SAIPE state being reconciled when navigation moves to unsupported geography;
- semantic legend/list behavior staying synchronized;
- keyboard and focus behavior remaining intact.