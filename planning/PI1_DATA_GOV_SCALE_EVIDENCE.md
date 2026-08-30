# PI-1 Data.gov Scale Evidence

This document is the living evidence record for the staged Data.gov scale path in PI-1. It records only facts that have been observed from the live local stack. A harvest count by itself does not complete a scale checkpoint: reusable checkpoints also require deterministic snapshot/projection evidence, public-search verification and resource/storage context.

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

The guarded projection operation rebuilt discovery, rescanned the harvest checkpoint and persisted the relationship only after confirming that the checkpoint had not drifted during projection.

- snapshot SHA-256: `78a2ec438b3dc3eab179fd94f5dd70c58fa770e3e18186dd624f078b0cbc3ce9`,
- projection ID/SHA-256: `5ad44932acd6166e9a32576ff06df9c4659cfba5f8800d952762503703af47dd`,
- projection object count: 1,181,
- composition: 181 curated + 1,000 federated,
- projection rebuilt at: `2026-08-30T19:57:25.302303Z`,
- relationship linked at: `2026-08-30T19:57:25.333011Z`.

The persisted projection-evidence history returned the same snapshot/projection pair after the POST completed.

`projectionSource: REPOSITORY` is currently a compatibility-level label meaning the projection is authority-backed rather than fixture-backed. Per-record `origin` and `sourceSystem` remain the authoritative provenance fields for mixed repository/federated projections.

### Public-search verification

The normal public endpoint was queried with:

```text
/api/search?sourceSystem=DATA_GOV&page=0&pageSize=5
```

Observed:

- `totalResults`: 1,000,
- returned Data.gov records carried `origin: FEDERATED`,
- returned Data.gov records carried `sourceSystem: DATA_GOV`,
- publisher and program values came from live indexed metadata,
- the source-system facet reported `DATA_GOV = 1000`, `CENSUS = 178`, `USGS = 3`, matching the 1,181-object mixed projection.

This proves that federated records are not only retained in PostgreSQL; they are discoverable through the ordinary search/facet path.

## 10K checkpoint — snapshot captured, evidence completion in progress

The 10K checkpoint resumed the same durable 1K run rather than restarting from source offset zero.

Invocation shape:

```text
POST /api/admin/federation/harvest
sourceSystem = DATA_GOV
pageSize = 100
maxPages = 90
```

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
- run ID: `e8dcd9ef-85d5-48d4-8b13-4f8cdc939131`,
- adapter version: `data-gov-catalog-v4-v2`,
- retained count: 10,000,
- accepted/rejected/skipped: 10,000 / 0 / 0,
- page count: 100,
- page size: 100,
- first record ID: `DATA_GOV:7FEBA753-FD29-4DE3-860C-61B0A30D2D51`,
- last record ID: `DATA_GOV:https://transtats.bts.gov/NTADmetadata/Automated/USDOT_BTS_NTAD_Waterway_Locks.xml`,
- source update window observed: `2004-11-08T00:00:00Z` through `2026-08-29T09:29:22.300883Z`,
- run updated at: `2026-08-30T20:12:01.218591Z`,
- snapshot captured at: `2026-08-30T20:26:00.380919855Z`,
- opaque publisher cursor persisted unchanged from the 10K harvest checkpoint.

The 10K corpus therefore now has a durable content-addressed source identity. The next evidence step must use the guarded projection operation so the resulting mixed Solr/OpenSearch projection is linked to this exact snapshot only if the harvest checkpoint remains unchanged while projection runs.

### 10K completion checklist

- [x] Resume the existing Data.gov run from 1K to 10K without restart.
- [x] Reach 10,000 accepted with 0 rejected and 0 skipped.
- [x] Capture and persist the 10K bounded snapshot.
- [ ] Run the guarded snapshot -> combined-projection operation.
- [ ] Verify the persisted snapshot/projection relationship.
- [ ] Verify the public search path returns exactly 10,000 `DATA_GOV` records.
- [ ] Verify at least one live 10K Data.gov record through `/research/:id` and its authoritative publisher link.
- [ ] Record Solr and OpenSearch document-count/projection-identity parity.
- [ ] Capture application PostgreSQL, Solr and OpenSearch storage measurements.
- [ ] Record host/container/JVM CPU and memory context for the 10K run/projection.
- [ ] Calculate bytes/document for the 10K checkpoint where the probes provide defensible measurements.
- [ ] Record harvest/projection duration evidence in a reusable form.

Until those items are complete, the correct statement is **"10K harvest and deterministic snapshot proven"**, not **"10K scale checkpoint complete."**

## 100K acceptance boundary

Do not begin the 100K proof merely because the 10K harvest succeeded. First close the 10K evidence checklist above and confirm that storage/resource behavior is understood.

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
