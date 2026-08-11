# Acceptance Criteria

## First Vertical Slice

The first implementation milestone is complete when the demo can show one public research dataset flowing through the repository, API, Angular UI, map visualization, and accessibility evidence.

## Data and Repository

- [ ] One visual geospatial North Dakota dataset from TIGER/Line or LODES is represented as a repository item.
- [ ] ACS PUMS remains documented as a follow-on metadata-rich repository dataset.
- [ ] Item metadata includes title, abstract, publisher, program, geography, vintage year, source URL, documentation URL, file list, and citation.
- [ ] Large source files are represented by file manifests and source URLs unless intentionally mirrored.
- [ ] Small-to-medium mirrored demo artifacts persist in Docker storage when useful for local demo reliability.
- [ ] Sync state records source identifier, source URL, DSpace item ID, last sync status, and source freshness.
- [ ] Startup sync creates or updates required seed repository objects after Docker startup.
- [ ] DSpace community and collection exist for Census public research data.
- [ ] The item is available through DSpace REST.
- [ ] The item is discoverable through Solr-backed search.
- [ ] No large public-use dataset files are checked into git.

## API Contract

- [ ] Search, dataset detail, versions, map layers, USGS earthquake overlay, and accessibility evidence endpoints are described in OpenAPI.
- [ ] Frontend TypeScript DTOs are generated from OpenAPI.
- [ ] Java DTOs are generated from OpenAPI or mechanically verified against it.
- [ ] `pnpm run openapi:check` fails when generated frontend types drift.
- [ ] API errors use typed error responses.

## Backend

- [ ] `apps/repository-api` runs locally through an Nx target.
- [ ] Java API targets Java 21.
- [ ] API endpoints return typed responses for the first dataset.
- [ ] Request validation rejects invalid pagination, IDs, date ranges, enum values, and URL inputs.
- [ ] Unit tests cover controller validation and service mapping.
- [ ] Backend configuration separates local DSpace, Solr, and USGS endpoints from code.

## Frontend

- [ ] Search page supports keyword search, facets, loading, empty, and error states.
- [ ] Search state is represented in URL parameters where practical.
- [ ] Dataset detail page shows metadata, files, versions, citation, and map tab when geospatial metadata exists.
- [ ] Admin workflow exposes manual sync controls and sync status.
- [ ] Accessibility evidence view summarizes automated and manual evidence.
- [ ] Angular API imports use generated OpenAPI types.
- [ ] NgRx effects own API calls and cancellation for search, dataset detail, map overlays, and evidence.
- [ ] Components do not hand-author duplicate DTOs.

## Mapping

- [ ] Map tab renders a MapLibre GL Census geography or sample layer for the selected dataset.
- [ ] USGS earthquake overlay can be toggled.
- [ ] Map includes legend, attribution, visible update timestamp, and clear error/stale states.
- [ ] Mapped information is also available as an accessible table or feature list.
- [ ] Layer controls are keyboard reachable and have accessible names.

## Accessibility Evidence

- [ ] `pnpm run wcag:report` produces a console report.
- [ ] `pnpm run section508:report` produces a console report.
- [ ] Angular evidence view displays the latest accessibility evidence status.
- [ ] Automated scans cover search, dataset detail, and map workflows.
- [ ] Keyboard tests cover search filters, result navigation, dataset tabs, and map layer controls.
- [ ] Manual checklists exist for keyboard, NVDA, JAWS where available, and map equivalence.
- [ ] Known accessibility limitations are documented.

## Demo Readiness

- [ ] `pnpm run start:all` starts the development experience.
- [ ] Docker Compose starts persistent local services and the app can be demoed after restart.
- [ ] `pnpm run test:all` passes.
- [ ] `pnpm run quality:all` passes.
- [ ] Demo script explains the architecture, dataset flow, map overlay, and accessibility evidence.
