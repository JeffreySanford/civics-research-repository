# C2.1 Adversarial Solr/OpenSearch Fairness Validation Protocol

Status: **PREREGISTERED AND MERGED — NO C2.1 PERFORMANCE RESULTS COLLECTED YET**

Related work: issue #47. The certified C2 baseline remains historical evidence and is not overwritten by C2.1.

Pre-measurement housekeeping amendment: local Kubernetes work in #48 was closed as not planned for the current completion path. This wording update changes no corpus identity, query, filter band, selection algorithm, restart count, batch count, measured-run count, order strategy, timing boundary or interpretation rule.

## Research question

The certified C2 standalone experiment observed lower measured Solr latency than OpenSearch for the repository's tested lexical workloads on the exact one-million-record federated corpus. C2.1 is designed to challenge that observation rather than reinforce it.

The research question is:

> After explicitly equalizing standalone engine resources, pinning exact engine versions, admitting semantically equivalent OpenSearch optimizations, broadening the query/filter workload, balancing engine order, and repeating measurements across clean engine restarts, does the direction and magnitude of the certified C2 Solr/OpenSearch latency difference persist?

A valid C2.1 outcome may favor Solr, favor OpenSearch for some or all workloads, show materially smaller differences, or show configuration/workload-dependent results. The experiment succeeds when it is reproducible and capable of contradicting the prior result.

## Frozen corpus

C2.1 reuses the certified C2 corpus. It must not substitute a newly harvested or cherry-picked corpus.

```text
profile                 FEDERATED_1M
Data.gov retained       500,000
DOE OSTI retained       500,000
federated total         1,000,000
curated DSpace objects  181
projected objects       1,000,181
composition SHA-256     e2c7cceb641589715a6390cb35846a67d7361fb15ec00fe3445a3e0036a5524b
projection ID           3d461a9feb49f7239f3f6aaacb0c90f1ff43d0c683238acc2202c841154db44d
Gold Master ID          federated-1m-1788269110268-985ce2bd
Gold Master SHA-256     8ba2cc755f255f108dbcb6eb1621e841925c02e0686487b97d498b780d7deb70
```

If the restored/projected identity differs, the run is not C2.1 evidence.

## Engine configuration gate

Before the first timed C2.1 request, the implementation must commit and record an execution manifest containing:

- exact Solr image version and immutable digest;
- exact OpenSearch image version and immutable digest;
- Java/JVM version for each engine;
- identical explicit JVM heap target for both engines;
- identical explicit container CPU ceiling for both engines;
- identical explicit container memory ceiling for both engines;
- shard/core count;
- replica count;
- index refresh/commit state;
- analyzer/schema/mapping identity;
- host CPU architecture/logical CPU count;
- host memory;
- Docker/runtime version.

C2.1 must not rely on floating engine tags such as `solr:9` for accepted evidence. The implementation PR may choose the exact resource values after confirming both engines support them safely on the workstation, but once the values are merged they are frozen for the C2.1 run.

The initial target is a symmetric single-node control topology:

```text
search nodes       1 per engine
shards/cores       1
replicas           0
JVM heap           equal explicit value
container CPUs     equal explicit ceiling
container memory   equal explicit ceiling
```

Any unavoidable engine-specific difference must be named in the manifest rather than hidden behind the word "equal".

## Semantic-equivalence gate

Performance is interpreted only after correctness.

For every candidate query/filter/aggregation treatment admitted to C2.1:

1. both engines must report the certified projection identity and expected object count;
2. total hits must agree where equivalent semantics are claimed;
3. required facet bucket/value counts must agree;
4. result/top-N/rank differences must be retained when ranking semantics are not exactly identical;
5. a faster treatment is rejected if it changes semantics beyond the preregistered comparison boundary.

The already discovered OpenSearch aggregation-shape optimizations are deliberately eligible treatments because C2.1 is adversarial to the prior Solr result:

- remove redundant unfiltered `filter: match_all` wrappers where direct terms aggregation is semantically equivalent;
- replace duplicated selective-filter aggregation scopes with one shared filtered scope where total hits and every required facet bucket/count remain equivalent.

C2.1 must report which OpenSearch treatment is used in every cell. It must not silently compare optimized OpenSearch in one cell and baseline OpenSearch in another.

## Full-text query matrix

The certified C2 baseline used `North Dakota workforce` as its stable full-text query. C2.1 broadens this to a frozen matrix so one query cannot determine the full-text conclusion.

The raw query strings are fixed before C2.1 timing:

| ID  | Class                     | Query                                       |
| --- | ------------------------- | ------------------------------------------- |
| Q01 | single/common             | `energy`                                    |
| Q02 | single/common             | `data`                                      |
| Q03 | single/domain             | `workforce`                                 |
| Q04 | single/domain             | `climate`                                   |
| Q05 | single/domain             | `water`                                     |
| Q06 | two-term                  | `North Dakota`                              |
| Q07 | two-term                  | `renewable energy`                          |
| Q08 | two-term                  | `labor force`                               |
| Q09 | two-term                  | `population estimates`                      |
| Q10 | two-term                  | `energy efficiency`                         |
| Q11 | three-plus                | `North Dakota workforce`                    |
| Q12 | three-plus                | `groundwater quality research`              |
| Q13 | three-plus                | `renewable energy technology`               |
| Q14 | three-plus                | `economic development data`                 |
| Q15 | three-plus                | `carbon emissions research`                 |
| Q16 | federal/source vocabulary | `Department of Energy`                      |
| Q17 | federal/source vocabulary | `Census Bureau geography`                   |
| Q18 | cross-domain              | `scientific research data`                  |
| Q19 | high-result candidate     | `United States`                             |
| Q20 | no-result control         | `zzzxqv_nonexistent_research_term_20260903` |

These labels describe intent, not guaranteed document frequency. Actual total-hit counts are recorded before timing and remain part of the evidence. A query is not removed merely because its observed frequency differs from the descriptive label.

If exact-phrase search is added as a distinct scenario, phrase queries must be preregistered in a protocol amendment merged before their timing data are collected; quoted strings must not be retroactively promoted into a new workload after results are visible.

## Filter selectivity matrix

C2.1 replaces the ambiguous single "selective" label with three deterministic selectivity bands:

```text
BROAD       target 25% to 75% of the corpus
MODERATE    target  5% to 25% of the corpus
SELECTIVE   target 0.5% to  5% of the corpus
```

Filter values are selected without reference to latency.

Candidate field/value counts are discovered from the certified corpus using only fields that both engines expose with exact count parity. For each band:

1. discard candidates outside the band;
2. compute distance from the fixed target midpoint: 50% broad, 15% moderate, 2% selective;
3. choose the candidate with the smallest absolute distance;
4. break ties lexicographically by normalized `field=value`;
5. persist the entire candidate list and selected value before timing.

If no parity-valid candidate exists for a band, record `NO_VALID_CANDIDATE`; do not widen the band after seeing engine timings.

## Workload families

Primary C2.1 families are:

1. full-text relevance — Q01 through Q20 at single-client concurrency;
2. corpus-wide facets/aggregations;
3. broad filter;
4. moderate filter;
5. selective filter.

The concurrency stress matrix remains a focused topology test rather than multiplying every query by every client level. It uses:

- one preregistered representative full-text query: Q11 `North Dakota workforce`;
- corpus-wide facets;
- broad filter;
- moderate filter;
- selective filter;
- client levels 1 / 8 / 32.

The representative full-text query is fixed from the prior baseline and is not chosen from C2.1 results.

## Independent blocks, batches and order

C2.1 introduces restart blocks so the entire result is not conditioned on one long-lived JVM/cache session.

Target design:

```text
restart blocks                 4
independent batches/block      4
total independent batches     16
warmups/cell/batch             5 discarded
measured runs/cell/batch       10
engine-order strategy          balanced seeded randomized
```

Before each restart block:

1. stop/recreate only the search-engine containers and comparison API components required by the frozen execution manifest;
2. preserve the certified corpus/Gold Master and derived projection inputs;
3. verify projection identity/count parity after startup;
4. perform no timing until both engines satisfy the readiness and semantic gates.

The randomization seed schedule is deterministic and recorded. The implementation must derive per-block/per-batch order from a committed root seed rather than manually selecting favorable sequences.

Root seed:

```text
20260903
```

The order plan must be balanced as closely as mathematically possible inside each restart block and exactly balanced across the complete 16-batch design.

## Timing boundaries

Retain the existing distinction:

- **API elapsed** — Spring-side elapsed time around the engine HTTP request/response boundary;
- **Solr native** — `responseHeader.QTime`;
- **OpenSearch native** — top-level `took`.

Native values are diagnostics with different vendor definitions. They are not renamed into one supposedly identical engine-execution metric.

The same engine response supplies both result content and engine-native timing. No second timing-only request is issued.

## Concurrency evidence

Concurrency 1 / 8 / 32 remains a paired application topology experiment, not an isolated engine maximum-QPS certification.

Each concurrency cell retains:

- measured paired comparisons;
- paired comparisons/second;
- per-engine API p50/p90/p95/p99 when enough samples exist;
- native p50/p90/p95/p99 when enough samples exist;
- request-level paired difference distribution;
- restart block and batch identity;
- batch-level median paired difference;
- bootstrap interval over independent batch summaries;
- errors/timeouts;
- CPU/memory/JVM/GC/container observations using the existing counter-versus-gauge rules.

Adding p90 in C2.1 is allowed because this protocol preregisters it before C2.1 evidence collection. Certified C2 remains unchanged and continues to report its original p50/p95/p99 contract.

## Statistical unit and inference

Adjacent HTTP requests are not treated as independent scientific replicates.

Primary repeated unit:

> one separately warmed batch within a recorded restart block, contributing one Solr summary and one OpenSearch summary for the preregistered cell.

For each primary cell report:

- median Solr API elapsed;
- median OpenSearch API elapsed;
- median paired difference `OpenSearch - Solr`;
- bootstrap 95% confidence interval over the 16 batch-level paired differences;
- Solr batch-win rate;
- OpenSearch batch-win rate;
- tie rate;
- restart-block distribution;
- p50/p90/p95/p99 descriptive request distributions.

Positive paired differences mean OpenSearch took longer. Negative paired differences mean Solr took longer.

Request-level intervals, if shown, remain descriptive and are clearly separated from the preferred batch-level inference.

C2.1 does not claim that every per-cell 95% interval forms a multiplicity-adjusted family-wide test. No cell is deleted or relabeled because its interval includes zero or favors OpenSearch.

## Query-family synthesis

The 20 full-text queries must not be reduced to a single cherry-picked winner.

The report must show all Q01-Q20 cells and additionally summarize:

- number of queries with positive/negative/tied median batch effects;
- median of the 20 query-level median effects;
- distribution of relative p50 and p95 differences across queries;
- total-hit count for each query;
- any ranking/semantic caveat for that query.

No "full-text winner" headline is allowed unless the report definition used to make that statement is committed before timing collection.

## Resource integrity

Continue the existing telemetry rules:

- cumulative counters may be expressed as after-minus-before deltas only when monotonic within the observation;
- decreasing counters are reset/restart signals and their deltas are omitted;
- CPU/load, heap occupancy and container memory are instantaneous observations and remain before/after or sampled gauges rather than being mislabeled cumulative consumption;
- every reset field is retained in evidence;
- resource data are tied to restart block, batch, topology and engine version.

## Evidence refusal conditions

A cell/run is rejected rather than partially published when any of the following occurs:

- corpus/projection identity mismatch;
- expected document-count mismatch;
- semantic parity failure for a cell requiring equivalent semantics;
- projection changes during measurement;
- engine/API HTTP failure outside the explicitly recorded error-rate experiment;
- invalid/missing timing required by that evidence layer;
- unrecorded engine version/resource configuration;
- unbalanced/unrecorded execution-order plan;
- evidence artifact cannot identify restart block and batch.

Rejected evidence is retained as diagnostic failure metadata when possible; it is not silently replaced by a rerun without recording the reason.

## Reporting and claim boundary

Certified C2 and C2.1 are separate named evidence packages.

C2.1 may support statements such as:

> Under the preregistered C2.1 corpus, query/filter matrix, semantically validated query treatments, equalized standalone resource controls, randomized engine order and repeated restart-block design, the measured latency difference favored X for Y of the tested cells.

C2.1 must not be summarized as proof that Solr or OpenSearch is universally faster, more scalable or more resource-efficient. Standalone local Docker results do not predict SolrCloud/OpenSearch-cluster or AWS behavior; clustered/distributed topology remains a separate future research question and is not part of the C2.1 completion path.

## Protocol amendments

After this file is merged, any change to corpus identity, primary query strings, selectivity bands, selection algorithm, restart-block count, batch count, measured-runs count, engine-order method, primary timing boundary or interpretation rule requires a committed protocol amendment **before** collecting affected C2.1 timing data.

Implementation-only corrections that do not change the experimental meaning may be merged with a written rationale, but the final report must identify the exact protocol commit used for collection.
