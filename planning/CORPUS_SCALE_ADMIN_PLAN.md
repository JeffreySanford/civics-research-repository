# Corpus Scale Admin and Evidence Plan

This document defines how the staged federation corpus should become an operator-controlled, measurable capability in Admin Sync without making ordinary development depend on a large corpus.

## Scale ladder

The intended local scale ladder is:

```text
curated demo (~200; currently 181)
        ↓
10K federated
        ↓
100K federated
        ↓
1M federated
        ↓
FULL / source-defined bound where explicitly requested
```

The first tier is deliberately described as approximately 200 rather than exactly 200. It is the curated repository regression/demo corpus and may change slightly as curated research objects evolve. The federated tiers are explicit scale checkpoints.

Current backend profile identifiers already represent the main named tiers:

```text
CURATED_DEMO
FEDERATED_10K
FEDERATED_100K
FEDERATED_1M
FULL
```

Named profiles are preferred over an arbitrary record-count textbox because a profile can carry reproducible evidence expectations, safety rules and historical measurements. A custom bounded profile may be added later if there is a concrete use case, but it must preserve the same snapshot/projection identity rules.

## Current state

The Admin corpus-storage UI can currently **view** profiles and historical storage captures, but profile selection is read-only. The backend also currently reports `CURATED_DEMO` as the active profile even when retained federated metadata and the active projection are larger.

That behavior was appropriate before bounded streaming projection existed. It is now technical debt rather than the desired final operator experience.

The 10K Data.gov proof established the prerequisites needed to design safe activation:

- durable resumable harvest state,
- deterministic bounded snapshots,
- bounded combined repository + federated projection,
- guarded snapshot -> projection linkage with drift rejection,
- explicit Solr/OpenSearch projection parity,
- persisted storage measurements,
- public search/detail verification.

## Admin profile activation

Admin Sync should evolve from **view profile** to **view + activate profile**.

Activation is an orchestration operation, not a UI-only setting. A safe activation flow should:

1. select a named target profile,
2. show current retained count, active projection count and target count,
3. preview whether the operation requires harvesting, projecting, both, or neither,
4. warn clearly before 100K/1M/FULL heavy operations,
5. resume the compatible durable source run instead of silently restarting,
6. stop at the profile bound,
7. capture a deterministic bounded snapshot,
8. run guarded projection against the unchanged checkpoint,
9. require Solr/OpenSearch count + projection-ID parity,
10. capture storage/resource/performance evidence,
11. record the profile as active only after the guarded operation succeeds,
12. preserve the previous known-good active projection/evidence if activation fails.

The UI should not claim a profile is active merely because its metadata has been harvested. `retainedFederatedCount`, snapshot identity and active search projection are separate facts.

### Suggested UI controls

For each named profile, Admin should expose:

- profile name and target federated record count,
- state: `AVAILABLE`, `HARVESTING`, `SNAPSHOT_READY`, `PROJECTING`, `ACTIVE`, `FAILED`,
- current retained metadata count,
- current active projection count,
- latest snapshot ID,
- latest projection ID,
- `Activate profile` / `Resume activation` action,
- explicit heavy-operation warning for 100K, 1M and FULL,
- `Capture current footprint` action,
- latest evidence timestamp.

A profile switch must never delete the authoritative federated metadata merely to make the search index smaller. Search indexes are derived state. Corpus-retention policy and active-projection policy remain separate.

## Metrics at every tier

Every meaningful tier should produce a comparable evidence record. The Admin experience should eventually show both the latest measurement and historical measurements for each profile.

### Storage

Record at minimum:

- application PostgreSQL bytes,
- DSpace stored bytes,
- Solr index bytes,
- OpenSearch index bytes,
- total known measured local bytes,
- bytes per federated record where a defensible before/after pair exists,
- bytes per projected document for Solr and OpenSearch,
- projection document count,
- retained federated count.

### Harvest and projection performance

Record at minimum:

- records/pages requested,
- accepted/rejected/skipped counts,
- harvest elapsed time,
- effective records/second,
- projection elapsed time,
- projected documents/second,
- projection ID,
- target engine success/failure state.

### Query performance

Use stable query definitions and record separately for Solr and OpenSearch:

- API elapsed time,
- Solr `QTime`,
- OpenSearch `took`,
- warmups excluded,
- p50/p95/p99/min/max/mean,
- measured request count,
- concurrency,
- errors/timeouts,
- corpus snapshot/projection ID.

A performance result is invalid for comparison if the engines are not on the same projection identity.

### Resource context

Record at minimum:

- host logical CPU count,
- host memory,
- Docker/VM memory and CPU allocation where discoverable,
- repository-api JVM heap/config and observed process/container usage,
- Solr JVM/container memory context,
- OpenSearch JVM/container memory context,
- deployment topology,
- shard/replica/node layout once PI-2 begins.

Resource context matters because a slow result caused by host pressure is not evidence that one search engine is intrinsically slower.

## Scale evidence table

Admin should eventually be able to present a summary conceptually similar to:

| Profile | Retained | Projected | PostgreSQL | Solr | OpenSearch | Harvest | Projection | Query p50/p95 | Resources | Snapshot / Projection |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| Curated ~200 | measured | measured | measured | measured | measured | N/A | measured | measured | measured | IDs |
| 10K | 10,000 | 10,181 | measured | measured | measured | measured | measured | measured | measured | IDs |
| 100K | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending |
| 1M | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending |

The table should display `Not measured` rather than zero when evidence is unavailable.

## Quality-gate split

`quality:all` is the deterministic repository gate. It should remain appropriate for ordinary local development and pull requests:

- formatting,
- OpenAPI lint/generated drift,
- fixture/evidence/document drift,
- benchmark-tool unit tests,
- lint,
- all unit/service/component tests,
- builds for all buildable runtime/application targets,
- deterministic storyboard/WCAG/Section 508 browser report suites.

It should **not** harvest or project 10K/100K/1M live corpora. Those operations depend on external APIs, persistent local state, machine capacity and long-running evidence collection.

A separate live scale gate should be added, conceptually `quality:scale` or `scale:evidence:check`. Given an expected named profile, it should fail when any required live invariant is false, including:

- retained count does not match the profile checkpoint,
- deterministic snapshot is absent,
- active projection is not linked to that snapshot,
- Solr/OpenSearch are not on the same projection ID/count,
- normal public search does not expose the expected federated count/provenance,
- required storage/resource/duration evidence is absent for a checkpoint being declared complete.

The 1M/full gate should remain explicit/manual or scheduled rather than an ordinary PR check.

## Near-term implementation order

Before Data.gov 100K:

1. replace the hard-coded active `CURATED_DEMO` profile label with runtime-derived active-profile semantics,
2. persist profile activation/evidence state,
3. add reusable harvest and projection duration measurements,
4. capture host/container/JVM resource context,
5. add the first live scale-evidence checker,
6. expose those measurements in the Admin corpus-scale panel,
7. then enable guarded Admin activation for `FEDERATED_10K` and use the same path for `FEDERATED_100K`,
8. require the 100K evidence checkpoint before enabling/attempting the 1M profile.

The 10K experiment is the proving ground for this instrumentation. The 100K run should consume the instrumentation rather than requiring the evidence to be reconstructed manually afterward.
