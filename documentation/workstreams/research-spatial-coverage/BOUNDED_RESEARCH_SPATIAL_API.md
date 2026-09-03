# Bounded Research Spatial API

## Purpose

The bounded Research Spatial API is the read boundary between the versioned spatial sidecar and the Maps experience.

It exists to make the retained Data.gov spatial population usable at federated scale without sending the complete sidecar to the browser. The endpoint pins each request to one activated sidecar build, applies the current Discovery criteria shape, applies a WGS84 viewport, reports explicit map-eligibility counts, and returns only a deterministic bounded feature set.

This is a read-only layer. It does not mutate C2, rebuild the sidecar, or activate a new spatial build.

## Endpoint

```text
GET /maps/research-coverage
```

The endpoint accepts:

- `q` — the public search terms;
- repeatable `program` values;
- `publisher`;
- `sourceSystem`, defaulting to `DATA_GOV`;
- `geography`;
- `contentType`;
- `vintageYear`;
- `west`, `south`, `east`, and `north` WGS84 viewport coordinates;
- `limit`, defaulting to 200 with a hard maximum of 500 features.

The criteria names intentionally mirror Discovery so the Maps UI can carry a user's search state into Maps without inventing a second filter model.

## Snapshot consistency

The query service resolves the active sidecar build once at request start and pins every count and feature query to that build ID.

The response returns the pinned build evidence:

- build ID;
- sidecar schema version;
- source snapshot and capture timestamps;
- C2 composition SHA-256;
- discovery projection ID;
- normalized criteria fingerprint.

A sidecar rebuild can therefore activate concurrently without causing one Maps response to mix counts from one build and features from another.

## Population semantics

The response deliberately separates research-object matching from map rendering eligibility.

- `matchingRecords` — retained sidecar rows whose federated metadata matches the effective Discovery criteria.
- `mappedRecords` — matching rows with queryable `VALID` or `ANTIMERIDIAN_CANDIDATE` publisher geometry.
- `unmappedRecords` — matching `NO_PUBLISHER_GEOMETRY` rows. These are retained geospatial source matches, not missing research objects.
- `quarantinedRecords` — matching rows whose publisher geometry is preserved as evidence but is structurally or coordinate-domain invalid.
- `unanchoredAntimeridianRecords` — matching antimeridian candidates that do not have the explicit render anchor required for safe viewport eligibility.
- `viewportMappedRecords` — mapped records eligible for the requested viewport under the ordinary-geometry or antimeridian-candidate rules.
- `returnedFeatures` — features actually returned after the hard feature limit.
- `omittedFeatures` — viewport-mapped records intentionally not returned because of the limit.
- `truncated` — true when one or more viewport-mapped features were omitted.

This means a user can still be told that matching research exists even when some records cannot safely be drawn.

## Viewport rules

All coordinates use WGS84 longitude/latitude.

- west/east must be inside `[-180, 180]`;
- south/north must be inside `[-90, 90]`;
- south must be less than or equal to north;
- `west <= east` is an ordinary viewport;
- `west > east` is a viewport that crosses the antimeridian.

For ordinary `VALID` geometry, viewport eligibility uses the normalized sidecar bounds.

For an `ANTIMERIDIAN_CANDIDATE`, the service does not interpret the naive min/max longitude envelope as an ordinary bounding box. The record is viewport-eligible only when it has the explicit sidecar render anchor and that point falls inside the requested viewport.

An unanchored antimeridian candidate remains part of the mapped population evidence but is not forced onto the map.

## Deterministic feature bounding

The browser never requests or receives the full sidecar population.

Returned features are sorted deterministically by normalized title and source identifier, then limited by the requested feature limit. The current hard maximum is 500.

The response includes `viewportMappedRecords`, `returnedFeatures`, `omittedFeatures`, and `truncated`, so the UI can tell users when the map is displaying a bounded subset rather than implying that every matching feature is visible.

The service returns full publisher GeoJSON only for the bounded feature rows selected for the current request.

## Discovery compatibility

The service uses the current federated Data.gov metadata fields that are actually present in the repository: title, summary, publisher, program, content type, source system, and source URL.

Current federated Data.gov discovery documents do not project `geography` or `vintageYear`. When either of those criteria is supplied, the spatial query returns zero Data.gov matches instead of inventing metadata or silently weakening the filter.

This remains an explicit compatibility boundary and can be revisited if those fields are later added to the federated projection.

## Query text semantics

Text matching follows the existing in-memory Discovery fallback semantics over the Data.gov metadata available to this reader:

- one or two query terms require all terms;
- three or more query terms require at least two thirds of the terms;
- matching is case-insensitive across title, summary, publisher, and program.

The normalized criteria are fingerprinted so one response carries an auditable identity for the effective search/filter state.

## Accessible Maps contract

The API serves both the visual map and the semantic equivalent.

Each returned feature carries research metadata together with publisher geometry:

- source system and source identifier;
- title;
- publisher;
- program;
- content type;
- authoritative source URL;
- geometry status;
- publisher GeoJSON;
- optional explicit render point and render-point method.

The summary counts are independent of MapLibre. The Maps UI exposes the same matching/mapped/unmapped/quarantined/truncated state in semantic HTML and a keyboard/screen-reader-friendly results table while MapLibre renders the bounded geometry set.

## Implemented Maps UI

The Research Coverage UI now consumes this endpoint directly.

- Discovery criteria are preserved as engine-neutral spatial criteria.
- The initial accessible viewport can come from the selected Census boundary before WebGL is available.
- Once MapLibre is active, bounded requests refresh after meaningful `moveend` viewport changes.
- Request fingerprints prevent duplicate viewport requests and NgRx latest-request semantics prevent stale responses from replacing newer state.
- Ordinary publisher geometry renders through dedicated fill, line, and point layers.
- Antimeridian candidates render only from their explicit safe source-derived anchor rather than a naive world-spanning envelope.
- The semantic Research Coverage component exposes the exact bounded feature set and the same mapped/unmapped/quarantined/truncated evidence as the map.
- Storybook covers loading, populated/truncated, empty viewport, no-publisher-geometry, and no-response states under the repository's axe configuration.
- Targeted Playwright evidence verifies the bounded request contract and MapLibre visibility behavior; raw MapLibre/WebGL assertions remain Chromium-specific where appropriate.

## Error contract

- invalid viewport or feature-limit input returns HTTP 400;
- an unavailable active sidecar source returns HTTP 503;
- unexpected server failures use the repository's shared HTTP 500 contract.

At present the active persisted spatial source is Data.gov. The source parameter remains explicit so the contract does not hard-code Data.gov into future Research Coverage children.

## Scaling boundary

```text
certified C2 federated metadata
          +
active versioned spatial sidecar
          |
          v
shared Discovery criteria
          +
WGS84 viewport
          |
          v
matching / mapped / unmapped / quarantined counts
          +
viewport eligibility
          |
          v
deterministic feature cap (<= 500)
          |
          +--> MapLibre bounded features
          |
          +--> semantic summary/table equivalent
```

The sidecar remains the durable spatial evidence layer. This API is the scale-control layer.

## Next research-coverage direction

The next spatial expansion should add a new source or semantic capability rather than bypassing this bounded contract. NASA CMR collection coverage remains the strongest candidate; collection and granule coverage must stay distinct, and granule results must be bounded by collection, viewport and/or time before reaching the browser.

Any new Research Coverage child inherits the same requirements: authoritative source geometry, version/projection provenance, explicit truncation, semantic HTML equivalence, keyboard access, Storybook/axe state evidence, and browser proof that the visual map never becomes the sole information channel.
