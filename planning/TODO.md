# Active Backlog

This file contains **open work only**. Delivered history belongs in [documentation/history/platform-evolution.md](../documentation/history/platform-evolution.md), generated repository facts belong in [documentation/platform-status.md](../documentation/platform-status.md), and certified C2/C2.1 evidence remains historical/control evidence.

The repository follows an evidence-first rule: define the contract, controls and evidence boundary before broadening a feature surface.

## Current position

The standalone C2 baseline, adversarial C2.1 validation, frontend mission/portfolio alignment, the mobile-first search-to-research journey, shared rank/relevance presentation and the September dependency-security cleanup are complete.

Issue #49 is closed **not planned**. Manual assistive-technology testing is therefore not an active backlog requirement. Existing automated accessibility evidence remains valuable but must not be represented as completed manual Section 508/Trusted Tester/AT verification.

## #97 — Shared result explainability dialog

Plan: [Result Explainability Dialog Plan](../mobile-first/planning/result-explainability-dialog-plan.md)

- [ ] Add a shared presentational information control and dialog content surface in the existing `shared-ui` boundary.
- [ ] Keep query/filter context adaptation and dialog orchestration app-specific.
- [ ] Present global ordinal rank separately from query-relative match strength.
- [ ] Present relevance model/version/calibration metadata and truthful caveats.
- [ ] Render typed field/term `matchEvidence` without exposing raw Solr/OpenSearch explain trees.
- [ ] Support a mobile near-full-screen presentation and larger-screen modal through one semantic dialog contract.
- [ ] Prove focus entry/trap/Escape/Close/focus-return behavior.
- [ ] Add 320px reflow, forced-colors, Storybook, component, browser and axe evidence in both frontends.

## #98 — Design lifecycle evidence

- [ ] Select one representative mobile-first discovery/search slice.
- [ ] Capture a low-fidelity/wireframe artifact.
- [ ] Add an annotated component/interaction specification.
- [ ] Link the corresponding Storybook states and responsive breakpoints.
- [ ] Link the production components and browser/accessibility evidence.
- [ ] Document touch-target, focus, breakpoint/reflow, rank-vs-match-strength, forced-colors, async-state and reuse decisions.
- [ ] Keep Figma optional; do not add a runtime dependency for documentation.
- [ ] Avoid implying human usability or assistive-technology findings that were not collected.

## #99 — Read-only repository steward/status surface

- [ ] Inventory existing API data for corpus/profile identity, projection status, search-engine parity, synchronization/adapters and automated evidence status.
- [ ] Define a small read-only steward workflow rather than duplicating the existing Admin surface.
- [ ] Reuse the generated OpenAPI/client boundary and add fields only where the current contract cannot truthfully express required status.
- [ ] Show authority boundaries and degraded/fallback conditions explicitly.
- [ ] Add loading, empty, degraded and error states.
- [ ] Keep secrets, credentials and operator-only diagnostics out of the browser contract.
- [ ] Add responsive/component/browser/axe evidence.

## Optional federation and map expansion

These are legitimate future directions, but they are not prerequisites for calling the current platform successful.

- [ ] Define DOI/PMID/other durable cross-source reconciliation rules; never silently merge by title.
- [ ] Add configurable publisher request concurrency/rate-limit policy where needed.
- [ ] Extend bounded NASA CMR collection/granule evidence when it answers a new spatial/temporal question.
- [ ] Add PubMed/OpenAlex only after durable identity and bounded-harvest contracts are ready.
- [ ] Promote additional Maps work from issue #69 only when a concrete research question justifies it.
- [ ] Keep new spatial enrichment outside certified C2/C2.1 identity unless explicitly versioned as a new research experiment.

## Optional product/governance hardening

- [ ] Decide which browser/accessibility jobs become required merge checks.
- [ ] Decide whether `main` receives branch protection.
- [ ] Preserve prior known-good automated accessibility evidence when a refresh fails.
- [ ] Continue typed API error and contract/integration-test hardening.
- [ ] Remove temporary transitive dependency overrides when upstream packages naturally satisfy the patched ranges documented in `RISKS.md`.

## Optional infrastructure / AWS

No AWS/IaC work is required to finish the current repository. If deployment becomes a concrete goal later:

- [ ] choose Terraform or CDK based on actual deployment needs;
- [ ] add secrets/identity, observability, backup/restore and persistent search storage;
- [ ] document deployment and rollback from the Compose baseline;
- [ ] decide whether both search engines are justified outside the comparison laboratory.
