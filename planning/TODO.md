# Active Backlog

This file contains **open work only**. Delivered history belongs in [documentation/history/platform-evolution.md](../documentation/history/platform-evolution.md), generated repository facts belong in [documentation/platform-status.md](../documentation/platform-status.md), and the certified C2 standalone milestone is recorded in [documentation/federation/scale-evidence.md](../documentation/federation/scale-evidence.md).

The repository follows an evidence-first rule: define the contract, controls and evidence boundary before broadening a feature surface or running a new performance experiment.

## Current position

The certified standalone C2 baseline is complete, and the C2.1 pre-measurement fairness-control foundation is complete through PR #53.

These are no longer active backlog items:

- exact 500K Data.gov + 500K DOE OSTI million-record composition;
- deterministic 1,000,181-document Solr/OpenSearch projection parity;
- deep cursor/search-after traversal without gaps or duplicates;
- versioned lexical workload matrix;
- raw paired timing samples and bootstrap confidence evidence;
- independently warmed batches and seeded randomized execution order;
- concurrency 1 / 8 / 32;
- CPU, memory, JVM/GC and container telemetry;
- automated statistical research synthesis;
- certified C2 Evidence UI productization;
- C2 closeout/planning realignment from #46;
- C2.1 preregistration;
- C2.1 exact engine-version and equalized resource controls;
- C2.1 runtime identity/refusal manifest;
- C2.1 optimized OpenSearch treatment plus semantic-admission gate;
- C2.1 Q01-Q20 workload definitions and deterministic selectivity bands;
- C2.1 p90 timing contract;
- C2.1 deterministic balanced restart/order plan and READY authorization.

Those results remain historical/control or frozen pre-measurement evidence. New work must not silently rewrite them.

## #47 — C2.1 adversarial Solr/OpenSearch fairness validation

Protocol: [C2 Adversarial Validation Protocol](C2_ADVERSARIAL_VALIDATION_PROTOCOL.md)

The goal is to try to **falsify** the current Solr-favoring observation, not strengthen it by construction. PR #53 completed the fairness-control foundation; the remaining work is timed execution, synthesis and productization.

- [ ] Execute the preregistered Q01-Q20 full-text matrix under READY authorization.
- [ ] Execute facets plus broad, moderate and genuinely selective filter cells under the frozen semantic admission.
- [ ] Run all planned clean engine/container restart blocks with separately warmed batches and the frozen balanced seeded order.
- [ ] Preserve raw paired samples, restart-block identities, batch identities, realized order and runtime-manifest identity in C2.1-only artifacts.
- [ ] Report every preregistered cell, including cells where OpenSearch wins, ties or the result is inconclusive.
- [ ] Extend statistical synthesis for query-family and restart-block interpretation while retaining the existing multiplicity/local-topology guardrails.
- [ ] Keep C2.1 artifacts visibly distinct from certified C2 artifacts.
- [ ] Extend the Evidence UI/report so certified C2 and C2.1 cannot be confused.

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
