# PI-1 F1 Merge Gate

This document is the historical merge-boundary record for `codex/federated-metadata-catalog` and PR #3.

**Status: CLOSED.** PR #3 merged to `main` on 2026-08-30 at merge commit `4569416371c15bfe96660d53c4756a48d3c4ed4b`. Subsequent Data.gov scale evidence belongs in [PI1_DATA_GOV_SCALE_EVIDENCE.md](PI1_DATA_GOV_SCALE_EVIDENCE.md).

## Proven live milestone — 2026-08-30

The Data.gov Catalog API v4 path was proven against live publisher metadata using the versioned `data-gov-catalog-v4-v2` adapter:

- 10 bounded pages x 100 source records,
- 1,000 accepted,
- 0 rejected,
- 0 skipped,
- durable `PAUSED` run with an opaque resume cursor,
- 1,000 retained `DATA_GOV` records in application PostgreSQL,
- 181 curated DSpace-backed records,
- 1,181 objects in the combined Solr/OpenSearch discovery projection,
- bounded snapshot ID `DATA_GOV:78a2ec438b3dc3eab179fd94f5dd70c58fa770e3e18186dd624f078b0cbc3ce9`,
- snapshot SHA-256 `78a2ec438b3dc3eab179fd94f5dd70c58fa770e3e18186dd624f078b0cbc3ce9`,
- projection SHA-256 `5ad44932acd6166e9a32576ff06df9c4659cfba5f8800d952762503703af47dd`,
- durable persisted snapshot -> projection relationship,
- public search returned exactly 1,000 `DATA_GOV` results with `origin: FEDERATED` and `sourceSystem: DATA_GOV`.

The source-system facet on the mixed 1,181-object projection reported `DATA_GOV = 1000`, `CENSUS = 178`, and `USGS = 3`, which reconciles the federated and curated portions of the live corpus.

The earlier v1 proof accepted 925 and quarantined 75 valid date-only `modified` values. The v2 normalization change accepts ISO date-only publisher values and the repeated 1K proof accepted all 1,000 records. This is retained as useful live-data regression evidence rather than hidden as a fixture-only correction.

## What this proved

The following path is real rather than architectural intent:

```text
Data.gov
  -> Spring Boot federated harvester
  -> durable run/checkpoint/quarantine evidence
  -> application PostgreSQL federated catalog
  -> deterministic bounded snapshot
  -> CombinedDiscoveryCatalog
  -> bounded deterministic projection
  -> Solr + OpenSearch
  -> persisted snapshot/projection evidence
  -> Spring search/detail API
  -> Angular discovery
```

Adding or refreshing metadata does not require rebuilding Angular. Harvest and projection change the searchable corpus; the UI remains response-driven.

## Merge gate for PR #3 — satisfied

The foundation PR deliberately stopped before the 10K/100K scale exercises.

Required before PR #3 was merge-ready:

- [x] Source-system facet is selectable in normal Discovery, not display-only.
- [x] Publisher facet is selectable in normal Discovery, not display-only.
- [x] Search query/URL state carries source and publisher filters without fixed allowlists.
- [x] `/research/:id` is the canonical research-object detail route.
- [x] `/datasets/:id` remains as a compatibility route for existing links.
- [x] Detail resolution reads either DSpace/fixture content or `FederatedMetadataCatalog` based on the requested identity.
- [x] Federated detail clearly labels `FEDERATED` origin/source and links to the authoritative publisher resource without inventing locally preserved files.
- [x] Discovery result links use the authority-neutral research route.
- [x] Unit, controller, browser and accessibility tests cover mixed repository + federated discovery/detail behavior.
- [x] CI and Browser Evidence were green on merge-candidate head `2cc46cd9faa8366cdf4931d366b05fc40d3b8f11`.

## Post-merge follow-through

The next scale branch was created from the merged `main` commit as `codex/data-gov-10k-scale`.

On 2026-08-30 that branch resumed the same durable Data.gov run from the 1K checkpoint for 90 additional pages of 100 records and reached:

- the same run ID `e8dcd9ef-85d5-48d4-8b13-4f8cdc939131`,
- 100 total pages,
- 10,000 accepted,
- 0 rejected,
- 0 skipped,
- status `PAUSED`,
- no failure,
- `projectionRefreshRequired: true`.

That proves the 10K **harvest/resume** path. It does not by itself complete the 10K scale checkpoint. Snapshot, guarded projection linkage, public-search/detail verification, Solr/OpenSearch parity and storage/resource evidence remain to be captured before proceeding to 100K.

The subsequent PI-1 sequence remains Data.gov 10K evidence completion -> Data.gov 100K -> DOE OSTI -> first controlled 1M corpus, while the broader PI-1 exit criteria still require all planned source adapters and reproducible manifests.
