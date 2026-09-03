# Federated Scale Evidence

This document records the durable certified C2 standalone research milestone. It is historical/control evidence, not a production-capacity guarantee and not a universal search-engine ranking.

The final C2 evidence sequence extends the original million-record milestone through paired statistics, randomized independent batches, workload/concurrency matrices, resource telemetry, automated statistical synthesis and productized Evidence UI reporting.

## Exact C2 million-record corpus

The certified federated corpus uses one exact source recipe:

| Source              | Retained records |
| ------------------- | ---------------: |
| Data.gov            |          500,000 |
| DOE OSTI            |          500,000 |
| **Federated total** |    **1,000,000** |

Curated DSpace objects are intentionally excluded from the federated composition digest and included later in the normalized search projection.

- Corpus profile: `FEDERATED_1M`
- Composition SHA-256: `e2c7cceb641589715a6390cb35846a67d7361fb15ec00fe3445a3e0036a5524b`
- Retained federated records: **1,000,000**
- Curated DSpace contribution: **181**
- Search projection objects: **1,000,181**
- Projection ID: `3d461a9feb49f7239f3f6aaacb0c90f1ff43d0c683238acc2202c841154db44d`
- Solr indexed documents: **1,000,181**
- OpenSearch indexed documents: **1,000,181**
- Target parity: **verified**

The composition identity answers **which federated source records were retained**. The projection identity answers **which normalized documents, including curated DSpace records, were projected into search**. These identities remain deliberately separate.

## Gold Master archive

The retained corpus is captured as a host-backed archive so the certified million-record state can be restored without repeating the full external harvest.

- Archive ID: `federated-1m-1788269110268-985ce2bd`
- Label: `C2 exact 500K Data.gov + 500K DOE OSTI Gold Master`
- Record count: **1,000,000**
- Compressed bytes: **260,700,364**
- Archive SHA-256: `8ba2cc755f255f108dbcb6eb1621e841925c02e0686487b97d498b780d7deb70`
- Integrity status: **VERIFIED**

Corpus archives live outside Git and are operator evidence, not repository source artifacts.

## Local storage evidence

The exact C2 projection was measured on the Docker Compose research topology:

| Component                |    Measured bytes |
| ------------------------ | ----------------: |
| Application PostgreSQL   |     2,488,071,859 |
| DSpace stored data       |     1,073,739,747 |
| Solr index               |       805,116,078 |
| OpenSearch index         |       824,051,017 |
| **Measured local total** | **5,190,978,701** |

Solr and OpenSearch are parallel derived projections for comparison research. A deployment choosing one engine would not normally pay both derived-index footprints, and production sizing still requires topology-specific headroom, replicas, backups and observability.

## Certified C2 search-research protocol

The final evidence-grade run used the same deterministic projection for both engines and rejected incomplete or mismatched evidence.

Controls:

- profile `FEDERATED_1M`;
- exact projection identity and object-count parity required;
- four workload classes: full text, facets, broad filter and program filter;
- both engine-first orders retained for workload evidence;
- seeded randomized standalone batch order for the independent-batch experiment;
- seed `20260903`;
- **6 independently warmed batches × 20 measured runs = 120 measured paired runs** for the standalone batch experiment;
- request-level paired samples retained descriptively;
- independently warmed batch summaries treated as the preferred repeated experimental unit;
- API elapsed and native Solr `QTime` / OpenSearch `took` retained separately;
- concurrency checkpoints **1 / 8 / 32**;
- CPU, memory, JVM/GC and container telemetry captured with counter-reset detection;
- per-cell confidence intervals explicitly not treated as a multiplicity-adjusted family-wide significance test.

Native Solr `QTime` and OpenSearch `took` are diagnostic timing boundaries with different vendor definitions. They are not presented as semantically identical engine metrics.

## Engine-order robustness

For every tested workload class, Solr retained lower API p50 and p95 in both engine-first orders.

| Workload       |                  Solr-first API p50 / p95 |            OpenSearch-first API p50 / p95 | Order-robust direction |
| -------------- | ----------------------------------------: | ----------------------------------------: | ---------------------- |
| Full text      |     Solr 5 / 5 ms vs OpenSearch 7 / 11 ms |      Solr 2 / 2 ms vs OpenSearch 5 / 6 ms | Solr lower in both     |
| Facets         | Solr 33 / 35 ms vs OpenSearch 83 / 105 ms | Solr 30 / 32 ms vs OpenSearch 83 / 104 ms | Solr lower in both     |
| Broad filter   | Solr 30 / 32 ms vs OpenSearch 92 / 122 ms | Solr 27 / 29 ms vs OpenSearch 91 / 123 ms | Solr lower in both     |
| Program filter |  Solr 17 / 18 ms vs OpenSearch 61 / 77 ms |  Solr 17 / 18 ms vs OpenSearch 60 / 78 ms | Solr lower in both     |

Order robustness summary:

- API p50: **4 / 4** workload classes led by Solr in both orders;
- API p95: **4 / 4**;
- native p50: **4 / 4**;
- native p95: **4 / 4**.

This reduces the likelihood that the observed direction is merely a fixed-order/cache artifact.

## Separately warmed batch inference

The certified standalone batch experiment used full-text relevance with query `North Dakota workforce`.

- independent batches: **6**
- measured runs per batch: **20**
- median paired API difference (OpenSearch − Solr): **4 ms**
- bootstrap 95% CI: **3 .. 4 ms**
- Solr win rate: **100%**
- interval excludes zero: **yes**

Positive differences mean OpenSearch took longer than Solr. Batch medians are the preferred repeated experimental unit for this standalone workload.

## Concurrency matrix

The concurrency experiment is a paired **application topology** comparison, not an isolated maximum-QPS search-engine saturation test.

| Workload       | Clients | Paired req/s | Solr p50 / p95 | OpenSearch p50 / p95 | Batch median OS − Solr (95% CI) |
| -------------- | ------: | -----------: | -------------: | -------------------: | ------------------------------: |
| Full text      |       1 |        60.75 |       1 / 2 ms |             5 / 6 ms |                   4 ms (3 .. 4) |
| Full text      |       8 |       270.84 |       2 / 4 ms |            8 / 14 ms |                   6 ms (5 .. 6) |
| Full text      |      32 |       443.04 |      5 / 16 ms |           21 / 40 ms |                12 ms (10 .. 20) |
| Facets         |       1 |         7.84 |     30 / 32 ms |          82 / 107 ms |                52 ms (51 .. 53) |
| Facets         |       8 |        44.79 |     35 / 52 ms |         104 / 132 ms |                70 ms (63 .. 72) |
| Facets         |      32 |        49.52 |   113 / 278 ms |         290 / 451 ms |               71 ms (55 .. 265) |
| Broad filter   |       1 |         7.30 |     27 / 29 ms |          91 / 123 ms |                64 ms (63 .. 65) |
| Broad filter   |       8 |        41.81 |     31 / 43 ms |         117 / 152 ms |                87 ms (76 .. 90) |
| Broad filter   |      32 |        46.62 |   103 / 253 ms |         329 / 533 ms |              161 ms (86 .. 294) |
| Program filter |       1 |        10.73 |     17 / 18 ms |           62 / 68 ms |                45 ms (44 .. 45) |
| Program filter |       8 |        60.38 |     18 / 31 ms |          78 / 103 ms |                57 ms (54 .. 60) |
| Program filter |      32 |        72.15 |    54 / 144 ms |         227 / 349 ms |             133 ms (109 .. 206) |

The observed direction persisted through 32-client paired application load in the certified local setup.

## Resource telemetry integrity

C2 captures host/container/JVM resource observations while keeping instantaneous gauges distinct from cumulative counters. Counter-reset detection reported **no reset detected** for the certified evidence.

Resource evidence is contextual, not a universal resource-efficiency ranking. Topology, JVM settings, container limits, shard/replica layout and host behavior remain part of the interpretation boundary.

## OpenSearch query-shape experiments

C2 also tested OpenSearch query/aggregation treatments only after semantic equivalence was verified.

Two candidate optimizations materially improved OpenSearch native latency while preserving total-hit/facet semantics:

- unfiltered direct-terms aggregation: p50 **80 → 50 ms** (~37.5% reduction), p95 **88 → 61 ms** (~30.7% reduction);
- selective shared-scope aggregation: p50 **59 → 39 ms** (~33.9% reduction), p95 **75 → 41 ms** (~45.3% reduction).

These improvements are important evidence against treating the initial OpenSearch query shape as inherently optimal. They also motivate the preregistered C2.1 adversarial validation.

## Certified interpretation

The strongest defensible statement is:

> For the certified C2 corpus, documented mappings, tested workload matrix, controlled engine-order strategy, concurrency levels and local container topology, Solr demonstrated lower measured search latency than OpenSearch, with direction and magnitude evaluated using paired observations and separately warmed batch-level confidence evidence.

The report must **not** be summarized as proof that Solr is universally faster or more resource-efficient than OpenSearch.

The current guardrail remains:

> This report may support scoped statements about the documented corpus, mappings, workload/client cells, engine versions and local/container topology. It must not be summarized as proof that Solr or OpenSearch is universally faster or more resource-efficient, and the per-cell confidence intervals are not a multiplicity-adjusted family-wide significance test.

The API/Evidence contract retains the scope `LOCAL_CERTIFIED_TOPOLOGY_ONLY` and does not enable an unqualified comparative winner claim.

## Restart-safe projection identity

An ordinary `repository-api` restart does not replace a valid persisted large projection with the curated demo.

Startup:

1. reads persisted successful corpus activation;
2. verifies each enabled search target is reachable;
3. verifies live target document counts match persisted projection count;
4. rehydrates profile, projection ID, object count and target state;
5. leaves indexes untouched when persisted state is valid.

The restart proof retained:

- active profile `FEDERATED_1M`;
- retained federated count **1,000,000**;
- Solr count **1,000,181**;
- OpenSearch count **1,000,181**;
- projection ID `3d461a9feb49f7239f3f6aaacb0c90f1ff43d0c683238acc2202c841154db44d`;
- target parity `true`.

If target counts disagree with persisted activation evidence, startup fails fast and leaves indexes untouched for explicit operator recovery.

## Exact activation invariant

`FEDERATED_1M` is not defined as merely “any one million retained rows.” The API requires the exact C2 recipe of 500,000 Data.gov plus 500,000 DOE OSTI records. A 600,000 / 400,000 split is not equivalent.

## Repeatable live certification

With the million-record stack already present:

```bash
pnpm quality:scale
```

`pnpm scale:evidence:check` is the explicit equivalent. It is read-only with respect to retained corpus data, activation state and search indexes.

For `FEDERATED_1M`, certification requires simultaneous agreement on:

- research preflight readiness;
- exact 500K/500K source recipe;
- retained million-record total;
- composition/projection linkage;
- persisted activation profile, projection ID and object count;
- Solr/OpenSearch target parity;
- storage evidence identity;
- public-search source/provenance counts.

The standard `quality:all` command intentionally does not create or validate a million-record live corpus. Heavy evidence remains explicit research/operator work.

## Architecture proven at scale

```text
DSpace curated authority
181 curated research objects
        +
Application PostgreSQL
1,000,000 retained federated metadata records
500K Data.gov + 500K DOE OSTI
        ↓ deterministic normalization/projection
Solr                         OpenSearch
1,000,181 docs               1,000,181 docs
        \                     /
         same projection identity
```

The C2 milestone validates the ownership model rather than replacing it: DSpace remains curated authority, publishers remain federated source authority, application PostgreSQL retains reproducible metadata/evidence, and search engines remain derived state.

## Productized evidence

PR #45 exposed the certified C2 artifacts through the Spring repository API and Angular Evidence page rather than reading raw JSON from the browser.

The Evidence UI distinguishes:

- live projection/parity state;
- certified C2 corpus identity;
- order robustness;
- separately warmed batch inference;
- paired workload latency;
- concurrency 1/8/32;
- resource/telemetry integrity;
- experimental controls;
- scientific claim boundary.

This preserves the architecture rule that Angular consumes a stable typed application contract rather than artifact files or engine-specific APIs.

## What comes after C2

Certified C2 is a **closed control baseline**. New work must answer a new question and retain a separate identity.

Planned follow-up:

1. **#47 C2.1 adversarial validation** — preregistered attempt to falsify the Solr-favoring observation through tighter resource/version controls, OpenSearch-friendly optimizations, a broader query matrix, true selectivity bands and multiple clean restart blocks.
2. **#48 PI-2 Kubernetes** — use the frozen corpus/query contracts while making topology the experimental variable.
3. **#49 manual accessibility evidence** — close human keyboard/screen-reader verification gaps.
4. **#51 frontend mission alignment** — finish the public/portfolio presentation as a government-grade Angular data-discovery frontend supported by the full-stack evidence underneath it.

Additional federation, Maps or search-feature breadth remains optional and must not rewrite the certified C2 Gold Master or historical evidence.
