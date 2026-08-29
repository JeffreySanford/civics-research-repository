# Acceptance Criteria

## First Vertical Slice

The first implementation milestone is complete when the demo can show one public research dataset flowing through the repository, API, Angular UI, map visualization, and accessibility evidence.

**Status: complete for the connected slice.** Discovery, facets, dataset detail, and related research read from DSpace; the generated fixture catalog is a labelled fallback only when the repository is unavailable. Open items below are follow-on breadth, contract polish, or demo artifacts — not a broken integration.

Checking a box here means the behavior is implemented and covered by a test, not that every adjacent seam is closed.

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

- [x] `pnpm run start:all` includes OpenSearch as a default local service with persistent Docker storage.
- [x] The side-by-side Solr/OpenSearch demo plan defines scenarios, measurement limits, API shape and accessibility expectations.
- [ ] Solr and OpenSearch index the same normalized DSpace research object projection.
- [ ] Search comparison endpoints are described in OpenAPI and frontend TypeScript types are generated from the contract.
- [ ] Discovery exposes a comparison view with individual engine run buttons, `Run Both`, timing, scope, facets or aggregations, highlights and technical details.
- [ ] Storyboard, WCAG and Section 508 evidence cover the comparison workflow.

## Accessibility Evidence

- [x] `pnpm run wcag:report` produces a console report.
- [x] `pnpm run section508:report` produces a console report.
- [x] Angular evidence view displays the latest accessibility evidence status.
- [x] Automated scans cover search, dataset detail, and map workflows.
- [x] Keyboard tests cover search filters, result navigation, dataset tabs, and map layer controls.
- [x] Manual checklists exist for keyboard, NVDA, JAWS where available, and map equivalence. _(Checklists delivered; no run recorded yet.)_
- [x] Known accessibility limitations are documented.

## Demo Readiness

- [x] `pnpm run start:all` starts the full development and demonstration experience, including DSpace, seed, and reindex. _(Alias: `pnpm dev`, `pnpm run demo:up`.)_
- [x] Docker Compose starts persistent local services and the app can be demoed after restart.
- [x] `pnpm run test:all` passes.
- [x] `pnpm run quality:all` passes.
- [x] Continuous integration runs the quality gates on every push and pull request: formatting, OpenAPI lint, contract and fixture drift, lint, unit tests, the Angular build, and the Spring service's Gradle test and runtime image. [ci.yml](../.github/workflows/ci.yml).
- [ ] `main` is protected with required status checks. _(Interacts with the current direct-to-main workflow; a deliberate choice rather than an oversight.)_
- [x] Demo script explains the architecture, dataset flow, map overlay, and accessibility evidence. [demo-script.md](../documentation/demo/demo-script.md), with separate ingestion, mapping, and accessibility-evidence walkthroughs and a recorded tradeoffs list.
