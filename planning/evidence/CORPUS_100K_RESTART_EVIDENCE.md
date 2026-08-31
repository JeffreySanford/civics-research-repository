# FEDERATED_100K Restart and Deterministic Reprojection Evidence

Captured 2026-08-31 UTC on the local `DOCKER_COMPOSE` topology.

This evidence follows the first successful Data.gov 10K -> 100K guarded growth operation. Its purpose is to verify that retained federation authority survives a full application-stack recreation and that the named 100K search projection is deterministically reproducible without harvesting again.

## Precondition

The proven retained Data.gov checkpoint before restart was:

```text
sourceSystem       DATA_GOV
runId              e8dcd9ef-85d5-48d4-8b13-4f8cdc939131
adapterVersion      data-gov-catalog-v4-v2
status             PAUSED
pageSize           100
pageCount          1000
acceptedCount      100000
rejectedCount      0
skippedCount       0
retainedCount      100000
failureMessage     null
```

The first 100K activation produced:

```text
profile            FEDERATED_100K
projected total    100181
projectionId       125fc791065fd8c68806f62a52c2203c2ce74a083954ce469f3e0cd627015024
```

## Full stack recreation

`pnpm start:all:rebuild` recreated the application PostgreSQL, Solr, OpenSearch, repository API and discovery UI containers while keeping persistent corpus data.

Startup deliberately returned search to the quick-start curated profile:

```text
profile            CURATED_DEMO
projected total    181
source             REPOSITORY
```

The retained Data.gov authority remained unchanged after restart:

```text
retainedCount      100000
runId              e8dcd9ef-85d5-48d4-8b13-4f8cdc939131
pageCount          1000
acceptedCount      100000
rejectedCount      0
skippedCount       0
failureMessage     null
cursor             present
```

This demonstrates that retained federated metadata/run state is independent of the active search projection.

## Expected negative evidence before reactivation

Before reactivating `FEDERATED_100K`, the read-only evidence checker correctly returned `valid: false` because `CURATED_DEMO` was active. It still reported search-target parity true for the current 181-document curated projection and preserved the historical 100K storage evidence.

The violations were limited to the facts that should differ after curated startup:

```text
Requested profile is not active; active profile is CURATED_DEMO.
Persisted activation belongs to CURATED_DEMO, not FEDERATED_100K.
Latest storage measurement projection ID does not match the current projection ID.
Latest storage measurement projection count does not match the current projection count.
```

The checker did not mutate or repair state.

## Retained-only 100K reactivation

The retained corpus was reactivated with:

```text
POST /api/admin/reindex?profile=FEDERATED_100K
```

No Data.gov harvest was required. The operation completed as:

```text
phase              COMPLETED
processedDocuments 100181
totalDocuments     100181
percentComplete    100
elapsedMs          25811
terminal rate      ~3881.3 documents/second
message            Corpus profile activation completed.
```

The terminal rate is an end-to-end activation progress diagnostic, not an isolated Solr or OpenSearch throughput benchmark.

## Deterministic projection result

The reactivated projection was:

```text
source             REPOSITORY
objectCount        100181
projectionId       125fc791065fd8c68806f62a52c2203c2ce74a083954ce469f3e0cd627015024
```

The SHA-256 projection identity is **exactly the same** as the first 100K activation before the full stack recreation.

That proves that the unchanged 181 curated objects plus the deterministic bounded 100,000-record federated prefix normalize into the same ordered discovery-document sequence across application-stack recreation and reprojection.

## Independent evidence checker after reactivation

The read-only checker then returned:

```text
profile                         FEDERATED_100K
valid                           true
targetFederatedRecordCount      100000
retainedFederatedRecordCount    100000
activeProfile                   FEDERATED_100K
activationProjectionObjectCount 100181
currentProjectionObjectCount    100181
targetParity                    true
storageEvidencePresent          true
violations                      []
```

All three persisted/live projection identities agreed:

```text
activationProjectionId
  = currentProjectionId
  = storageProjectionId
  = 125fc791065fd8c68806f62a52c2203c2ce74a083954ce469f3e0cd627015024
```

## Proven invariants

This restart experiment proves the following for the current local topology:

1. A full application-stack recreation does not delete retained Data.gov metadata or its durable harvest checkpoint.
2. Startup safely returns the active search profile to `CURATED_DEMO` without changing the retained 100K authority.
3. The evidence checker distinguishes "100K evidence exists" from "100K is active now."
4. An already-retained `FEDERATED_100K` profile can be activated without another publisher harvest.
5. The bounded 100K projection is deterministic across stack recreation: the same corpus produced the same SHA-256 projection identity.
6. The persisted activation record, current projection, enabled Solr/OpenSearch targets and historical storage evidence can be independently verified as one consistent evidence chain.

## Next evidence step

Use this exact `FEDERATED_100K` projection as the fixed corpus identity for controlled Solr/OpenSearch query diagnostics. Query-performance evidence must preserve this projection identity and must remain separate from activation/harvest timing evidence.
