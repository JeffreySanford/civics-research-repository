# Search Research Protocol

This repository is a research and demonstration environment, not a production capacity-certification system. Search work favors reproducibility, semantic parity, transparent caveats, source composition and scale-to-scale comparability over production SLO thresholds.

## Test layers

### 1. Fast research-contract tests

`pnpm performance:test` is part of the normal quality suite. It verifies research methodology without requiring live Solr, OpenSearch, DSpace or external publishers.

It covers:

- deterministic percentile calculations,
- bounded warmup/sample controls,
- projection identity checks,
- invalid-evidence refusal,
- raw paired samples and bootstrap confidence evidence,
- independent benchmark batches with fixed, alternating and seeded randomized execution order,
- explicit workload matrix classes for full text, facets, broad filters and selective filters,
- adaptive selective-filter discovery,
- Solr/OpenSearch facet-count parity requirements,
- paired execution-order methodology,
- OpenSearch aggregation-shape semantic equivalence,
- research-report rendering,
- current 100K/1M report protocol support,
- scale-preflight estimation/readiness logic,
- guarded scale-run progress identity/terminal-state handling,
- all-source federation sampling orchestration.

These checks belong in normal CI because they are fast and deterministic.

Java repository tests additionally cover each source adapter with local HTTP fixtures. Live publisher APIs are never a unit-test dependency.

### 2. Live source-sampling runs

Use:

```bash
pnpm federation:sample:all
```

before deep multi-source scale work.

The sampler:

- observes existing sources without advancing them,
- harvests one bounded page from empty authorities,
- attempts all five modeled sources even if one fails,
- produces JSON + Markdown evidence,
- does not activate a mixed-source projection.

This validates source semantics and credentials without disturbing the proven 100K search baseline.

### 3. Live scale research runs

Live performance evidence is environment-dependent and should not be silently mixed into ordinary CI.

An evidence-grade run requires:

1. a versioned corpus recipe/composition,
2. reproducible evidence for every contributing source,
3. exact retained counts/quotas,
4. a deterministic composition/projection identity,
5. Solr and OpenSearch on the same normalized projection/count,
6. storage/resource evidence,
7. semantic parity for every comparison where equivalent semantics are claimed.

The live research runner writes JSON + Markdown and prints the Markdown report at the end.

## 100K baseline

Profile: `FEDERATED_100K`

Established corpus:

- 100,000 retained Data.gov records,
- 181 curated DSpace objects,
- 100,181 projected search documents,
- deterministic projection ID `125fc791065fd8c68806f62a52c2203c2ce74a083954ce469f3e0cd627015024`.

Research scenarios:

1. full-text relevance (`North Dakota workforce`),
2. unqualified faceted search,
3. broad `DATASET` type filtering,
4. adaptive selective program filter chosen from live facet parity.

Each scenario is measured twice:

- `SOLR_FIRST`,
- `OPENSEARCH_FIRST`.

Warmups are excluded. Application elapsed and native Solr `QTime` / OpenSearch `took` are retained separately.

The standalone benchmark harness also supports independent batches with an explicit
execution-order strategy:

- `FIXED` preserves the requested order for every batch,
- `ALTERNATE` switches between `SOLR_FIRST` and `OPENSEARCH_FIRST`,
- `RANDOMIZED` shuffles a balanced order plan with a retained integer seed.

The retained artifact includes the batch order plan, sample indexes and raw paired timing
series so later reports can evaluate confidence and order sensitivity without rerunning
the experiment.

The workload matrix deliberately separates user-visible API scenario from research
workload class. Both broad and selective filters use the `FILTERING` API scenario, but
their selectivity and interpretation are different and must be reported separately.

This remains the stable single-source baseline even after additional authorities are sampled.

## OpenSearch query-shape experiments

Candidate query shapes are research treatments, not automatic production optimizations.

A candidate is eligible for timing only after:

- total hits equal the current query shape,
- every returned facet bucket/count equals the current query shape.

Current experiments:

- remove redundant `filter: match_all` wrappers around unfiltered terms aggregations,
- replace duplicated selective program-filter aggregation scopes with one shared filtered scope.

A faster candidate is rejected if semantics change.

## Multi-source progression

The active scale roadmap is documented in [Federation Scale Research Plan](FEDERATION_SCALE_RESEARCH_PLAN.md).

Planned progression:

```text
100K Data.gov baseline                       PROVEN
optional 500K Data.gov single-source point
1M balanced multi-source
10M heterogeneous multi-source
100M bulk-ingest / cluster research
```

The runtime enum/OpenAPI should gain new named profiles only when their corpus recipes/evidence paths are executable. Planning a tier does not make it a valid runtime profile.

## 1M readiness status

The existing `research:preflight:1m` work established useful storage/headroom estimation from measured 10K/100K component slopes. That remains valuable.

However, Data.gov's live catalog is below one million records. Therefore the repository must not start a Data.gov-only `FEDERATED_1M` growth operation.

The single-source scale service intentionally refuses that transition until a **composite multi-source snapshot/evidence model** exists.

A preferred initial 1M recipe is:

```text
500K Data.gov
500K DOE OSTI
+ curated DSpace objects
```

The 1M preflight will need to evolve from a single-source retained-count check into a composition-aware gate that verifies:

- each source quota,
- source-specific snapshot/run evidence,
- aggregate composition digest,
- projected count/identity parity,
- storage headroom.

Until that work lands, a `READY_TO_GROW` disk result means infrastructure headroom is adequate; it does **not** authorize a Data.gov-only million-record harvest.

## Scale-runner protocol

The operator scale-runner machinery remains unit-tested because its invariants are still correct for future composite transitions:

- preflight before mutation,
- one operation identity,
- progress polling without mixing operation IDs,
- terminal `COMPLETED` / `FAILED`,
- post-run evidence gate,
- local progress journal.

The package-level 1M scale command is intentionally not exposed while the 1M backend recipe is blocked. Re-enable an operator command only when composite growth/snapshot evidence exists.

## 10M and 100M methodology

Large tiers must use the **same search-research semantics** while allowing corpus composition and topology to become explicit variables.

For every tier record:

- exact source quotas,
- API versus bulk transport per source,
- publisher snapshot/release identity,
- normalization adapter versions,
- composition digest,
- projected object count/ID,
- host/topology/resource context.

At 10M/100M add source-aware scenarios:

- source-system filter,
- content-type filter,
- DOI/PMID/source-ID lookup,
- author query,
- publisher/institution filter,
- subject/topic facet,
- high-cardinality topic/program facet,
- source-specific selective filter,
- cross-source broad query.

At concurrency above one, add throughput, CPU, memory, GC and saturation evidence.

## API versus bulk transport

Live APIs are appropriate for samples and modest bounded slices. They are not automatically the correct transport for large experiments.

Examples:

- OpenAlex 10M/100M -> pinned public S3 snapshot rather than cursor-crawling the API,
- PubMed large tiers -> baseline/update files rather than ordinary ESearch paging,
- NASA high scale -> explicitly defined CMR granule stream/partition, not collection metadata silently reinterpreted,
- OSTI -> public full-corpus API/OAI strategy as appropriate,
- Data.gov -> bounded by its actual source size.

Transport changes how source evidence is recorded, not the normalized research-object semantics.

## Report contents

Every evidence-grade report should contain:

- capture timestamp,
- profile/recipe version,
- per-source composition and retained counts,
- source snapshot/release evidence IDs,
- projected-object count,
- composition/projection ID,
- target parity/storage evidence,
- host/topology context,
- warmup/sample counts,
- query/filter identity and selectivity,
- both engine execution orders,
- API elapsed p50/p95/p99,
- native engine p50/p95/p99,
- order-robustness observations,
- semantic parity/difference observations,
- candidate query-shape results when executed,
- interpretation guardrails,
- ingest/projection duration for large tiers.

The report is evidence for the named repository configuration and corpus recipe. It must not claim that either search engine is universally faster.

## Interpretation guardrails

- Performance and semantic quality are separate evidence dimensions.
- A faster query shape is rejected when result semantics drift.
- Solr `QTime` and OpenSearch `took` are native diagnostics with different vendor definitions.
- A reported `0 ms` Solr QTime means below its millisecond reporting resolution, not literally zero work.
- Source composition is part of the experiment.
- A smaller corpus must never be relabeled as a larger tier.
- Synthetic duplication is not an acceptable way to hit 1M/10M/100M when real authoritative metadata sources are available.
