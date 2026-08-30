# PI-1 Data.gov Scale Evidence

This document is the living evidence record for the staged Data.gov scale path in PI-1. It records only facts observed from the live local stack. A harvest count by itself does not complete a scale checkpoint: reusable checkpoints also require deterministic snapshot/projection evidence, public-search verification and resource/storage context.

## Stable baseline

- PI-1 foundation merged through PR #3.
- `main` merge commit: `4569416371c15bfe96660d53c4756a48d3c4ed4b`.
- Active scale branch: `codex/data-gov-10k-scale`.
- Data.gov adapter: `data-gov-catalog-v4-v2`.
- Curated DSpace-backed baseline: 181 research objects.
- Data.gov harvest run ID: `e8dcd9ef-85d5-48d4-8b13-4f8cdc939131`.
- Page size: 100.

The scale path deliberately resumes the same durable run and publisher cursor. `restart` is not used between the 1K and 10K checkpoints because the purpose is to prove resumability as well as raw ingestion.

## 1K checkpoint — complete

### Harvest

Observed on 2026-08-30:

- status: `PAUSED` by bounded-run design,
- page count: 10,
- accepted: 1,000,
- rejected: 0,
- skipped: 0,
- retained Data.gov records: 1,000.

The earlier v1 live run accepted 925 records and quarantined 75 otherwise-valid records whose Data.gov `modified` value was an ISO date without a time. The versioned v2 adapter corrected that normalization defect and repeated the checkpoint at 1,000/1,000 accepted. The v1 result remains regression evidence rather than being erased.

### Deterministic bounded snapshot

- snapshot ID: `DATA_GOV:78a2ec438b3dc3eab179fd94f5dd70c58fa770e3e18186dd624f078b0cbc3ce9`,
- snapshot SHA-256: `78a2ec438b3dc3eab179fd94f5dd70c58fa770e3e18186dd624f078b0cbc3ce9`,
- retained count: 1,000,
- accepted/rejected/skipped: 1,000 / 0 / 0,
- source update window observed: `2004-11-08T00:00:00Z` through `2026-08-29T09:29:22.300883Z`,
- opaque publisher cursor persisted with the snapshot.

The snapshot remained present after the application stack was rebuilt and containers were force-recreated while persistent volumes were retained.

### Guarded snapshot -> projection relationship

- snapshot SHA-256: `78a2ec438b3dc3eab179fd94f5dd70c58fa770e3e18186dd624f078b0cbc3ce9`,
- projection ID/SHA-256: `5ad44932acd6166e9a32576ff06df9c4659cfba5f8800d952762503703af47dd`,
- projection object count: 1,181,
- composition: 181 curated + 1,000 federated,
- projection rebuilt at: `2026-08-30T19:57:25.302303Z`,
- relationship linked at: `2026-08-30T19:57:25.333011Z`.

The persisted projection-evidence history returned the same snapshot/projection pair after the POST completed.

`projectionSource: REPOSITORY` is currently a compatibility-level label meaning the projection is authority-backed rather than fixture-backed. Per-record `origin` and `sourceSystem` remain the authoritative provenance fields for mixed repository/federated projections.

### Public-search verification

The normal public endpoint returned:

- `totalResults`: 1,000 for `sourceSystem=DATA_GOV`,
- `origin: FEDERATED` on returned Data.gov records,
- `sourceSystem: DATA_GOV` on returned Data.gov records,
- live publisher/program values from the indexed corpus,
- source facet counts `DATA_GOV = 1000`, `CENSUS = 178`, `USGS = 3`.

This proved that federated records were not only retained in PostgreSQL; they were discoverable through the ordinary search/facet path.

## 10K checkpoint — functional and index-growth evidence proven; instrumentation completion in progress

The 10K checkpoint resumed the same durable 1K run rather than restarting from source offset zero.

### Harvest and resumability

Observed on 2026-08-30:

- run ID: `e8dcd9ef-85d5-48d4-8b13-4f8cdc939131` — unchanged from 1K,
- adapter: `data-gov-catalog-v4-v2`,
- status: `PAUSED`,
- page size: 100,
- page count: 100 total,
- accepted: 10,000,
- rejected: 0,
- skipped: 0,
- started at: `2026-08-30T17:23:14.238736Z`,
- updated at: `2026-08-30T20:12:01.218590785Z`,
- failure: none,
- `projectionRefreshRequired`: true,
- resume cursor: `WzE3ODgwMjEzNzg4NzQsMS4wLDIsIjc5ODViOWJiLWRlZjUtNGZhZi04Njg4LWI4NTc2MWM5ZGExMyJd`.

This is a direct resumability proof: the existing 10 pages / 1,000 accepted records were extended with 90 additional bounded pages to 100 pages / 10,000 accepted records while preserving the run identity and source cursor semantics.

### Deterministic bounded snapshot

Captured and persisted on 2026-08-30:

- manifest version: `federated-bounded-snapshot/v1`,
- mode: `BOUNDED_SNAPSHOT`,
- snapshot ID: `DATA_GOV:dbe9d11ba420ddf4c8854eced77aed8f2d9fafcd4f96d5d8be22c419378ef12b`,
- snapshot SHA-256: `dbe9d11ba420ddf4c8854eced77aed8f2d9fafcd4f96d5d8be22c419378ef12b`,
- retained count: 10,000,
- accepted/rejected/skipped: 10,000 / 0 / 0,
- page count: 100,
- first record ID: `DATA_GOV:7FEBA753-FD29-4DE3-860C-61B0A30D2D51`,
- last record ID: `DATA_GOV:https://transtats.bts.gov/NTADmetadata/Automated/USDOT_BTS_NTAD_Waterway_Locks.xml`,
- source update window observed: `2004-11-08T00:00:00Z` through `2026-08-29T09:29:22.300883Z`,
- snapshot captured at: `2026-08-30T20:26:00.380919855Z`.

### Guarded snapshot -> projection relationship

The guarded projection completed without checkpoint drift and persisted the exact relationship:

- snapshot SHA-256: `dbe9d11ba420ddf4c8854eced77aed8f2d9fafcd4f96d5d8be22c419378ef12b`,
- projection ID/SHA-256: `b292f98bb8b141dd477cfbcdc9149e44bd53559c153c431f772809f41836742e`,
- projection object count: 10,181,
- composition: 181 curated + 10,000 federated,
- projection rebuilt at: `2026-08-30T20:57:21.88003542Z`,
- relationship linked at: `2026-08-30T20:57:22.250986422Z`.

The persisted projection-history endpoint returned both the 10K pair above and the earlier 1K pair. This proves that advancing the same harvest run creates a new content-addressed snapshot and projection relationship without erasing prior checkpoint evidence.

### Public-search verification

The normal public endpoint was queried with `sourceSystem=DATA_GOV` after the 10K projection.

Observed:

- `totalResults`: 10,000,
- returned records carried `origin: FEDERATED`,
- returned records carried `sourceSystem: DATA_GOV`,
- publisher and program facets came from the live indexed metadata,
- source facet counts were `DATA_GOV = 10000`, `CENSUS = 178`, `USGS = 3`, matching the 10,181-object mixed corpus.

Representative returned records included EPA and National Park Service metadata. The expanded corpus also exposed a taxonomy/presentation seam: valid program values include both long organization names and opaque codes such as `010:118`, `020:072`, `010:10` and `010:12`. The raw publisher values should remain intact while presentation hardening is handled separately.

### Explicit Solr/OpenSearch projection parity

The live comparison endpoint was run after the 10K projection. Its `sameProjection` predicate requires both engines to report the current projection identity and expected document count.

Observed:

- projection source compatibility label: `REPOSITORY`,
- projection object count: 10,181,
- projection ID: `b292f98bb8b141dd477cfbcdc9149e44bd53559c153c431f772809f41836742e`,
- `sameProjection: true`,
- Solr enabled/reachable: true / true,
- Solr index: `discovery`,
- Solr indexed document count: 10,181,
- Solr total hits for the empty comparison query: 10,181,
- Solr warning: none,
- OpenSearch enabled/reachable: true / true,
- OpenSearch index: `discovery-comparison`,
- OpenSearch indexed document count: 10,181,
- OpenSearch total hits for the empty comparison query: 10,181,
- OpenSearch warning: none.

This closes count/projection-identity parity for the 10K standalone checkpoint rather than inferring parity only from storage size or public Solr search results.

### Authority-neutral federated detail verification

The first record in the 10K bounded snapshot was resolved through the canonical research-object API route using its Base64URL research token.

Observed:

- `source: FEDERATED`,
- ID: `DATA_GOV:7FEBA753-FD29-4DE3-860C-61B0A30D2D51`,
- title: `Community Multi-scale Air Quality (CMAQ) Model Outputs`,
- publisher: `U.S. EPA Office of Air and Radiation (OAR) - Office of State Air Partnerships (OSAP)`,
- program name: `020:072`,
- authoritative source URL: `https://catalog.data.gov/dataset/community-multi-scale-air-quality-cmaq-model-outputs`,
- `origin: FEDERATED`,
- `sourceSystem: DATA_GOV`,
- local files: empty list.

This proves the normal authority-neutral detail path at the 10K checkpoint: the federated record resolves as federated metadata, links to the authoritative publisher/catalog resource, and does not invent locally preserved files.

### Storage evidence — before and after 10K projection

A storage capture was taken after the 10K harvest/snapshot but before rebuilding the search projection. At that moment PostgreSQL held 10,000 federated records while Solr/OpenSearch still held the prior 1,181-object projection.

Pre-projection capture `c94a2e78-27ab-467a-a800-57fd33769ab2`:

- active projection count: 1,181,
- retained federated count: 10,000,
- application PostgreSQL: 47,142,579 bytes,
- DSpace stored bytes: 1,073,739,747,
- Solr index: 815,692 bytes,
- OpenSearch index: 802,037 bytes,
- total measured local bytes: 1,122,500,055,
- projection ID: `5ad44932acd6166e9a32576ff06df9c4659cfba5f8800d952762503703af47dd`.

Post-projection capture `1b92ceab-5392-4552-9b0e-56d704220284`:

- active projection count: 10,181,
- retained federated count: 10,000,
- application PostgreSQL: 47,158,963 bytes,
- DSpace stored bytes: 1,073,739,747,
- Solr index: 5,158,329 bytes,
- OpenSearch index: 5,167,844 bytes,
- total measured local bytes: 1,131,224,883,
- projection ID: `b292f98bb8b141dd477cfbcdc9149e44bd53559c153c431f772809f41836742e`.

The isolated transition added 9,000 projected objects while the retained federated corpus was already at 10,000. Measured deltas were:

- Solr: +4,342,637 bytes, approximately 482.5 bytes per newly projected object,
- OpenSearch: +4,365,807 bytes, approximately 485.1 bytes per newly projected object,
- Solr + OpenSearch combined: +8,708,444 bytes, approximately 967.6 bytes per newly projected object,
- application PostgreSQL: +16,384 bytes between the two captures,
- DSpace stored bytes: unchanged,
- total measured local footprint: +8,724,828 bytes.

The PostgreSQL delta between these two captures is **not** a 1K-to-10K database-growth measurement because both captures occurred after the 10K harvest. A historical 1K storage capture is needed to calculate a defensible application-PostgreSQL bytes-per-federated-record value.

The storage endpoint still reports `profile: CURATED_DEMO` because the current active-profile label is hard-coded. The live measurement fields and projection IDs are still useful evidence; profile-selection semantics should be cleaned up separately before relying on that label for automated scale reports.

### 10K completion checklist

- [x] Resume the existing Data.gov run from 1K to 10K without restart.
- [x] Reach 10,000 accepted with 0 rejected and 0 skipped.
- [x] Capture and persist the 10K bounded snapshot.
- [x] Run the guarded snapshot -> combined-projection operation.
- [x] Verify the persisted snapshot/projection relationship.
- [x] Verify the public search path returns exactly 10,000 `DATA_GOV` records.
- [x] Verify a live 10K Data.gov record through `/research/:id` and its authoritative publisher link without invented local files.
- [x] Record explicit Solr and OpenSearch document-count/projection-identity parity from the live comparison endpoint.
- [x] Capture application PostgreSQL, Solr and OpenSearch storage measurements before and after the 10K projection.
- [x] Calculate the isolated incremental Solr/OpenSearch bytes per newly projected object.
- [ ] Calculate application-PostgreSQL bytes per federated record from a comparable 1K/10K pair if historical evidence permits.
- [ ] Record host/container/JVM CPU and memory context for the 10K run/projection.
- [ ] Record harvest/projection duration evidence in a reusable form.

The functional 10K evidence chain and isolated search-index growth evidence are now complete. The remaining work before declaring the whole F1 checkpoint complete is measurement/instrumentation hardening: comparable PostgreSQL growth if historical evidence exists, host/container/JVM resource context, and reusable duration evidence.

## 100K acceptance boundary

Do not begin the 100K proof merely because the functional 10K path succeeded. First close or explicitly disposition the remaining 10K measurement/instrumentation checklist and confirm that storage/resource behavior is understood.

The 100K checkpoint should then repeat the same semantics:

1. resume from the durable Data.gov cursor,
2. preserve namespaced record identity and adapter semantics,
3. capture a deterministic bounded snapshot,
4. build one bounded normalized projection for both Solr and OpenSearch,
5. persist snapshot/projection linkage,
6. verify search/facets/detail through the normal API/UI path,
7. record storage and host/container/JVM context,
8. compare the result with the 10K baseline before moving to a million-record source.

## Evidence rules

- Search engines remain derived state.
- A scale claim must be tied to a deterministic corpus/snapshot identity.
- Accepted/rejected/skipped counts are retained even when zero.
- A bounded `PAUSED` run is expected and is not a source-complete claim.
- Failed or drifting evidence must not be linked to a snapshot as if it were valid.
- Publisher binaries remain external; record count is metadata scale, not mirrored-file scale.
- Performance evidence and semantic/search-quality evidence remain separate.
