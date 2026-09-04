# Post-C2 Execution Plan

The certified C2 standalone milestone is the stable control baseline. Post-C2 work is intentionally limited to the remaining questions needed to finish the research and present the application clearly.

## Stable control baseline

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

Delivered evidence includes deterministic corpus/projection identity, dual-engine parity, complete deep traversal, semantic comparison, raw paired timing samples, bootstrap confidence evidence, independent/randomized batches, full-text/facet/broad-filter/program-filter workloads, concurrency 1/8/32, CPU/memory/JVM/GC/container telemetry, automated statistical synthesis and an accessible product Evidence view.

The control claim remains scoped to the documented corpus, mappings, workloads, versions and local/container topology. It is not a universal search-engine ranking.

## Slice A — Close and freeze the certified standalone baseline

Tracking issue: #46.

### Exit

- planning/history surfaces agree with the delivered C2 state;
- completed C2 work is removed from active TODOs;
- only evidence-supported acceptance criteria remain checked;
- the C2.1 protocol is merged before any C2.1 timing data are collected;
- no corpus harvest, reindex or performance rerun is required for closeout.

## Slice B — C2.1 adversarial standalone fairness validation

Tracking issue: #47.

Protocol: `planning/C2_ADVERSARIAL_VALIDATION_PROTOCOL.md`.

### Purpose

Try to falsify the observed C2 Solr latency advantage by removing remaining configuration/workload confounds and deliberately admitting semantically valid OpenSearch optimizations.

### Work packages

1. pin immutable engine versions/digests;
2. explicitly equalize JVM/container resource controls where equivalent;
3. freeze mapping/analyzer/shard/replica metadata;
4. promote semantically validated OpenSearch aggregation-shape optimizations into named treatments;
5. implement deterministic broad/moderate/selective filter selection;
6. implement the preregistered Q01-Q20 full-text matrix;
7. add restart-block identity and balanced seeded order across independent batches;
8. add p90 to the C2.1 descriptive percentile contract while preserving C2 unchanged;
9. extend automated statistical synthesis for query-family and restart-block summaries;
10. expose C2 versus C2.1 as separate evidence packages in the product.

### Exit

- the exact preregistered protocol commit is embedded in every artifact;
- semantic gates pass before timing cells are admitted;
- all preregistered cells are reported, including OpenSearch-favoring or inconclusive cells;
- independently warmed/restarted batch evidence is complete;
- the result remains scoped to the tested standalone topology.

## Deferred topology research — issue #48 closed not planned

The local Kubernetes/SolrCloud/OpenSearch-cluster laboratory is not part of the completion path.

A clustered local topology could change absolute latency and may change relative results because it introduces networking, scheduling, cgroup, shard/replica and multi-JVM effects. On one physical workstation, however, those effects create a new topology experiment rather than a cleaner fairness test of the standalone C2 observation.

C2.1 therefore keeps Docker Compose standalone as the controlled topology and tightens the variables that matter to the current research question: engine versions, resources, query treatments, workload mix, selectivity, order, independent batches and clean restart blocks.

The Kubernetes idea may be reopened later only if clustered deployment, resilience or cloud migration becomes a concrete product requirement.

## Slice C — Manual accessibility evidence

Tracking issue: #49.

This human-verification stream can proceed independently of C2.1 implementation.

### Work packages

1. keyboard-only application pass;
2. Search Lab keyboard-only pass;
3. Evidence/C2 dense-table focus/read-order pass;
4. Maps/MapLibre keyboard and map-to-list equivalence pass;
5. NVDA + Firefox;
6. NVDA + Chrome/Chromium;
7. JAWS or explicit N/A/licensing record;
8. cognitive/workflow review;
9. WCAG 2.2 focus-not-obscured, dragging-alternative and target-size manual checks;
10. federal ICT Testing Baseline / Trusted Tester crosswalk;
11. defect/remediation/rerun loop for any failure.

### Exit

- primary demo routes have dated, commit-bound keyboard evidence;
- NVDA evidence exists for Firefox and a Chromium-family browser;
- JAWS is recorded or explicitly unavailable;
- Search Lab, Evidence and Maps have manual evidence separate from automated axe/browser evidence;
- no conformance claim exceeds the recorded evidence.

## Slice D — Final frontend mission alignment and portfolio polish

Tracking issue: #51.

This is the final product-facing slice after C2.1 and the manual evidence stream are stable.

### Purpose

Present the mature repository first as a **government-grade Angular Open Science/data-discovery frontend**, while keeping the full-stack/search research as supporting technical depth.

### Work packages

1. reorder the README so the user problem, Angular architecture and accessibility/data-discovery experience appear before deep corpus/search research;
2. add `documentation/frontend-engineering-case-study.md` covering Angular boundaries, NgRx actions/effects/reducers/selectors, RxJS/Observable async state and generated OpenAPI clients;
3. document URL-driven search/facet state, loading/empty/error/partial-service behavior and provenance/authority presentation;
4. document Maps visual/nonvisual equivalence and accessible focus/status/table patterns;
5. document Storybook/component/Playwright/axe/manual evidence strategy and performance-aware rendering choices;
6. make the browser ownership boundary explicit: Angular owns interaction/presentation/accessibility; Spring owns application use cases; DSpace/PostgreSQL/search engines remain behind typed APIs;
7. add a concise 5-8 minute frontend-first demo path;
8. audit `/discovery`, representative research detail, `/maps`, `/evidence` and `/search-lab` for final hierarchy, dense-table usability, status copy, responsive/reflow and keyboard/focus quality;
9. make only narrowly justified UI changes discovered by that audit and retain regression evidence;
10. preserve the explicit independence/non-affiliation disclaimer.

## Dependency order

```text
#46 Close/freeze C2
  |
  +--> #47 C2.1 adversarial standalone validation
  |
  +--> #49 Manual accessibility evidence  (may proceed in parallel)
  |
  +-------------------------------+
                                  v
                     #51 Final frontend alignment
```

## What is deliberately not a prerequisite

The following remain optional future research/product work:

- local Kubernetes or clustered topology experiments;
- 10M or 100M corpora merely for larger numbers;
- broad NASA/PubMed/OpenAlex expansion beyond bounded adapter evidence;
- many additional thematic map layers;
- vector/hybrid search;
- AWS/IaC deployment.

These should be introduced only when they answer a new research, product or deployment question.

## Completion model

```text
Certified standalone C2 baseline       COMPLETE / control
C2.1 adversarial fairness validation   FINAL search-research experiment
Manual accessibility evidence          HUMAN verification stream
Final frontend mission alignment       FINAL product/portfolio slice
Kubernetes / AWS topology research     DEFERRED / reopen only if needed
```
