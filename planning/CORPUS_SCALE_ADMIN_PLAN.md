# Corpus Scale Admin and Evidence Plan

This document defines the operator-controlled corpus scale capability in Admin Sync and records the evidence required before a named scale tier is treated as proven. Ordinary development must remain independent of large live corpora.

## Scale ladder

The local scale ladder is:

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

The curated tier is deliberately approximate because the repository regression/demo corpus may evolve. Federated tiers are explicit retained-metadata checkpoints.

Backend profile identifiers:

```text
CURATED_DEMO
FEDERATED_10K
FEDERATED_100K
FEDERATED_1M
FULL
```

Named profiles are preferred over an arbitrary record-count textbox because each profile carries reproducible evidence expectations, safety rules and historical measurements. A custom bounded profile may be added later only if it preserves the same snapshot/projection identity rules.

## Proven current state

Admin Sync now separates **retained corpus**, **viewed profile** and **active search profile**.

The operator can:

- view named profiles without activating them,
- activate an already-retained bounded profile,
- grow and activate the guarded `FEDERATED_100K` tier,
- observe backend-owned progress across harvest/snapshot/projection/evidence phases,
- capture the current active storage footprint,
- review sortable/filterable/paginated historical measurements,
- switch the active projection back to the curated or retained 10K profile without deleting retained federated metadata.

Search indexes remain derived state. DSpace remains authoritative for curated objects. External publishers remain authoritative for federated records; PostgreSQL retains reproducible metadata/evidence.

The startup path has one owner: the Java API activates `CURATED_DEMO`, while the stack script waits for and verifies that activation rather than issuing a second reindex request.

## Proven 10K checkpoint

The Data.gov 10K checkpoint established the first reproducible federation proof:

- harvest run ID: `e8dcd9ef-85d5-48d4-8b13-4f8cdc939131`,
- retained Data.gov metadata: 10,000,
- active combined projection: 10,181 documents at the time of the proof,
- projection ID: `b292f98bb8b141dd477cfbcdc9149e44bd53559c153c431f772809f41836742e`,
- Solr/OpenSearch parity required before activation,
- deterministic snapshot/projection linkage,
- persisted storage measurements.

The same durable run was later resumed for the 100K checkpoint rather than restarted.

## Proven 100K checkpoint — 2026-08-31 UTC

The first real `FEDERATED_100K` operation completed successfully from the existing 10K Data.gov checkpoint.

### Durable harvest evidence

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
cursor             present
```

The run advanced from 100 pages / 10,000 accepted records to 1,000 pages / 100,000 accepted records without resetting source traversal. The cursor remained durable and resumable.

### Projection evidence

```text
profile            FEDERATED_100K
curated objects    181
federated objects  100000
projected total    100181
projectionId       125fc791065fd8c68806f62a52c2203c2ce74a083954ce469f3e0cd627015024
```

The same projection ID is recorded by the live projection state and the persisted `FEDERATED_100K` storage measurement. Activation is recorded only after the guarded snapshot/projection path succeeds.

### Storage evidence

Captured for `DOCKER_COMPOSE` after the verified 100K activation:

| Component                  |         Bytes |
| -------------------------- | ------------: |
| Application PostgreSQL     |   391,091,891 |
| DSpace stored bytes        | 1,073,739,747 |
| Solr index                 |    46,972,408 |
| OpenSearch index           |    43,235,010 |
| Known measured local total | 1,555,039,056 |

The DSpace stored-byte value is essentially unchanged from lower federated tiers because large federated records retain metadata rather than mirroring publisher binaries into DSpace. PostgreSQL and both derived search indexes grow with the federated corpus as expected.

### Operation evidence

The backend progress record finished as:

```text
phase              COMPLETED
processedDocuments 100181
totalDocuments     100181
percentComplete    100
elapsedMs          298230
terminal rate      ~335.9 documents/second
message            Corpus profile growth, verified projection, and storage evidence capture completed.
```

`elapsedMs` is the end-to-end guarded operation duration. The terminal `documentsPerSecond` value is a progress diagnostic based on terminal processed-document count and must not be presented as isolated harvest throughput or isolated search-engine projection throughput.

## Guarded activation state machine

The implemented 100K flow is:

```text
PREPARING
    ↓
HARVESTING
    ↓
SNAPSHOTTING
    ↓
PROJECTING
    ↓
VERIFYING
    ↓
CAPTURING_EVIDENCE
    ↓
COMPLETED / FAILED
```

Important invariants:

1. Retained metadata and active search projection are separate facts.
2. Harvest resumes a compatible durable source run instead of silently restarting.
3. Search remains on the previous known-good projection while harvesting.
4. Bounded profiles snapshot and project the same deterministic stable-ID prefix.
5. Solr and OpenSearch receive the same normalized document set.
6. Profile activation is persisted only after guarded projection/parity succeeds.
7. Projection/checkpoint failure attempts to restore the previous known-good profile.
8. Storage-measurement failure does not roll back an otherwise verified active search projection; it is reported as an evidence warning instead.
9. A profile switch never deletes authoritative retained federated metadata merely to make the active index smaller.
10. Historical measurements are evidence and are not rewritten to make old experiments look cleaner after later fixes.

## Admin operator controls

Current behavior:

- `CURATED_DEMO`: activate from retained curated repository objects.
- `FEDERATED_10K`: activate from already-retained 10K metadata.
- `FEDERATED_100K`: when fewer than 100K Data.gov records are retained, Admin offers guarded **Grow & activate**; when retained, it can be reprojected as a bounded profile.
- `FEDERATED_1M`: deliberately unavailable for one-click growth until the 100K evidence/guardrails are fully reviewed and the next scale step is explicitly enabled.
- `FULL`: remains an explicit source-bound profile rather than a routine scale action.

The progress UI uses backend truth rather than a fake timer. Harvest/snapshot phases display records; projection phases display documents. Percentage is phase-specific and may restart near zero when the operation transitions from harvest to projection.

## Read-only harvest preflight

Before a large operation, operators can inspect durable source state without touching the publisher:

```text
GET /admin/federation/harvest/status?sourceSystem=DATA_GOV
```

The response exposes:

- source-scoped retained record count,
- resumable run when present,
- latest run fallback,
- run ID and adapter version,
- status,
- page size/count,
- accepted/rejected/skipped counts,
- cursor,
- timestamps,
- failure message.

This is the preferred preflight before a future 1M experiment.

## Metrics at every tier

Every meaningful tier should produce a comparable evidence record. Admin currently persists storage/profile history; additional resource and query benchmark evidence remains future work.

### Storage — implemented

Record at minimum:

- application PostgreSQL bytes,
- DSpace stored bytes,
- Solr index bytes,
- OpenSearch index bytes,
- total known measured local bytes,
- projection document count,
- retained federated count,
- projection ID,
- topology,
- capture time.

### Harvest and projection performance — partially implemented

Current runtime captures durable page/record counts plus end-to-end operation progress. Still add explicit phase timing so harvest duration and projection duration can be compared independently.

Future evidence should record:

- records/pages requested,
- accepted/rejected/skipped counts,
- harvest elapsed time,
- effective harvest records/second,
- snapshot elapsed time,
- projection elapsed time,
- projected documents/second,
- parity verification elapsed time,
- projection ID,
- target-engine success/failure state.

### Query performance — pending

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

### Resource context — pending

Record at minimum:

- host logical CPU count,
- host memory,
- Docker/VM memory and CPU allocation where discoverable,
- repository-api JVM heap/config and observed process/container usage,
- Solr JVM/container memory context,
- OpenSearch JVM/container memory context,
- deployment topology,
- shard/replica/node layout once PI-2 begins.

Resource context matters because host pressure is not evidence that one search engine is intrinsically slower.

## Scale evidence table

| Profile      | Retained                    | Projected     | PostgreSQL    | Solr           | OpenSearch     | Known measured total | Projection ID  |
| ------------ | --------------------------- | ------------: | -------------: | -------------: | -------------: | -------------------: | -------------- |
| Curated ~200 | retained federation independent |           181 |       measured |       measured |       measured |             measured | historical IDs |
| 10K          | 10,000                      |        10,181 |   47,371,955 B |    5,231,724 B |    5,179,880 B |      1,131,523,306 B | `b292f98b…`    |
| 100K         | 100,000                     |       100,181 |  391,091,891 B |   46,972,408 B |   43,235,010 B |      1,555,039,056 B | `125fc791…`    |
| 1M           | not harvested               | not projected |   Not measured |   Not measured |   Not measured |         Not measured | Not measured   |

`Not measured` means no evidence exists; it must never be rendered as zero.

## Quality-gate split

`quality:all` remains the deterministic repository gate for ordinary local development and pull requests:

- formatting,
- OpenAPI lint/generated drift,
- fixture/evidence/document drift,
- benchmark-tool unit tests,
- lint,
- all unit/service/component tests,
- builds for all buildable runtime/application targets,
- deterministic storyboard/WCAG/Section 508 browser report suites.

It must **not** harvest or project 10K/100K/1M live corpora. Those operations depend on external APIs, persistent local state, machine capacity and long-running evidence collection.

A separate live scale gate should validate named-profile invariants without automatically performing a large harvest. Given an expected profile, it should fail when required live facts are false, including:

- retained source count is below the profile checkpoint,
- deterministic snapshot is absent,
- active projection is not linked to the bounded checkpoint,
- Solr/OpenSearch are not on the same projection ID/count,
- public search does not expose the expected federated provenance,
- required storage evidence is absent for a checkpoint declared complete.

The 1M/FULL gate should remain explicit/manual or scheduled rather than an ordinary PR check.

## Near-term implementation order after the 100K proof

1. Bring the static OpenAPI contract in sync with named profile activation, progress, scale start and harvest-status endpoints; regenerate typed clients.
2. Add a live scale-evidence checker for `FEDERATED_100K` that verifies retained count, active profile, projection count/ID, Solr/OpenSearch parity and storage evidence without mutating the corpus.
3. Capture explicit per-phase harvest/snapshot/projection/parity durations rather than relying only on end-to-end progress time.
4. Capture host/container/JVM resource context.
5. Run stable Solr/OpenSearch query scenarios on the proven 100K projection and persist benchmark methodology/results separately from activation evidence.
6. Review OpenSearch staged-index orphan cleanup using alias resolution plus ownership/staleness criteria; do not use unsafe glob deletion in multi-instance environments.
7. Keep `FEDERATED_1M` growth disabled until the 100K evidence checker and resource/performance instrumentation are satisfactory.
8. Only then design and execute the guarded 100K -> 1M experiment.

The 100K checkpoint is now the proving ground for instrumentation and search comparison. The next scale increase should consume those controls rather than requiring evidence to be reconstructed afterward.
