# Search Research Protocol

This repository is a research and demonstration environment, not a production capacity-certification system. Search performance work therefore favors reproducibility, semantic parity, transparent caveats, and scale-to-scale comparability over production SLO thresholds.

## Test layers

### 1. Fast research-contract tests

`pnpm performance:test` is part of the normal quality suite. It verifies the research harness without requiring live Solr, OpenSearch, DSpace, or a federated corpus.

It covers:

- deterministic percentile calculations,
- bounded warmup/sample controls,
- projection identity checks,
- invalid-evidence refusal,
- adaptive selective-filter discovery,
- Solr/OpenSearch facet-count parity requirements,
- paired execution-order methodology,
- OpenSearch aggregation-shape semantic equivalence,
- research-report rendering,
- 100K and 1M profile protocol support,
- 1M scale-preflight estimation and readiness classification,
- guarded 1M scale-run progress identity and terminal-state handling.

These checks belong in normal CI because they are fast and deterministic.

### 2. Live scale research runs

Live performance evidence is environment-dependent and should not be silently mixed into ordinary CI. A live run requires:

1. the requested corpus profile is active,
2. retained federated metadata meets the profile target,
3. the current projection has a deterministic projection ID,
4. Solr and OpenSearch report the same projection/count,
5. scale evidence reports `valid: true`,
6. semantic parity is preserved for every measured experiment.

The live research runner writes both JSON and Markdown evidence and prints the Markdown report at the end of the run.

## 100K baseline

Profile: `FEDERATED_100K`

Established corpus:

- 100,000 retained Data.gov records,
- curated DSpace objects remain separate authority,
- 100,181 projected search documents in the proven baseline,
- deterministic projection identity required before every benchmark.

Research scenarios:

1. full-text relevance (`North Dakota workforce`),
2. unqualified faceted search,
3. adaptive selective program filter chosen from live facet parity.

Each scenario is measured twice:

- `SOLR_FIRST`,
- `OPENSEARCH_FIRST`.

Warmups are excluded. Application elapsed and native Solr `QTime` / OpenSearch `took` are retained separately.

## OpenSearch query-shape experiments

Candidate query shapes are research experiments, not automatic production-style optimizations.

A candidate is eligible for timing only after:

- total hits equal the current query shape,
- every returned facet bucket/count equals the current query shape.

Current experiments:

- remove redundant `filter: match_all` wrappers around unfiltered terms aggregations,
- replace duplicated selective program-filter aggregation scopes with one shared filtered scope.

A faster candidate is rejected if semantic parity changes.

## 1M readiness preflight

Run `pnpm research:preflight:1m` before starting or resuming growth toward one million retained records.

The preflight is read-only. It inspects:

- the proven 100K scale-evidence baseline,
- current 1M scale evidence,
- durable Data.gov harvest/checkpoint state,
- measured 10K and 100K storage footprints,
- local filesystem free space.

For PostgreSQL, Solr, and OpenSearch, the 1M storage estimate uses the measured 10K-to-100K per-record slope when both measurements are available. DSpace is held at the measured upper-baseline footprint because federated records remain metadata references instead of mirrored binaries.

The conservative peak estimate adds the currently active Solr/OpenSearch derived-index footprint to the estimated 1M steady state, then reports a separate 25% research headroom margin. The assumptions and per-component estimate method are written into the preflight report; this is not a production capacity guarantee.

Preflight states:

- `BLOCKED`: a prerequisite such as baseline evidence, durable checkpointing, storage baseline, or measured disk headroom is inadequate,
- `READY_TO_GROW`: infrastructure prerequisites are adequate but the real 1M corpus/evidence does not yet exist,
- `READY_TO_MEASURE`: the requested 1M corpus is active, target-complete, and parity-valid.

`research:full:1m` uses the stricter `--require-ready-to-measure` gate and stops before the expensive quality/report sequence unless the preflight reaches `READY_TO_MEASURE`.

## Observable 1M scale transition

Run `pnpm research:scale:1m` only after the repository API has been rebuilt with guarded `FEDERATED_1M` support and the preflight reports `READY_TO_GROW`.

The operator runner:

1. runs the read-only 1M preflight,
2. refuses to mutate when the preflight is `BLOCKED`,
3. no-ops when the profile is already `READY_TO_MEASURE`,
4. starts one guarded `FEDERATED_1M` scale operation,
5. polls `/admin/reindex/progress`,
6. refuses to mix progress from a different `operationId`,
7. records changed progress observations in a local JSON journal,
8. waits for `COMPLETED` or `FAILED`,
9. reruns the 1M preflight after completion,
10. succeeds only when the post-run state is `READY_TO_MEASURE`.

The scale journal is written under `browser-evidence-artifacts/research-performance/` and remains disposable run output unless explicitly curated later. The runner does not replace the backend's durable checkpoint, snapshot, projection-parity, rollback, or storage-evidence controls; it only makes the long transition observable and preserves operator-side evidence.

## 1M plan

Profile: `FEDERATED_1M`

The 1M run must use the same report runner and methodology as 100K. Do not create a separate 1M benchmark implementation.

Before measuring 1M:

1. run and retain the 1M readiness preflight,
2. retain at least 1,000,000 federated records using the durable harvest/resume path,
3. snapshot the retained corpus,
4. project the requested profile to Solr and OpenSearch,
5. verify deterministic projection identity and target count parity,
6. capture scale/storage evidence,
7. record activation duration and any warnings,
8. rerun the preflight and require `READY_TO_MEASURE`,
9. run the same paired search scenarios and sample policy used for 100K,
10. retain host/container resource context,
11. produce the same JSON + Markdown report schema.

The 1M report should compare scale behavior, not simply absolute engine winners. Useful questions include:

- how p50/p95/p99 change from 100K to 1M,
- whether the Solr/OpenSearch gap widens, narrows, or stays proportional,
- whether aggregation-shape improvements retain their effect,
- how index/storage footprints scale,
- whether projection duration or memory/disk pressure becomes the limiting factor,
- whether semantic parity remains stable at scale.

If 1M evidence is unavailable or invalid, the correct research outcome is `NOT RUN` with the missing prerequisite recorded. Do not substitute a smaller corpus while labeling it 1M.

## Report contents

Every full research report should contain:

- capture timestamp,
- profile,
- retained-record count,
- projected-object count,
- projection ID,
- target parity and storage-evidence state,
- host context,
- warmup/sample counts,
- adaptive selective-filter identity/selectivity,
- both engine execution orders,
- API elapsed p50/p95/p99,
- native engine p50/p95/p99,
- order-robustness observations,
- OpenSearch aggregation-shape results when executed,
- interpretation guardrails,
- 1M readiness/execution notes.

The report is evidence for this repository configuration. It must not claim that either search engine is universally faster.
