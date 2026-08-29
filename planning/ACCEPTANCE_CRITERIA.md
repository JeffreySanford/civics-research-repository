# Acceptance Criteria

## First Vertical Slice

The first implementation milestone is complete when the demo can show one public research dataset flowing through the repository, API, Angular UI, map visualization, and accessibility evidence.

**Status: complete for the connected slice.** Discovery, facets, dataset detail, and related research read from DSpace; the generated fixture catalog is a labelled fallback only when the repository is unavailable. Open items below are follow-on breadth, contract polish, or demo artifacts — not a broken integration.

Checking a box here means the behavior is implemented and covered by a test, not that every adjacent seam is closed. For the Solr/OpenSearch comparison, **testing first is the acceptance rule**: adding a test file is not enough when the relevant CI/browser workflow has not actually executed it.

## Data and Repository

- [x] One visual geospatial North Dakota dataset from TIGER/Line or LODES is represented as a repository item.
- [x] ACS PUMS remains documented as a follow-on metadata-rich repository dataset.
- [x] Item metadata includes title, abstract, publisher, program, geography, vintage year, source URL, documentation URL, file list, and citation.
- [x] Large source files are represented by file manifests and source URLs unless intentionally mirrored.
- [x] Mirrored publisher artifacts persist in Docker storage when useful for local demo reliability. _(The current committed snapshot is 76 files / 1.00 GiB from the earlier bounded run. The active policy now uses a 5 GiB total mirror budget with no independent per-file cap; the snapshot changes after the next mirror/seed run.)_
- [x] Sync state records source identifier, source URL, DSpace item ID, last sync status, and source freshness. _(`sync_jobs` holds mode, source, status and timing; `repository_objects` holds the source identifier, its DSpace UUID, the source URL, when the source was last consulted, and when discovery last indexed it. Exposed at `/admin/repository/identity`.)_
- [x] Startup sync creates or updates required seed repository objects after Docker startup.
- [x] DSpace community and collection exist for Census public research data.
- [x] The item is available through DSpace REST.
- [x] The item is discoverable through Solr-backed search.
- [x] No large public-use dataset files are checked into git.

## API Contract

- [x] Search, dataset detail, versions, map layers, USGS earthquake overlay, and accessibility evidence endpoints are described in OpenAPI.
- [x] Frontend TypeScript DTOs are generated from OpenAPI.
- [x] Java DTOs are generated from OpenAPI on every build. _(Model types only; generated controller interfaces deferred until Spring 7 support.)_
- [x] `pnpm run openapi:check` fails when generated frontend types drift.
- [x] API errors use typed error responses (`ErrorResponse` with `code`, `message`, optional `details`, and `traceId`; applied to 400/404/500/503 on search, datasets, maps, admin sync/reindex, and evidence routes).

## Backend

- [x] `apps/repository-api` runs locally through an Nx target.
- [x] Java API targets Java 21.
- [x] API endpoints return typed responses for the first dataset.
- [x] Request validation rejects invalid pagination, IDs, date ranges, enum values, and URL inputs.
- [x] Unit tests cover controller validation and service mapping.
- [x] Backend configuration separates local DSpace, Solr, and USGS endpoints from code.

## Frontend

- [x] Search page supports keyword search, facets, loading, empty, and error states.
- [x] Search state is represented in URL parameters where practical.
- [x] Dataset detail page shows metadata, files, versions, citation, and map tab when geospatial metadata exists.
- [x] Admin workflow exposes manual sync controls and sync status.
- [x] Accessibility evidence view summarizes automated and manual evidence.
- [x] Angular API imports use generated OpenAPI types.
- [x] NgRx effects own API calls and cancellation for search, dataset detail, map overlays, and evidence.
- [x] Components do not hand-author duplicate DTOs.

## Mapping

- [x] Map tab renders a MapLibre GL Census geography or sample layer for the selected dataset.
- [x] USGS earthquake overlay can be toggled.
- [x] Map includes legend, attribution, visible update timestamp, and clear error/stale states.
- [x] Mapped information is also available as an accessible table or feature list.
- [x] Layer controls are keyboard reachable and have accessible names.

## Search Comparison

### Architecture and contract

- [x] `pnpm run start:all` includes OpenSearch as a default local service with persistent Docker storage.
- [x] DSpace remains the system of record; neither Solr nor OpenSearch is authoritative repository storage.
- [x] Solr and OpenSearch receive the same normalized `DiscoveryDocument` projection rather than independently assembling source data.
- [x] The normalized projection has a deterministic SHA-256 identity so parity is stronger than document-count equality.
- [x] Per-engine projection state records whether the current projection succeeded, its projection ID, engine-reported document count, and warnings.
- [x] Search comparison endpoints are described in OpenAPI and frontend TypeScript types are generated from the contract.
- [x] The standard admin reindex contract can expose the deterministic projection ID so Search Lab, Admin Sync, and Evidence can use the same identity vocabulary.

### Search Lab behavior

- [x] `/search-lab` runs the same normalized request against Solr and OpenSearch in one comparison workflow.
- [x] The page supports facets/aggregations, full-text relevance, and filtering scenarios.
- [x] The page exposes source, expected object count, projection ID, engine index names, engine document counts, local API elapsed time, facets/aggregations, and ranked results.
- [x] Projection parity is explicitly verified before engine differences are interpreted.
- [x] One engine can fail or be unreachable without hiding evidence returned by the other engine.
- [x] Local timing is labelled as a measurement of that run rather than a production benchmark claim.
- [x] OpenSearch preserves self-excluding facet semantics, keyword geography aggregation, and newest-first vintage-year presentation for a meaningful Solr comparison.

### Testing and evidence gate

- [x] Java comparison service/use-case tests execute successfully for dual-engine success, one-engine-down behavior, failure isolation, normalization, and projection mismatch.
- [x] Comparison controller tests execute successfully.
- [x] Angular Search Lab component and typed API-client unit tests execute successfully.
- [x] Deterministic Playwright comparison scenarios execute successfully.
- [x] Search Lab axe/WCAG/Section 508-oriented route evidence executes successfully.
- [x] Search Lab is included in the executable demo storyboard.
- [x] A real-stack browser smoke test proves Angular -> Spring API -> live Solr + live OpenSearch without API route mocks.
- [x] Dedicated browser CI retains an HTML report and failure traces/screenshots and distinguishes deterministic mocked evidence from real-stack evidence.
- [ ] The final PR head is green across normal workspace/API CI and dedicated browser evidence.

### Operational/evidence follow-on

- [x] Admin Sync shows the normalized projection, current projection ID, and per-engine Solr/OpenSearch projection health instead of presenting reindexing as Solr-only.
- [x] Evidence contains a Search Engine Comparison section that distinguishes unit/use-case evidence, deterministic mocked browser evidence, live-stack evidence, automated accessibility evidence, and manual evidence.
- [x] Engine-native timing (`Solr QTime`, `OpenSearch took`) is exposed separately from API elapsed time before performance conclusions are made.
- [x] Repeated measurement uses warm-up and distributions such as p50/p95/p99 before any comparative performance claim.
- [x] Broader phrase/highlight/geo/suggest/synonym/vector/hybrid scenarios wait until the current comparison test matrix is green.

## Accessibility Evidence

- [x] `pnpm run wcag:report` produces a console report.
- [x] `pnpm run section508:report` produces a console report.
- [x] Angular evidence view displays the latest accessibility evidence status.
- [x] Automated scans cover search, dataset detail, and map workflows.
- [x] Keyboard tests cover search filters, result navigation, dataset tabs, and map layer controls.
- [x] Manual checklists exist for keyboard, NVDA, JAWS where available, and map equivalence. _(Checklists delivered; no run recorded yet.)_
- [x] Known accessibility limitations are documented.
- [ ] Manual Search Lab keyboard and screen-reader evidence is recorded before a manual conformance claim is made for that workflow.

## Demo Readiness

- [x] `pnpm run start:all` starts the full development and demonstration experience, including DSpace, seed, reindex, and the OpenSearch comparison service. _(Alias: `pnpm dev`, `pnpm run demo:up`.)_
- [x] Docker Compose starts persistent local services and the app can be demoed after restart.
- [x] `pnpm run test:all` passes for the previously accepted baseline.
- [x] `pnpm run quality:all` passes for the previously accepted baseline.
- [x] Continuous integration runs the normal quality gates on pull requests: formatting, OpenAPI lint, contract and fixture drift, lint, unit tests, the Angular build, and the Spring service's Gradle test and runtime image. [ci.yml](../.github/workflows/ci.yml).
- [ ] The new comparison test additions pass those normal CI gates on the final PR head.
- [ ] Dedicated browser evidence runs Playwright, axe, storyboard, and the live Solr/OpenSearch smoke path successfully on the final PR head. [browser-evidence.yml](../.github/workflows/browser-evidence.yml).
- [ ] `main` is protected with required status checks. _(Interacts with the current direct-to-main workflow; a deliberate choice rather than an oversight.)_
- [x] Demo script explains the architecture, dataset flow, map overlay, and accessibility evidence. [demo-script.md](../documentation/demo/demo-script.md), with separate ingestion, mapping, and accessibility-evidence walkthroughs and a recorded tradeoffs list.
