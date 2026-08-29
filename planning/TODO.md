# Active Backlog

This file contains open work only. Current status is generated in [documentation/platform-status.md](../documentation/platform-status.md); delivered history is in [documentation/history/platform-evolution.md](../documentation/history/platform-evolution.md).

The repository follows a **testing-first rule** for new comparison work: define or extend unit, use-case, contract, browser, accessibility and real-stack evidence before expanding the feature surface. A feature is not considered complete merely because it works in the local UI.

## P1 — Manual accessibility evidence

- [ ] Run Checklist 1 end to end without a mouse and record the result.
- [ ] Run Checklist 2 with NVDA in Firefox and Chrome.
- [ ] Run Checklist 3 with JAWS, or record N/A with the licensing reason.
- [ ] Complete Checklist 4, starting with the trusted map-click/map-to-list focus path.
- [ ] Complete Checklist 5 cognitive/workflow review.
- [ ] Decide whether to add a `contentinfo` landmark.
- [ ] Review the MapLibre canvas tab stop with a screen reader and document the decision.
- [ ] Run the Search Lab comparison flow with keyboard-only input and record scenario selection, filter entry, run action, live completion announcement, projection evidence and both engine result regions.

## P2 — Browser evidence CI and governance

- [ ] Add a dedicated or scheduled full Playwright evidence workflow.
- [ ] Upload Playwright HTML reports, traces and screenshots when the evidence workflow fails.
- [ ] Run the Search Lab comparison scenarios in the dedicated browser workflow.
- [ ] Run the Search Lab WCAG/Section 508 axe route in the dedicated browser workflow.
- [ ] Add a real-stack smoke path that exercises browser -> Spring API -> Solr + OpenSearch instead of only mocked API routes.
- [ ] Decide whether WCAG/Section 508-oriented jobs are required merge checks.
- [ ] Decide whether `main` receives branch protection.
- [ ] Ensure CI uses the same `evidence:check` and generated-document drift rules as local quality gates.

## P3 — Solr/OpenSearch comparison hardening

The first vertical slice is implemented: OpenSearch runs beside Solr, both receive the same normalized discovery projection, the projection has a deterministic SHA-256 identity, the API exposes typed comparison scenarios, and `/search-lab` renders side-by-side results with explicit projection-parity evidence. Remaining work is test/evidence hardening and operational visibility, not a rewrite of repository ownership.

### Testing first

- [ ] Add `SearchComparisonServiceTest` covering successful dual-engine execution, one-engine-down behavior, one-engine exception isolation, request normalization, engine warnings, current-projection parity and projection mismatch.
- [ ] Add `SearchComparisonController` tests for scenario listing and comparison-run delegation/serialization.
- [ ] Add Angular Search Lab unit tests for initial state, scenario loading, request construction, successful comparison rendering, partial engine failure and API error handling.
- [ ] Add `RepositorySearchComparisonApi` unit tests for scenario and comparison endpoints.
- [x] Add HTTP-level OpenSearch request semantics coverage for self-excluding aggregations, keyword geography and descending vintage-year buckets.
- [x] Add Playwright comparison scenarios for faceting/aggregations, full-text relevance and filtering.
- [x] Add Search Lab to the automated axe WCAG/Section 508 route matrix.
- [ ] Add Search Lab to the end-to-end demo storyboard.
- [ ] Add a real-stack smoke test that proves the same request reaches live Solr and live OpenSearch through the Spring API.
- [ ] Get the final branch head clean across format, OpenAPI drift, fixture/evidence/document drift, lint, unit tests, UI build, Java tests, runtime image and browser evidence.

### Admin Sync operational visibility

- [ ] Extend Admin Sync from a Solr-only discovery projection view to a **search projection** view that explains DSpace -> normalized `DiscoveryDocument` -> deterministic projection ID -> Solr + OpenSearch.
- [ ] Show the current projection ID and expected object count.
- [ ] Show per-engine enabled/reachable/projected state, index name, indexed document count, projection ID, parity status and last warning.
- [ ] Make the reindex action describe that one normalized document set is projected to every configured target; do not imply that Solr is the only public projection target.
- [ ] Preserve the distinction that Solr remains the browser-facing discovery implementation while OpenSearch is currently the comparison target.
- [ ] Add unit/accessibility coverage for the new Admin Sync search-projection state.

### Evidence-page visibility

- [ ] Add a Search Engine Comparison evidence section to `/evidence`.
- [ ] Surface the deterministic projection ID, normalized object count and whether Solr/OpenSearch parity is verified.
- [ ] Surface automated evidence for Search Lab unit/use-case tests, Playwright scenarios, axe coverage and real-stack smoke coverage once each is actually executed.
- [ ] Clearly distinguish **automated pass**, **manual pending**, **fixture/mocked browser evidence**, and **real-stack evidence**.
- [ ] Do not convert API elapsed time into a production benchmark claim; timing evidence must state the environment and measurement boundary.
- [ ] Add evidence-page unit/accessibility coverage for the comparison evidence presentation.

### Comparison behavior and documentation

- [x] Add OpenSearch to the default `start:all` Docker stack with persistent storage.
- [x] Implement OpenSearch indexing from the same normalized DSpace research object projection used by Solr.
- [x] Split projection targets from the browser-facing `DiscoveryIndex` contract.
- [x] Add deterministic projection fingerprinting and per-engine projection target state.
- [x] Add OpenAPI schemas and generated frontend types for comparison scenarios and responses.
- [x] Add Java comparison services behind explicit Solr/OpenSearch boundaries.
- [x] Add `/search-lab` with side-by-side engine results, facets/aggregations, object counts, local elapsed timing and projection parity.
- [x] Implement initial scenarios for faceting/aggregations, weighted full-text relevance and filtering.
- [ ] Update generated/admin projection state so the standard reindex response exposes the projection ID consistently.
- [ ] Add engine-native timing diagnostics (`responseHeader.QTime` for Solr and `took` for OpenSearch) separately from API elapsed time.
- [ ] Add warm-up and repeated-run measurements before making any performance comparison; report distributions such as p50/p95/p99 rather than a single request.
- [ ] Add rank/result-set/facet-difference summaries that explain *why* engines differ rather than only showing two columns.
- [ ] Add phrase search and highlighting after the current test matrix is green.
- [ ] Add geo, autocomplete/suggest, synonyms, nested/object and vector/hybrid scenarios only after the basic comparison path is fully hardened.

## P4 — Provenance and identity

- [ ] Add typed provenance values for live aggregation, stored sample, fixture, stale and unavailable data.
- [ ] Record publisher freshness per research object where a reliable source date exists.
- [ ] Record and expose discovery projection timestamps consistently across Admin Sync, Evidence and Search Lab.
- [ ] Add regression coverage for LODES fallback provenance.
- [ ] Review UUID/source-identifier route stability and relationship resolution.

## P5 — Research-object product language

- [ ] Add `/research/:id` as an alias for the existing detail route.
- [ ] Replace remaining dataset-shaped copy where the object may be a publication, methodology or project.
- [ ] Update examples and demo links to prefer research-object terminology.

## P6 — Publisher verification and federation

- [ ] Add listing/vintage verification to remaining programs where publisher structure permits it.
- [ ] Keep catalog edits reviewable rather than automatically applying uncertain file-name changes.
- [ ] Evaluate NOAA Climate Data Online as a federation candidate.
- [ ] Evaluate NASA POWER as a federation candidate.

## P7 — Infrastructure as code

- [ ] Choose Terraform or CDK.
- [ ] Implement the documented AWS target or alternate.
- [ ] Add secrets, observability, backup/restore and persistent search storage.
- [ ] Document deployment and rollback from the local Compose baseline.

## P8 — Platform hardening

- [ ] Move NgRx dependencies from release candidates to stable versions after validation.
- [ ] Revisit generated Spring controller interfaces when Spring 7 support is ready.
- [ ] Add Testcontainers coverage for `JdbcSyncJobStore` and critical repository paths.
- [ ] Add typed API error responses where generic failures remain.
- [ ] Review Nx/dependency upgrade warnings.
- [ ] Re-run bounded mirroring with a larger budget when storage permits.
