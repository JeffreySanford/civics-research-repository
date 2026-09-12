# Active Backlog

This file contains **open work only**. Delivered history belongs in [documentation/history/platform-evolution.md](../documentation/history/platform-evolution.md), generated repository facts belong in [documentation/platform-status.md](../documentation/platform-status.md), and certified C2/C2.1 evidence remains historical/control evidence.

The repository follows an evidence-first rule: define the contract, controls and evidence boundary before broadening a feature surface.

## Current position

The standalone C2 baseline, adversarial C2.1 validation, frontend mission/portfolio alignment, the mobile-first search-to-research journey, shared rank/relevance/result-explainability presentation, design-lifecycle evidence and the September dependency-security cleanup are complete.

Shared result explainability was delivered through issue #97 / PR #103. Design lifecycle evidence was delivered through issue #98 / PR #104, including the mobile search case study and ADR-002.

Issue #49 is closed **not planned**. Manual assistive-technology testing is therefore not an active backlog requirement. Existing automated accessibility evidence remains valuable but must not be represented as completed manual Section 508/Trusted Tester/AT verification.

## #99 — Read-only repository steward/status surface

- [x] Inventory existing API data for corpus/profile identity, projection status, search-engine parity, synchronization/adapters and automated evidence status.
- [x] Define a small read-only steward workflow rather than duplicating the existing Admin mutation surface.
- [x] Reuse the generated OpenAPI/client boundary; no new backend schema is required for the first slice.
- [x] Show authority boundaries and degraded/fallback conditions explicitly.
- [x] Add loading, empty, degraded and error states.
- [x] Keep secrets, credentials and operator-only diagnostics out of the browser contract.
- [x] Add responsive/component/browser/axe evidence.
- [ ] Complete repository validation and merge the #99 implementation PR.

Primary implementation: `apps/discovery-ui/src/app/pages/repository-steward-page.ts`

The steward route composes existing non-mutating status/evidence contracts and reuses the existing Solr/OpenSearch projection-parity presentation. Privileged sync/reindex/harvest actions remain confined to Admin workflows.

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
