# Active Backlog

This file contains **open work only**. Delivered history belongs in [documentation/history/platform-evolution.md](../documentation/history/platform-evolution.md), generated repository facts belong in [documentation/platform-status.md](../documentation/platform-status.md), and certified C2/C2.1 evidence remains historical/control evidence.

The repository follows an evidence-first rule: define the contract, controls and evidence boundary before broadening a feature surface.

## Current position

The standalone C2 baseline, adversarial C2.1 validation, frontend mission/portfolio alignment, the mobile-first search-to-research journey, shared rank/relevance/result-explainability presentation and the September dependency-security cleanup are complete.

Shared result explainability was delivered through issue #97 / PR #103. Both Angular frontends now consume the same presentational explanation semantics from `shared-ui` while retaining application-specific state/routing orchestration.

Issue #49 is closed **not planned**. Manual assistive-technology testing is therefore not an active backlog requirement. Existing automated accessibility evidence remains valuable but must not be represented as completed manual Section 508/Trusted Tester/AT verification.

## #98 — Design lifecycle evidence

- [x] Select one representative mobile-first discovery/search slice.
- [x] Capture a low-fidelity/wireframe artifact.
- [x] Add an annotated component/interaction specification.
- [x] Link the corresponding Storybook states and responsive breakpoints.
- [x] Link the production components and browser/accessibility evidence.
- [x] Document touch-target, focus, breakpoint/reflow, rank-vs-match-strength, forced-colors, async-state and reuse decisions.
- [x] Keep Figma optional; do not add a runtime dependency for documentation.
- [x] Avoid implying human usability or assistive-technology findings that were not collected.
- [ ] Merge the design-lifecycle case study and decision record after repository validation.

Primary artifact: [Mobile Search Design Lifecycle Case Study](../mobile-first/documentation/design/mobile-search-design-lifecycle.md)

Decision record: [ADR-002 — Mobile Search Interaction and Shared Evidence Model](../mobile-first/documentation/adr-002-mobile-search-interaction-and-evidence-model.md)

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
