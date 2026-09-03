# Active Backlog

This file contains **open work only**. Delivered history belongs in [documentation/history/platform-evolution.md](../documentation/history/platform-evolution.md), generated repository facts belong in [documentation/platform-status.md](../documentation/platform-status.md), and the certified C2 standalone milestone is recorded in [documentation/federation/scale-evidence.md](../documentation/federation/scale-evidence.md).

The repository follows an evidence-first rule: define the contract, controls and evidence boundary before broadening a feature surface or running a new performance experiment.

## Current position

The certified standalone C2 baseline is complete. The following are **not active backlog items anymore**:

- exact 500K Data.gov + 500K DOE OSTI million-record composition;
- deterministic 1,000,181-document Solr/OpenSearch projection parity;
- deep cursor/search-after traversal without gaps or duplicates;
- versioned lexical workload matrix;
- raw paired timing samples and bootstrap confidence evidence;
- independent separately warmed batches;
- balanced/seeded randomized execution order;
- concurrency checkpoints 1 / 8 / 32;
- CPU, memory, JVM/GC and container telemetry;
- automated statistical research synthesis;
- certified C2 Evidence UI productization.

Those results remain historical/control evidence. New work must not silently rewrite them.

## #46 — Close certified C2 milestone

- [ ] Realign planning/history documents to the final C2 state.
- [ ] Keep only evidence-backed acceptance criteria checked.
- [ ] Regenerate generated platform status from its source artifacts where supported.
- [ ] Merge the preregistered C2.1 protocol before collecting any C2.1 timing data.

## #47 — C2.1 adversarial Solr/OpenSearch fairness validation

Protocol: [C2 Adversarial Validation Protocol](C2_ADVERSARIAL_VALIDATION_PROTOCOL.md)

The goal is to try to **falsify** the current Solr-favoring observation, not strengthen it by construction.

- [ ] Pin exact Solr and OpenSearch versions.
- [ ] Equalize explicit JVM heap and container CPU/memory controls where technically equivalent.
- [ ] Record shard/replica/index settings with each experimental block.
- [ ] Admit OpenSearch query/aggregation optimizations only after semantic-equivalence gates pass.
- [ ] Use the preregistered full-text query matrix instead of relying on one query.
- [ ] Use preregistered broad, moderate and genuinely selective filter bands.
- [ ] Add p90 while retaining p50/p95/p99.
- [ ] Execute balanced seeded randomized engine-first order.
- [ ] Warm every independent batch separately.
- [ ] Run multiple clean engine/container restart blocks.
- [ ] Preserve raw paired samples and independently warmed batch identities.
- [ ] Report every preregistered cell, including cells where OpenSearch wins.
- [ ] Keep C2.1 artifacts distinct from certified C2 artifacts.
- [ ] Extend the Evidence UI/report so C2 and C2.1 cannot be confused.

## #48 — PI-2 local Kubernetes search laboratory

Compose remains the default fast development/demo path and the standalone control topology.

- [ ] Add repository-owned kind cluster lifecycle commands.
- [ ] Deploy SolrCloud using the official Solr Operator and ZooKeeper.
- [ ] Deploy a supported multi-node OpenSearch cluster.
- [ ] Define persistent storage, readiness/liveness, CPU/memory and JVM settings explicitly.
- [ ] Verify standalone and clustered schemas/mappings/analyzers are semantically aligned.
- [ ] Project the frozen corpus/query contracts without changing record semantics.
- [ ] Run 1 / 8 / 32 client comparisons with topology/resource metadata.
- [ ] Reproduce a controlled Solr node-loss/recovery experiment.
- [ ] Reproduce a controlled OpenSearch node-loss/recovery experiment.
- [ ] Verify post-recovery projection identity/parity.
- [ ] Preserve the boundary that kind is local clustered evidence, not a cloud-performance proxy.

## #49 — Manual accessibility evidence

Automated axe/browser evidence remains separate from human assistive-technology evidence.

- [ ] Full-application keyboard-only review.
- [ ] Search Lab keyboard-only comparison flow.
- [ ] Evidence page focus/read-order review, including C2/C2.1 sections.
- [ ] Maps keyboard path and visual/nonvisual equivalence review.
- [ ] MapLibre canvas tab-stop/focus-path review.
- [ ] NVDA + Firefox.
- [ ] NVDA + Chrome/Chromium.
- [ ] JAWS, or explicit N/A with licensing reason.
- [ ] Cognitive/workflow review for dense search/evidence/map surfaces.
- [ ] WCAG 2.2 manual checks for focus not obscured, dragging alternatives and target size.
- [ ] Crosswalk the checklist against the current federal ICT Testing Baseline / Trusted Tester structure used by the project.
- [ ] Bind every manual run to date, commit, browser/AT/OS context and remediation evidence.

## #51 — Final frontend mission alignment and portfolio polish

This is the intended final portfolio-facing slice after #46-#49.

- [ ] Reorder the README so the Angular government data-discovery frontend is the primary story.
- [ ] Add a frontend engineering case study covering Angular, NgRx/RxJS, OpenAPI-generated clients, URL state, async states, accessibility and Maps equivalence.
- [ ] Add a concise 5-8 minute frontend-first demo path.
- [ ] Audit `/discovery`, representative research detail, `/maps`, `/evidence` and `/search-lab` for final hierarchy, dense-data usability, responsive/reflow and keyboard/focus quality.
- [ ] Make the browser/API ownership boundary explicit: Angular owns interaction/presentation/accessibility; Spring owns application API/use cases; DSpace and search engines remain behind the typed boundary.
- [ ] Preserve the repository's non-affiliation disclaimer and avoid implying this is official Census Bureau software.

## Optional federation and map expansion

These are legitimate future research/product directions, but they are **not prerequisites** for calling the current standalone platform successful.

- [ ] Define DOI/PMID/other durable cross-source reconciliation rules; never silently merge by title.
- [ ] Add configurable publisher request concurrency/rate-limit policy where needed.
- [ ] Extend bounded NASA CMR collection/granule evidence when it answers a new spatial/temporal question.
- [ ] Add PubMed/OpenAlex only after durable identity and bounded-harvest contracts are ready.
- [ ] Add new Maps thematic measures only through shared authoritative geometry/value contracts with semantic list/table equivalents.
- [ ] Keep Data.gov spatial enrichment in a versioned sidecar so the C2 Gold Master identity is unchanged.

## Optional product/governance hardening

- [ ] Decide which browser/accessibility jobs become required merge checks.
- [ ] Decide whether `main` receives branch protection.
- [ ] Preserve the prior known-good accessibility baseline when an evidence refresh fails.
- [ ] Move NgRx dependencies from release candidates to stable versions after validation.
- [ ] Continue typed API error and contract/integration-test hardening.

## PI-3 — Infrastructure as Code / AWS

PI-3 begins only when PI-2 has produced useful local topology evidence.

- [ ] Choose Terraform or CDK based on the measured topology and deployment needs.
- [ ] Implement the documented AWS target or a justified alternative.
- [ ] Add secrets/identity, observability, backup/restore and persistent search storage.
- [ ] Document deployment and rollback from the Compose/kind baselines.
- [ ] Decide whether both search engines are justified outside the comparison laboratory.
