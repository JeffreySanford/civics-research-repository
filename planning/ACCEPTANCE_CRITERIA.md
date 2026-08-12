# Acceptance Criteria

## First Vertical Slice

The first implementation milestone is complete when the demo can show one public research dataset flowing through the repository, API, Angular UI, map visualization, and accessibility evidence.

**Status: not complete, despite most boxes below being checked.** The flow is broken in one place. The dataset reaches DSpace through sync, and the UI renders a dataset — but the UI renders it from fixtures rather than from DSpace, so the two halves are not connected. Criteria affected by this carry an inline note. Closing it is priority P1 in [TODO.md](TODO.md#current-priorities).

Checking a box here means the behavior is implemented and covered by a test, not that the surrounding integration is finished.

## Data and Repository

- [x] One visual geospatial North Dakota dataset from TIGER/Line or LODES is represented as a repository item.
- [x] ACS PUMS remains documented as a follow-on metadata-rich repository dataset.
- [x] Item metadata includes title, abstract, publisher, program, geography, vintage year, source URL, documentation URL, file list, and citation.
- [x] Large source files are represented by file manifests and source URLs unless intentionally mirrored.
- [ ] Small-to-medium mirrored demo artifacts persist in Docker storage when useful for local demo reliability.
- [ ] Sync state records source identifier, source URL, DSpace item ID, last sync status, and source freshness. _(Mode, source, status, and timing are recorded; DSpace item ID and source freshness are not.)_
- [x] Startup sync creates or updates required seed repository objects after Docker startup.
- [x] DSpace community and collection exist for Census public research data.
- [x] The item is available through DSpace REST.
- [x] The item is discoverable through Solr-backed search.
- [x] No large public-use dataset files are checked into git.

## API Contract

- [x] Search, dataset detail, versions, map layers, USGS earthquake overlay, and accessibility evidence endpoints are described in OpenAPI.
- [x] Frontend TypeScript DTOs are generated from OpenAPI.
- [ ] Java DTOs are generated from OpenAPI or mechanically verified against it. _(Last open contract gate — Java records are hand-written.)_
- [x] `pnpm run openapi:check` fails when generated frontend types drift.
- [ ] API errors use typed error responses.

## Backend

- [x] `apps/repository-api` runs locally through an Nx target.
- [x] Java API targets Java 21.
- [x] API endpoints return typed responses for the first dataset.
- [x] Request validation rejects invalid pagination, IDs, date ranges, enum values, and URL inputs.
- [x] Unit tests cover controller validation and service mapping.
- [x] Backend configuration separates local DSpace, Solr, and USGS endpoints from code.

## Frontend

- [x] Search page supports keyword search, facets, loading, empty, and error states. _(Served from fixtures, not DSpace — see P1.)_
- [x] Search state is represented in URL parameters where practical.
- [x] Dataset detail page shows metadata, files, versions, citation, and map tab when geospatial metadata exists. _(Served from fixtures, not DSpace — see P1.)_
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

## Accessibility Evidence

- [x] `pnpm run wcag:report` produces a console report.
- [x] `pnpm run section508:report` produces a console report.
- [x] Angular evidence view displays the latest accessibility evidence status.
- [x] Automated scans cover search, dataset detail, and map workflows.
- [x] Keyboard tests cover search filters, result navigation, dataset tabs, and map layer controls.
- [x] Manual checklists exist for keyboard, NVDA, JAWS where available, and map equivalence. _(Checklists delivered; no run recorded yet.)_
- [x] Known accessibility limitations are documented.

## Demo Readiness

- [x] `pnpm run start:all` starts the development experience. _(Excludes DSpace by design; one-command demo is P3.)_
- [x] Docker Compose starts persistent local services and the app can be demoed after restart.
- [x] `pnpm run test:all` passes.
- [x] `pnpm run quality:all` passes.
- [ ] Demo script explains the architecture, dataset flow, map overlay, and accessibility evidence.
