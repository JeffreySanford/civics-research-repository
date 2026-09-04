# C2.1 Protocol Amendment 01 — Rare-term workload

Status: **PRE-MEASUREMENT AMENDMENT**

Related work: issue #47 and merged PR #56.

## Purpose

Issue #47 requires the preregistered C2.1 full-text matrix to cover common and rare terms, short and long queries, exact phrases, cross-source vocabulary, no-result controls, and high-result-count queries.

PR #56 already amended Q06 to the exact-phrase workload `"North Dakota"` and added equivalent phrase-only handling for both OpenSearch comparison implementations before C2.1 timing collection.

This amendment closes the remaining rare-term coverage gap before C2.1 performance timing is intentionally collected.

## Frozen change

This amendment supersedes only the Q05 row of `planning/C2_ADVERSARIAL_VALIDATION_PROTOCOL.md`:

- ID: `Q05`
- Prior class: `single/domain`
- Prior query: `water`
- Amended class: `single/rare candidate`
- Amended query: `hydrogeology`

All other Q01-Q20 strings and classes remain unchanged, including Q06 exact phrase, Q11 `North Dakota workforce`, and Q20 no-result control.

## Selection and interpretation rule

`hydrogeology` is fixed as the rare-term candidate before any C2.1 latency result is used for query selection. Its observed total-hit count is recorded during semantic/preflight evidence and in the final report.

The cell is retained even if its realized frequency differs from the descriptive label. It must not be replaced, removed, or renamed after latency results are visible. This preserves the original protocol rule that class labels describe intent rather than guaranteed document frequency.

No engine timing, winner, or latency direction was used to select this amendment.

## Unchanged protocol controls

This amendment changes no corpus identity, projection identity, engine version, JVM/container resource setting, shard/replica setting, selectivity band, filter-selection algorithm, restart-block count, batches per block, measured runs per cell, execution-order strategy, timing boundary, statistical unit, bootstrap rule, telemetry rule, or claim boundary.

The final C2.1 evidence package must identify both the merged base protocol commit and this amendment commit used for collection.
