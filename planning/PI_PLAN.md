# Program Increment Plan

This plan retains the original program-increment identities while reflecting the repository's current state after the certified C2 standalone milestone.

```text
PI-1 Federated Metadata Expansion / Standalone Evidence
        |
        | established the deterministic control baseline
        v
PI-2 Local Kubernetes Search Laboratory
        |
        | makes topology the experimental variable
        v
PI-3 AWS Implementation Candidate

PI-4 Manual Accessibility Evidence
PI-5 Browser Evidence Governance
PI-6 Solr/OpenSearch Comparison Hardening
```

Docker Compose remains the default fast development/demo path and the standalone control topology throughout the program.

## Current position — September 3, 2026

The original PI-1 standalone research objective is **substantially complete**. The repository no longer sits at the 10K checkpoint and no active work is occurring on the old `codex/data-gov-10k-scale` branch.

The certified C2 control baseline is:

```text
DSpace curated authority                     181
Application PostgreSQL federated retention   1,000,000
  Data.gov                                    500,000
  DOE OSTI                                    500,000
                                              ---------
Solr normalized projection                    1,000,181
OpenSearch normalized projection              1,000,181
```

Identities:

- profile: `FEDERATED_1M`
- composition SHA-256: `e2c7cceb641589715a6390cb35846a67d7361fb15ec00fe3445a3e0036a5524b`
- projection ID: `3d461a9feb49f7239f3f6aaacb0c90f1ff43d0c683238acc2202c841154db44d`
- Gold Master archive ID: `federated-1m-1788269110268-985ce2bd`

The certified standalone baseline also includes:

- bounded/reproducible federated persistence and projection;
- restart-safe active corpus identity;
- exact source quota enforcement;
- Solr/OpenSearch count + projection parity;
- deep cursor/search-after traversal with no gaps or duplicates;
- stable semantic comparison matrices;
- raw paired timing samples;
- independent separately warmed batches;
- balanced seeded randomized engine order;
- workload classes for full text, facets, broad filters and program filters;
- concurrency 1 / 8 / 32;
- CPU, memory, JVM/GC and container telemetry;
- automated statistical synthesis;
- certified performance evidence exposed through the repository API and Angular Evidence UI.

The C2 result is deliberately scoped to the documented corpus, mappings, workloads, versions and local/container topology. It is not a universal ranking of Solr and OpenSearch.

## PI-1 — Federated Metadata Expansion / Standalone Evidence

### Delivered objective

PI-1 established a reproducible Open Science/federal-repository control topology in which:

- DSpace remains authoritative for curated repository objects;
- external publishers remain authoritative for federated source records and resources;
- application PostgreSQL retains reproducible federated metadata/evidence;
- Solr and OpenSearch remain rebuildable derived projections;
- Angular consumes a typed Spring/OpenAPI boundary rather than engine-specific APIs.

The normal UI supports mixed repository/federated discovery, provenance-aware research detail, facets, deep discovery, maps/evidence surfaces and accessible fallback/equivalent representations.

### PI-1 completion boundary

For purposes of the standalone control baseline, PI-1 is complete when the following remain reproducible:

- the exact C2 corpus and Gold Master;
- deterministic projection identity;
- Solr/OpenSearch semantic/projection parity gates;
- versioned workload/query definitions;
- standalone search-performance/resource evidence;
- ordinary small/demo Compose startup.

Those conditions are now met.

### Optional PI-1 extensions

The following remain valuable but are **not prerequisites** for calling the standalone baseline successful:

- DOI/PMID/other cross-source durable-identifier reconciliation;
- additional bounded NASA CMR, PubMed and OpenAlex source work;
- additional Maps thematic/spatial layers;
- publisher freshness/staleness enrichment;
- broader phrase/highlight/geo/vector search scenarios.

These extensions should occur only when they answer a new semantic, spatial or product question.

## C2.1 — Adversarial standalone validation

C2.1 is an optional follow-up experiment, not unfinished C2 work.

Protocol: [C2 Adversarial Validation Protocol](C2_ADVERSARIAL_VALIDATION_PROTOCOL.md)

Issue #47 intentionally attempts to falsify the current Solr-favoring C2 observation by strengthening controls in ways that may help OpenSearch:

- exact pinned engine versions;
- explicit/equalized resource controls;
- semantically validated OpenSearch optimizations;
- a preregistered multi-query full-text matrix;
- broad/moderate/genuinely selective filter bands;
- p50/p90/p95/p99;
- more independent batches;
- balanced randomized order;
- multiple clean engine/container restart blocks.

Success means the protocol is capable of contradicting C2 and reports whatever result occurs.

## PI-2 — Local Kubernetes Search Laboratory

### Objective

Use the frozen standalone corpus/query contracts so **topology**, rather than corpus semantics, becomes the experimental variable.

```text
Docker Compose standalone control
              vs
local Kubernetes clustered topology
```

### Initial topology

```text
kind
  control plane / workers

SolrCloud
  official Solr Operator
  ZooKeeper
  explicit shards/replicas/resources/storage

OpenSearch
  supported multi-node deployment
  explicit primaries/replicas/resources/storage
```

### Required controls

Every meaningful PI-2 experiment must:

- reuse the frozen 10K/100K/1M corpus/query definitions;
- verify standalone/clustered schema, mapping and analyzer semantics before timing interpretation;
- record node count, shards, replicas, heap, CPU/memory and storage context;
- preserve API elapsed versus engine-native timing distinctions;
- preserve semantic/facet/result parity gates;
- begin with concurrency 1 / 8 / 32;
- describe kind as local clustered evidence, never as a cloud-performance proxy.

### Exit criteria

PI-2 exits when:

- kind lifecycle is repository-owned and reproducible;
- SolrCloud and multi-node OpenSearch run locally;
- the frozen deterministic projection reaches both engines with expected identity/count;
- Search Lab works through Spring against clustered targets;
- standalone versus clustered measurements are reproducible;
- at least one controlled node-loss/recovery scenario per engine is recorded;
- post-recovery persistence/projection parity is verified;
- Compose remains supported as the default demo/control path.

## PI-3 — AWS Implementation Candidate

PI-3 begins only after PI-2 produces useful topology evidence.

PI-2 should inform:

- EKS/node sizing;
- shards/replicas;
- storage requirements;
- JVM/pod defaults;
- persistence/backup choices;
- readiness/liveness/observability;
- whether a deployed target needs one or both search engines.

Terraform versus CDK remains an implementation decision rather than a predetermined outcome.

## PI-4 — Manual Accessibility Evidence

### Objective

Close the human-verification gap that lint, axe, Storybook and Playwright cannot prove.

Issue #49 covers:

- full keyboard-only application review;
- Search Lab and Evidence keyboard/focus flows;
- Maps visual/nonvisual equivalence and MapLibre focus-path review;
- NVDA in Firefox and Chrome/Chromium;
- JAWS where available, otherwise explicit N/A with reason;
- cognitive/workflow review;
- WCAG 2.2 manual focus/dragging/target-size checks;
- federal ICT Testing Baseline / Trusted Tester crosswalk.

Every manual result must be dated and commit-bound. Automated evidence never substitutes for manual assistive-technology evidence.

## PI-5 — Browser Evidence CI and Governance

The dedicated browser evidence architecture is delivered. Remaining governance decisions are:

- which WCAG/Section 508-oriented jobs become required merge checks;
- whether `main` receives branch protection;
- how prior known-good evidence is retained when a refresh fails.

## PI-6 — Solr/OpenSearch Comparison Hardening

The core lexical comparison evidence is delivered:

- result/facet semantic comparison;
- raw paired samples;
- bootstrap confidence evidence;
- independent randomized batches;
- workload classes;
- concurrency 1 / 8 / 32;
- resource telemetry;
- automated statistical report;
- Evidence UI productization.

Future PI-6 breadth is optional and should remain evidence-gated:

- phrase/highlighting;
- geo;
- autocomplete/suggest and synonyms;
- nested/object fields;
- vector/hybrid search.

## Final portfolio-facing slice — #51

After #46-#49, the intended final product slice is frontend mission alignment and polish.

The repository should present itself first as a government-grade Angular Open Science/data-discovery frontend, with the full-stack and search-research work serving as technical evidence underneath it.

The final presentation should emphasize:

- Angular 22 + NgRx/RxJS architecture;
- generated OpenAPI TypeScript clients;
- search/facet URL state;
- loading/empty/error/partial-service states;
- research-object provenance;
- MapLibre with semantic list/table equivalence;
- Section 508/WCAG evidence;
- Storybook/Playwright/axe/manual verification;
- performance-aware behavior against a realistic million-record backend.

The independence/non-affiliation disclaimer remains mandatory.

## Cross-program invariants

1. DSpace remains authoritative for curated repository objects.
2. External publishers remain authoritative for federated source records.
3. Search engines remain derived state.
4. A corpus has deterministic provenance/identity before performance is interpreted.
5. Solr/OpenSearch comparisons require equivalent normalized input and semantic gates.
6. Topology changes must not silently change record meaning.
7. Compose remains the default fast development/demo baseline.
8. Performance and semantic quality remain separate evidence dimensions.
9. Automated accessibility evidence never substitutes for required manual evidence.
10. Failed evidence runs never overwrite a prior known-good baseline.
11. Certified C2 remains immutable historical/control evidence; new experiments are versioned separately.
