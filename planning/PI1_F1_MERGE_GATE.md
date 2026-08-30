# PI-1 F1 Merge Gate

This checkpoint records the merge boundary for the active `codex/federated-metadata-catalog` branch.

## Proven live milestone — 2026-08-30

The Data.gov Catalog API v4 path has been proven against live publisher metadata using the versioned `data-gov-catalog-v4-v2` adapter and a personal `api.data.gov` key:

- 10 bounded pages x 100 source records,
- 1,000 accepted,
- 0 rejected,
- 0 skipped,
- durable `PAUSED` run with an opaque resume cursor,
- 1,000 retained `DATA_GOV` records in application PostgreSQL,
- 181 curated DSpace-backed records,
- 1,181 objects in the combined Solr/OpenSearch discovery projection,
- projection SHA-256 `5ad44932acd6166e9a32576ff06df9c4659cfba5f8800d952762503703af47dd`.

The earlier v1 proof accepted 925 and quarantined 75 valid date-only `modified` values. The v2 normalization change accepts ISO date-only publisher values and the repeated 1K proof accepted all 1,000 records. This is retained as useful live-data regression evidence rather than hidden as a fixture-only correction.

## What this proves

The following path is now real rather than architectural intent:

```text
Data.gov
  -> Spring Boot federated harvester
  -> durable run/checkpoint/quarantine evidence
  -> application PostgreSQL federated catalog
  -> CombinedDiscoveryCatalog
  -> bounded deterministic projection
  -> Solr + OpenSearch
  -> Angular discovery
```

Adding or refreshing metadata does not require rebuilding Angular. Harvest and projection change the searchable corpus; the UI remains response-driven.

## Merge gate for PR #3

Do not extend this already-large foundation PR through the 10K/100K scale exercises. Finish the mixed-authority product slice first, then merge.

Required before PR #3 is merge-ready:

- [ ] Source-system facet is selectable in normal Discovery, not display-only.
- [ ] Publisher facet is selectable in normal Discovery, not display-only.
- [ ] Search query/URL state carries source and publisher filters without fixed allowlists.
- [ ] `/research/:id` is the canonical research-object detail route.
- [ ] `/datasets/:id` remains as a compatibility route for existing links.
- [ ] Detail resolution reads either DSpace/fixture content or `FederatedMetadataCatalog` based on the requested identity.
- [ ] Federated detail clearly labels `FEDERATED` origin and source system and links to the authoritative publisher resource without inventing locally preserved files.
- [ ] Discovery result links use the authority-neutral research route.
- [ ] Unit, controller, browser and accessibility tests cover mixed repository + federated discovery/detail behavior.
- [ ] CI and Browser Evidence are green on the merge-candidate head.

## After merge

Create the next scale branch from fresh `main` and prove Data.gov 10K before 100K. Capture accepted/rejected/skipped counts, projection identity, storage growth, duration and host/container/JVM context. The 10K run should exercise the same semantics merged here; it must not require another UI or domain rewrite merely because the corpus is larger.

The subsequent PI-1 sequence remains Data.gov 10K -> Data.gov 100K -> DOE OSTI -> first controlled 1M corpus, while the broader PI-1 exit criteria still require all planned source adapters and reproducible manifests.
