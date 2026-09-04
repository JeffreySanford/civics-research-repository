# Active Backlog

This file contains **open work only**. Delivered history belongs in [documentation/history/platform-evolution.md](../documentation/history/platform-evolution.md), generated repository facts belong in [documentation/platform-status.md](../documentation/platform-status.md), and the certified C2 standalone milestone is recorded in [documentation/federation/scale-evidence.md](../documentation/federation/scale-evidence.md).

The repository follows an evidence-first rule: define the contract, controls and evidence boundary before broadening a feature surface or running a new performance experiment.

## Current position

The certified standalone C2 baseline is complete. These are no longer active backlog items:

- exact 500K Data.gov + 500K DOE OSTI million-record composition;
- deterministic 1,000,181-document Solr/OpenSearch projection parity;
- deep cursor/search-after traversal without gaps or duplicates;
- versioned lexical workload matrix;
- raw paired timing samples and bootstrap confidence evidence;
- independently warmed batches and seeded randomized execution order;
- concurrency 1 / 8 / 32;
- CPU, memory, JVM/GC and container telemetry;
- automated statistical research synthesis;
- certified C2 Evidence UI productization.

Those results remain historical/control evidence. New work must not silently rewrite them.

## #46 — Close certified C2 milestone

- [ ] Realign planning/history documents to the final C2 state.
- [ ] Keep only evidence-backed acceptance criteria checked.
- [ ] Merge the preregistered C2.1 protocol before collecting any C2.1 timing data.

## #47 — C2.1 adversarial Solr/OpenSearch fairness validation

Protocol: [C2 Adversarial Validation Protocol](C2_ADVERSARIAL_VALIDATION_PROTOCOL.md)

The goal is to try to **falsify** the current Solr-favoring observation, not strengthen it by construction.

- [ ] Pin exact Solr and OpenSearch versions/digests.
- [ ] Equalize explicit JVM heap and container CPU/memory controls where technically equivalent.
- [ ] Record shard/replica/index settings with each experimental block.
- [ ] Admit OpenSearch query/aggregation optimizations only after semantic-equivalence gates pass.
- [ ] Use the preregistered Q01-Q20 full-text query matrix.
- [ ] Use preregistered broad, moderate and genuinely selective filter bands.
- [ ] Add p90 while retaining p50/p95/p99.
- [ ] Execute balanced seeded randomized engine-first order.
- [ ] Warm every independent batch separately.
- [ ] Run multiple clean engine/container restart blocks.
- [ ] Preserve raw paired samples, restart-block identities and batch identities.
- [ ] Report every preregistered cell, including cells where OpenSearch wins or the result is inconclusive.
- [ ] Keep C2.1 artifacts distinct from certified C2 artifacts.
- [ ] Extend the Evidence UI/report so C2 and C2.1 cannot be confused.

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

This is the intended final portfolio-facing slice after #47 and #49.

- [ ] Reorder the README so the Angular government data-discovery frontend is the primary story.
- [ ] Add a frontend engineering case study covering Angular, NgRx/RxJS, OpenAPI-generated clients, URL state, async states, accessibility and Maps equivalence.
- [ ] Add a concise 5-8 minute frontend-first demo path.
- [ ] Audit `/discovery`, representative research detail, `/maps`, `/evidence` and `/search-lab` for final hierarchy, dense-data usability, responsive/reflow and keyboard/focus quality.
- [ ] Make the browser/API ownership boundary explicit: Angular owns interaction/presentation/accessibility; Spring owns application API/use cases; DSpace and search engines remain behind the typed boundary.
- [ ] Preserve the repository's non-affiliation disclaimer and avoid implying this is official Census Bureau software.

## Deferred topology work

Issue #48, the local Kubernetes search laboratory, is closed **not planned** for the current completion path.

Reopen clustered/Kubernetes work only if a concrete deployment, resilience or cloud-migration requirement appears. A one-host kind cluster is a different topology experiment; it is not required to make C2.1 statistically defensible.

## Optional federation and map expansion

These are legitimate future directions, but they are not prerequisites for calling the current standalone platform successful.

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

## Optional infrastructure / AWS

No AWS/IaC work is required to finish the current repository. If deployment becomes a concrete goal later:

- [ ] choose Terraform or CDK based on actual deployment needs;
- [ ] add secrets/identity, observability, backup/restore and persistent search storage;
- [ ] document deployment and rollback from the Compose baseline;
- [ ] decide whether both search engines are justified outside the comparison laboratory.
