# Acceptance Criteria

## Authoritative county geometry

- [x] County geometry comes from an authoritative Census TIGERweb source.
- [x] Geometry vintage is explicit rather than silently bound to the latest service.
- [x] SAIPE 2023 uses 2023 county geometry.
- [x] Current county consumers can request 2025 geometry.
- [x] State FIPS and county GEOIDs are validated.
- [x] Duplicate county GEOIDs are rejected.
- [x] Only Polygon and MultiPolygon county geometry is accepted.
- [x] Counties are returned in deterministic GEOID order.
- [x] Successful responses are cached by `(vintage, stateFips)`.
- [x] Cached GeoJSON is returned defensively so callers cannot mutate the cache.
- [x] No generated rectangle fallback remains in the authoritative geometry path.

## SAIPE

- [x] Retained SAIPE values join to county geometry by stable GEOID.
- [x] A retained SAIPE GEOID without authoritative geometry fails explicitly.
- [x] Missing SAIPE value coverage is not fabricated.
- [x] The response exposes thematic and geometry vintage/provenance.
- [x] North Dakota returns the complete retained 53-county fixture.
- [x] California returns only its 10 retained fixture counties.
- [x] Florida is not claimed as supported when no retained fixture values exist.

## Layer capability truth

- [x] Dataset-layer metadata advertises SAIPE only where retained values exist.
- [ ] Standalone Maps controls derive SAIPE availability from the selected geography/capability contract.
- [ ] Switching from a supported to unsupported geography reconciles selected SAIPE state accessibly.
- [ ] Map category counts reflect only available children.

## Architecture

- [x] Thematic values and administrative geometry remain separate authorities.
- [x] Shared geometry is reusable by later county thematic services.
- [x] Publisher/institution location is not treated as research coverage.
- [x] The source-by-source map expansion sequence is documented.
- [ ] Application-owned research spatial sidecar is implemented in a later dedicated phase.
- [ ] Data.gov/NASA spatial extraction is fixture-backed before live enrichment.

## Evidence before merge

- [x] Repository API unit tests pass for the authoritative geometry/SAIPE implementation.
- [x] Repository API runtime image builds for the authoritative geometry/SAIPE implementation.
- [x] Existing Browser Evidence remains green for the authoritative geometry/SAIPE implementation.
- [ ] Workspace formatting, lint, unit, and production-build gates pass on the final current-main-integrated head.
- [ ] Repository API and Browser Evidence pass on the final current-main-integrated head.
- [ ] Copilot review has no unresolved material findings.
