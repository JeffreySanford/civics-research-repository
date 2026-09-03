# Post-C2 Execution Plan

The certified C2 standalone milestone is complete enough to become the stable control baseline for future work. Post-C2 work is intentionally split into independent slices so a documentation closeout, a new standalone fairness experiment, clustered topology research and manual accessibility evidence do not become one unreviewable change.

## Stable control baseline

The following facts are frozen as the current standalone control unless an explicitly named later experiment says otherwise:

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

### Purpose

Make the planning/history surface agree with what the repository now proves and establish the immutable baseline used by later experiments.

### Work

- realign platform evolution, scale evidence, PI plan, roadmap, active backlog and acceptance criteria;
- remove completed C2 work from active TODOs;
- retain only evidence-supported checkmarks;
- regenerate generated platform-status facts through repository tooling rather than hand editing;
- preregister C2.1 before any new C2.1 timing data are collected;
- make C2.1 and PI-2 explicitly new experiments rather than unfinished C2 work.

### Exit

- documentation/planning drift checks pass;
- C2 baseline is named complete;
- C2.1 protocol is merged and frozen;
- no corpus harvest, reindex or performance rerun is required.

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

- exact preregistered protocol commit is embedded in every artifact;
- semantic gates pass before timing cells are admitted;
- all preregistered cells are reported, including OpenSearch-favoring or inconclusive cells;
- independently warmed/restarted batch evidence is complete;
- result remains scoped to the tested standalone topology.

## Slice C — PI-2 local Kubernetes search laboratory

Tracking issue: #48.

### Purpose

Change the independent variable from search engine to deployment topology while preserving the frozen corpus/query semantics.

```text
Docker Compose standalone
        versus
local Kubernetes clustered
```

### Work packages

1. repository-owned kind create/delete/readiness commands;
2. persistent-storage and namespace foundation;
3. SolrCloud through the official Solr Operator and ZooKeeper;
4. multi-node OpenSearch through a supported operator/Helm path;
5. explicit topology/image/shard/replica/heap/resource manifests;
6. deterministic projection into clustered Solr/OpenSearch with identity/count parity;
7. Search Lab runtime targeting without changing application request semantics;
8. standalone-versus-clustered 10K/100K/1M evidence where host stability permits;
9. 1/8/32 concurrency comparison with topology/resource evidence;
10. deliberate node-loss/recovery experiment for each engine;
11. product Evidence/reporting that treats topology as first-class experiment metadata.

### Exit

- kind lifecycle is reproducible from repo commands;
- both clustered engines receive the same deterministic projection;
- semantic parity precedes performance interpretation;
- node-loss/recovery is reproducible for both engines;
- Docker Compose remains the fast default demo/control path;
- no local-kind result is described as proof of cloud performance.

## Slice D — Manual accessibility evidence

Tracking issue: #49.

This slice can run in parallel with B and C because it is a human interaction evidence stream rather than a search-topology dependency.

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
- NVDA evidence exists for Firefox and Chromium-family browser;
- JAWS is recorded or explicitly unavailable;
- Search Lab, Evidence and Maps have manual evidence separate from automated axe/browser evidence;
- no conformance claim exceeds the recorded evidence.

## Dependency order

```text
#46 Close/freeze C2
  |
  +--> #47 C2.1 adversarial standalone validation
  |        |
  |        +--> results may inform later configuration hypotheses
  |
  +--> #48 PI-2 Kubernetes topology laboratory
  |
  +--> #49 Manual accessibility evidence  (may proceed in parallel)
```

PI-2 does not require C2.1 to produce a Solr-favoring result. It requires only a frozen corpus/query contract and explicit configuration semantics. If C2.1 changes the preferred standalone implementation treatment, PI-2 records both the certified C2 control and the later treatment rather than rewriting history.

## What is deliberately not a prerequisite

The following are useful future research/product extensions but do not block closing the certified standalone milestone:

- 10M or 100M corpora merely for larger numbers;
- broad NASA/PubMed/OpenAlex expansion beyond bounded adapter evidence;
- many additional thematic map layers;
- vector/hybrid search;
- AWS/IaC deployment;
- replacing Docker Compose with Kubernetes for ordinary development.

Those should be introduced only when they answer a new research, product or deployment question.

## Completion model

The project should use explicit named milestones rather than one permanently unfinished backlog:

```text
Certified standalone C2 baseline       COMPLETE / control
C2.1 adversarial fairness validation   NEW experiment
PI-2 Kubernetes topology laboratory    NEW experiment
Manual accessibility evidence          HUMAN verification stream
PI-3 AWS/IaC                           FUTURE deployment phase
```

This preserves the value of the mature current application while leaving room for genuinely new questions.
