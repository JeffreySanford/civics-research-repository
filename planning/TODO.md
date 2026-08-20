# Active Backlog

This file contains open work only. Current status is generated in [documentation/platform-status.md](../documentation/platform-status.md); delivered history is in [documentation/history/platform-evolution.md](../documentation/history/platform-evolution.md).

## P1 — Manual accessibility evidence

- [ ] Run Checklist 1 end to end without a mouse and record the result.
- [ ] Run Checklist 2 with NVDA in Firefox and Chrome.
- [ ] Run Checklist 3 with JAWS, or record N/A with the licensing reason.
- [ ] Complete Checklist 4, starting with the trusted map-click/map-to-list focus path.
- [ ] Complete Checklist 5 cognitive/workflow review.
- [ ] Decide whether to add a `contentinfo` landmark.
- [ ] Review the MapLibre canvas tab stop with a screen reader and document the decision.

## P2 — Browser evidence CI and governance

- [ ] Add a dedicated or scheduled full Playwright evidence workflow.
- [ ] Upload HTML reports, traces and screenshots when the evidence workflow fails.
- [ ] Decide whether WCAG/Section 508-oriented jobs are required merge checks.
- [ ] Decide whether `main` receives branch protection.
- [ ] Ensure CI uses the same `evidence:check` and generated-document drift rules as local quality gates.

## P3 — Provenance and identity

- [ ] Add typed provenance values for live aggregation, stored sample, fixture, stale and unavailable data.
- [ ] Record publisher freshness per research object where a reliable source date exists.
- [ ] Record and expose discovery projection timestamps.
- [ ] Add regression coverage for LODES fallback provenance.
- [ ] Review UUID/source-identifier route stability and relationship resolution.

## P4 — Research-object product language

- [ ] Add `/research/:id` as an alias for the existing detail route.
- [ ] Replace remaining dataset-shaped copy where the object may be a publication, methodology or project.
- [ ] Update examples and demo links to prefer research-object terminology.

## P5 — Publisher verification and federation

- [ ] Add listing/vintage verification to remaining programs where publisher structure permits it.
- [ ] Keep catalog edits reviewable rather than automatically applying uncertain file-name changes.
- [ ] Evaluate NOAA Climate Data Online as a federation candidate.
- [ ] Evaluate NASA POWER as a federation candidate.

## P6 — Infrastructure as code

- [ ] Choose Terraform or CDK.
- [ ] Implement the documented AWS target or alternate.
- [ ] Add secrets, observability, backup/restore and persistent search storage.
- [ ] Document deployment and rollback from the local Compose baseline.

## P7 — Platform hardening

- [ ] Move NgRx dependencies from release candidates to stable versions after validation.
- [ ] Revisit generated Spring controller interfaces when Spring 7 support is ready.
- [ ] Add Testcontainers coverage for `JdbcSyncJobStore` and critical repository paths.
- [ ] Add typed API error responses where generic failures remain.
- [ ] Review Nx/dependency upgrade warnings.
- [ ] Re-run bounded mirroring with a larger budget when storage permits.
