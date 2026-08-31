# Composite Corpus Manifest Plan

## Purpose

The evidence-grade `FEDERATED_100K` baseline proves deterministic identity for one bounded external source. The first mixed-source tier needs a higher-level identity before it can be activated or benchmarked.

This plan defines that identity boundary for `FEDERATED_1M` and later heterogeneous tiers.

## Invariants

1. A composite corpus references already captured bounded source snapshots; it does not rescan publisher data while computing composition identity.
2. Every source appears at most once in a composition.
3. Every source quota is explicit and must exactly match the selected bounded snapshot's retained-record count.
4. The sum of source quotas must exactly equal the selected corpus profile's federated target.
5. Source ordering, database page size, harvest batch size, process restarts and wall-clock capture time must not change the composition SHA.
6. Harvest run IDs and capture timestamps remain provenance, but they are not semantic corpus identity.
7. Search projection identity is derived state and is linked to composition evidence separately; it is not part of the composition SHA.
8. A composition SHA is insert-once evidence. Re-capturing the same semantic composition is idempotent and must not overwrite the original durable evidence row.
9. Reusing an existing composition SHA for different source identity is an error.
10. DSpace curated objects remain authoritative repository content and are counted separately from the federated source target, as in the established 100K profile.

## Version 1 model

`federated-composition/v1` records:

- corpus profile,
- ordered source evidence,
- exact requested records per source,
- bounded snapshot ID and source SHA-256,
- supporting harvest run ID,
- run adapter version,
- normalized-record adapter versions,
- source snapshot capture time,
- total federated record count,
- deterministic composition SHA-256,
- composite evidence capture time.

The canonical composition digest includes only:

- composition version,
- corpus profile,
- source system,
- requested record count,
- bounded snapshot ID,
- bounded snapshot SHA-256.

Operational provenance such as run ID and capture timestamps is preserved in the durable manifest but deliberately excluded from the digest. This allows byte-for-byte equivalent normalized source slices to reproduce the same corpus identity when harvested again later.

## Initial 1M recipe

The first intended evidence-grade mixed-source recipe remains:

```text
500,000 Data.gov
500,000 DOE OSTI.GOV
+ curated DSpace objects
```

The federated target is exactly 1,000,000 records. Curated DSpace objects are added by projection and therefore make projected object count larger than the federated target, just as the 100K profile projects 100,000 federated records plus 181 curated objects.

## Delivery sequence

### PR 1 — identity foundation

- immutable composite source model,
- immutable composite manifest model,
- deterministic composition service,
- durable PostgreSQL/H2-compatible manifest store,
- deterministic unit tests,
- store round-trip and immutability tests.

### PR 2 — Admin/OpenAPI evidence surface

- read-only Admin endpoint for composition evidence,
- explicit capture command/endpoint guarded by existing bounded snapshot evidence,
- OpenAPI schema and generated TypeScript client,
- Admin UI representation with accessible source/provenance table,
- API/UI tests.

### PR 3 — projection linkage

- projection activation consumes a named composite manifest rather than document-count-only selection,
- projection evidence records composition SHA,
- parity checks verify source quotas and total composition before ACTIVE is persisted,
- restart/reactivation reproduces the same composition/projection linkage.

### PR 4 — live 1M evidence

- retain/capture exact 500K Data.gov bounded snapshot,
- retain/capture exact 500K DOE OSTI bounded snapshot,
- capture composite `FEDERATED_1M` manifest,
- project Solr/OpenSearch from the same composite input,
- verify counts, projection identity and storage evidence,
- run the established paired-order search research protocol with source-aware scenarios.

## Future 10M / 100M tiers

The same composite identity model should survive transport changes. Live API snapshots, publisher bulk files, S3 snapshots and partition manifests may differ operationally, but each source contribution must still resolve to an immutable normalized-record snapshot identity before it participates in a composite corpus.

At 10M/100M, source manifests may need additional bulk provenance fields such as publisher release ID, file/partition ID and transport checksum. Those fields should extend source evidence without changing the core rule that composition identity is independent of ingestion batching and search topology.
