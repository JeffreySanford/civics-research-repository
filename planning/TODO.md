# TODO

## Current Priorities

The ordered near-term plan. Everything here outranks new source adapters and new UI breadth. Rationale is in [ROADMAP.md](ROADMAP.md#near-term-order).

### P1 - Make DSpace drive one complete vertical slice

- [x] Project DSpace items into the Solr `discovery` core instead of `SearchService.seedResults()`.
- [x] Read dataset detail from DSpace instead of the hard-coded `DatasetService` fixtures.
- [x] Demote the in-memory seed list to an explicit fallback for tests and demo recovery.
- [x] Make a fallback response identifiable as fallback: `resultSource` / `source` in the contract, disclosed in the UI.
- [x] Add a reindex path that rebuilds the discovery core from DSpace on demand (`pnpm run reindex`).
- [x] Update the search and dataset detail tests to cover the repository-backed path and the fallback separately.
- [x] Seed LODES, ACS PUMS, and a second geography so facets exercise real repository data.
- [x] Compute related research from the repository instead of hard-coding it.
- [ ] Harvest live source metadata instead of static adapter constants.
- [x] Reconcile the file manifest as `crr.file.manifest` metadata so `sync:diff` reaches `SKIP_ITEM`.
- [x] Scope the diff to the fields synchronization owns, so DSpace bookkeeping metadata is not reported as drift.

### P2 - Disambiguate the two PostgreSQL and two Solr systems

- [x] Rename the application database from `dspace` to `civics_ops` (role `civics`) across `docker-compose.yml`, `.env`, and `.env.sample`.
- [x] Document the reset required for the rename, since the existing volume holds the old name.
- [x] Name the custom Solr core explicitly as the public discovery projection in configuration and documentation.
- [x] Document the four datastore roles in architecture documentation.

### P3 - Add a true one-command demo environment

- [x] Stop `start:all` from destroying a running DSpace stack; scope every stack command to the active Compose profile.
- [x] Add a Solr healthcheck and make the API wait for `service_healthy` instead of `service_started`.
- [x] Fix the `dspace-postgres` volume mount so the DSpace database actually persists.
- [x] Make the DSpace seed self-healing when its mapfile outlives the database.
- [x] Persist the corepack and Nx caches instead of re-downloading and resetting on every start.
- [x] Add `pnpm run demo:up`: DSpace profile, both PostgreSQL instances, both Solr instances, Java API, Angular, seed, sync, health checks.
- [x] Keep `start:all` as the fast development path that excludes DSpace.
- [x] Report the URLs to open when `demo:up` completes.
- [x] Add `pnpm run demo:down` and a documented reset path.
- [x] Verify `demo:up` from a cold `pnpm run docker:reset:everything`.

### P4 - Diagrams and AWS modernization

- [x] C4 context and container diagrams.
- [x] Ingestion, search, and map rendering sequence diagrams.
- [x] AWS modernization target, alternates, tradeoffs, and migration sequence.
- [ ] Terraform or CDK for the documented target.

### P5 - Manual accessibility evidence

- [x] Keyboard, NVDA, JAWS, map-equivalence, and cognitive checklists.
- [x] Automate every machine-checkable precondition: titles, heading outline, landmarks, tab order, accessible names, facet/tab/checkbox state, live regions, alerts, feature-list completeness (39 checks).
- [x] Record the automated baseline as dated evidence, stating plainly that no assistive technology was used.
- [ ] Run Checklist 4 manually, starting with M12 (map-to-list focus) — the highest-value open item.
- [ ] Run Checklist 1 end to end mouse-free.
- [ ] Run Checklist 2 with NVDA and record it.
- [ ] Run Checklist 3 with JAWS, or record N/A with the licensing reason.
- [ ] Decide the MapLibre canvas tab-stop question (finding 1 in the baseline).
- [ ] Decide whether a `contentinfo` landmark should exist (finding 2).

### P6 - Java DTO generation from OpenAPI

Closes the last contract gate. Decision recorded in DECISIONS.md ("OpenAPI to Java DTO Tooling"): the OpenAPI Generator **Gradle** plugin, wired into the compile task graph.

Not mechanical. The hand-written records carry behavior and fields the contract does not describe, and those collisions must be resolved first:

- [x] Add `org.openapi.generator` to `apps/repository-api/build.gradle.kts`, generating into `org.civicsrepo.generated.dto`. Output is POJOs, not records: the generator does not emit records for this generator/library combination.
- [x] Make `compileJava` depend on the generate task, so a contract change regenerates before compilation and a breaking change fails the build. Verified by renaming a field and watching it fail.
- [x] Migrate one endpoint end to end (`/maps/census-areas`) and confirm byte-identical JSON.
- [x] Drift is enforced by compilation rather than by a separate check: generation runs inside the build, so there is no window in which the Java side is stale. It therefore needs no `quality:all` entry of its own.
- [x] Migrate `MapLayer` and `UsgsEarthquake*`, the remaining pure wire types.
- [x] Decide the `SearchResponse` question: neither. The generated model is mutable and carries a fluent `resultSource` setter, and the response being relabelled was just built for that call, so `withResultSource` is gone with nothing to replace it.
- [x] Decide whether `RepositorySource` stays a domain enum in `org.civicsrepo.repository` or becomes the generated one: the generated one. It carried no behavior, only two constants the contract already defines.
- [x] Migrate `DatasetDetail`, `SearchResult`, and `SyncJob`, each of which is used as a domain type and not only as a wire type.
- [x] Delete the hand-written records once every consumer is migrated. No name in `org.civicsrepo.generated.dto` is still hand-written anywhere under `src/main/java`.
- [ ] Revisit generated controller interfaces once the generator supports Spring 7 conventions.

### P7 - Map and feature list selection synchronization

The remaining substantive accessibility gap, specified in documentation/mapping-visualization.md. axe cannot detect it, and manual Checklist 4 cannot honestly pass without it.

- [x] Add selected-feature state to the maps NgRx feature, with actions for selection from the list and from the map.
- [x] Make each feature-list entry a focusable control with a self-sufficient accessible name.
- [x] Focusing or activating a list entry pans the map to its coordinate and renders it selected, without stealing focus.
- [x] Activating a map feature moves programmatic focus to the matching list entry and sets its pressed state.
- [x] Announce the selected feature through a polite live region.
- [x] Clear selection when its layer is hidden; preserve it across unrelated layer toggles.
- [x] Reflect the selected feature in the URL alongside area and layer parameters.
- [x] Storyboard checks for the list-to-map direction, selection exclusivity, URL restore, clearing, and layer-hide clearing.
- [ ] Confirm the map-to-list direction manually. A WebGL hit test needs trusted pointer events, so it cannot be asserted automatically; Checklist 4 item M12 covers it.
- [ ] Re-run manual Checklist 4 afterwards and record the result.

### P10 - Map layer toggles and per-area layers

Reported from the running demo: turning a layer off removed it from the legend but the map kept
drawing it, and switching Census area moved the viewport while every state kept North Dakota's
layers.

- [x] Give the LODES layers a toggle; they were drawn permanently and had no control.
- [x] Include the earthquake selection ring in the earthquake visibility group, so hiding the
      overlay does not leave a highlight over an empty map.
- [x] Apply visibility once after LODES layers are added, since new layers default to visible.
- [x] Drive the layer list and legend from the same toggles the map reads, so the two cannot drift.
- [x] Resolve the geography from the dataset identifier in `MapLayerService`, which previously
      ignored its argument and always described North Dakota.
- [x] Reload the layer list whenever the selected area changes, and treat opening the map as a
      selection of the current area so a boundary load cannot overwrite a URL-supplied area.
- [x] Carry the geography on the dataset detail "Open map workspace" link.
- [x] Storyboard checks for per-toggle isolation, URL round-trip, area switching, and deep links.

### P8 - Repository breadth

Discovery reads from DSpace, which holds six seeded items, so search shows six datasets across three geographies. The previous fifty-two states came from the generated fixture catalog, which is now only a labelled fallback. This is correct behavior, and it makes the demo look thinner than it did.

- [x] Decide the target breadth: full 52-area parity, 159 items.
- [x] Generate SAF packages from `tools/dspace/catalog.json` rather than committing one directory per item. Generated packages are git-ignored; the table is the source of truth.
- [x] Name SAF directories by source identifier so `--resume` stays correct when the program mix changes.
- [x] Confirm paging and `civics.repository.max-items` hold at 159 items.
- [x] Cache repository reads briefly, invalidated on reindex: dataset detail went from 1.1s to 5ms.
- [x] Fix related research to require shared geography, since program alone produced alphabetical filler at 52 areas per program.
- [x] Add a multi-select program facet with TIGER/Line, LODES, and ACS selected by default. `program` is now a repeatable query parameter in the contract.
- [x] Exclude each filter from its own facet, so selecting programs does not hide the unselected ones and make the selection a one-way door.
- [x] Add eight programs: Economic Census, County Business Patterns, Building Permits, Population Estimates, SAIPE, Business Dynamics, USGS 3DEP, USGS 3HP. 167 repository objects across 14 programs.
- [ ] Replace the landing-page source URLs on the eight new programs with verified file-level URLs. They currently link the authoritative program page rather than a fabricated deep path.
- [ ] Add NOAA Climate Data Online and NASA POWER as cross-agency federation candidates.

### P9 - Security patch pass

Required before leaving PI 1, per the Dependency Upgrade Policy in RISKS.md.

- [x] Triage the reported advisories against resolved versions rather than raw audit output.
- [x] Verify every `pnpm.overrides` entry is still load-bearing by removing them and re-auditing.
- [x] Upgrade Angular tooling 22.1.1 to 22.1.3 and Analog 2.6.4 to 2.7.0.
- [x] Remove `@angular/animations` (deprecated upstream, unused) and the redundant direct `@angular-devkit/build-angular`.
- [x] Record the `image-size` accepted risk with its reasoning and revisit condition.
- [x] Check for stable NgRx 22: none exists yet, still `22.0.0-rc.0`.
- [ ] Move NgRx to stable 22 when it is published.
- [ ] Re-check the `image-size` advisory at the next dependency pass.
- [x] Fix the flaky Playwright web-server start between suites in `quality:all`. `e2e:reports` now runs all three tagged suites against one dev server, and the Windows launcher kills the process tree. Never reproduced on demand, so the fix rests on the mechanism rather than a red-to-green run; see RISKS.md.
- [x] ESLint 10, with `@eslint/js`. Applied 2026-08-12; `quality:all` passes unchanged.
- [ ] Separate upgrade task for the remaining available majors: jsdom 30, `@types/node` 26, `eslint-plugin-playwright` 2, Prettier 3.9.
- [ ] TypeScript stays at 6.0.3. `@angular/compiler-cli` declares `typescript >=6.0 <6.1` and `typescript-eslint` declares `<6.1.0`, so TypeScript 7 is blocked rather than deferred, and 6.0.3 is already the newest 6.0.x. Re-check the compiler-cli peer range at each Angular major.

## PI 0 - Repository Foundation

Goal: establish the project direction, documentation base, and working backlog.

### Sprint 0.1 - Naming and Repo Setup

- [x] Choose package name: Civics Research Repository.
- [x] Create documentation directory.
- [x] Create planning directory.
- [x] Create initial TODO backlog.
- [x] Capture high-level architecture direction.
- [x] Capture public data source candidates.
- [x] Capture public data storage and sync policy.
- [x] Capture mapping visualization and USGS overlay direction.
- [x] Capture Docker, DSpace, Solr, and PostgreSQL direction.
- [x] Create GitHub repository.
- [x] Push initial documentation scaffold.

### Sprint 0.2 - Architecture and Prototype Scope

- [x] Add Nx, Angular 22, Material Design, WCAG, and Section 508 workspace baseline.
- [x] Add project-specific `.agents` guidance.
- [x] Add MCP template notes for Nx and accessibility evidence.
- [x] Define first vertical slice acceptance criteria.
- [x] Add planning roadmap.
- [x] Add decision log.
- [x] Add risk register.
- [x] Create C4 context diagram.
- [x] Create container diagram for Angular, Java API, DSpace, Solr, and PostgreSQL.
- [x] Create sequence diagram for public dataset ingestion.
- [x] Create sequence diagram for search and faceted discovery.
- [x] Create sequence diagram for dataset map rendering.
- [x] Decide Angular map library: MapLibre GL first.
- [x] Confirm DSpace Docker baseline.

### Sprint 0.3 - Nx Workspace Generation

- [x] Install pnpm dependencies.
- [x] Verify Nx 23.1.1 local CLI.
- [x] Confirm Nx 23 Angular generator does not support `--dry-run`.
- [x] Generate Angular 22 `discovery-ui` app.
- [x] Generate Playwright e2e project.
- [x] Generate shared UI library.
- [x] Generate shared Material library.
- [x] Generate shared accessibility library.
- [x] Generate repository models and API client libraries.
- [x] Generate map visualization and USGS overlay libraries.
- [x] Generate Census and USGS data-source libraries.
- [x] Add first accessibility target using Playwright and axe-core.
- [x] Verify `pnpm nx show projects`.
- [x] Verify `pnpm nx run discovery-ui:build`.
- [x] Verify `pnpm nx run-many -t test --all`.
- [x] Verify `pnpm nx run-many -t lint --all`.
- [x] Verify `pnpm nx run discovery-ui-e2e:accessibility`.
- [ ] Review Nx 24 migration warnings for inferred ESLint and Vitest targets.
- [x] Resolve Analog/Vitest Angular `tsconfig.app.json` warning for non-buildable Angular libraries.

## PI 1 - Local Repository Platform

Goal: run the repository stack locally with a typed Java API, DSpace, PostgreSQL, Solr, and seed metadata.

### Sprint 1.0 - Java API Contract Foundation

- [x] Decide backend direction: Java 21 / Spring Boot, single backend. NestJS explicitly rejected, never scaffolded.
- [x] Add backend Java API documentation.
- [x] Add OpenAPI-first repository API contract.
- [x] Add OpenAPI-to-frontend type generation.
- [x] Add OpenAPI generated type drift check.
- [x] Add OpenAPI lint/check into `quality:all`.
- [x] Add Java API contract agent guidance.
- [x] Add Java API MCP template notes.
- [x] Add NgRx packages compatible with Angular 22.
- [x] Wire root NgRx Store, Effects, Router Store, and DevTools providers.
- [x] Generate Angular TypeScript API types from OpenAPI.
- [x] Choose Java runtime target: 21.
- [x] Choose Maven or Gradle: Gradle inside Docker.
- [x] Install/enable Maven wrapper or choose Gradle wrapper strategy: use Gradle container image for now.
- [x] Select Nx Java integration plugin: none for now; Gradle-oriented only if adopted later.
- [x] Select OpenAPI-to-Java DTO generation tool: OpenAPI Generator Gradle plugin.
- [x] Generate `apps/repository-api`.
- [x] Generate Java DTOs from OpenAPI. Done in P6; the remaining per-type migrations are tracked in that section.
- [x] Generate Angular TypeScript API client methods from OpenAPI.
- [x] Add typed NgRx feature state for search.
- [x] Add typed NgRx feature state for dataset detail.
- [x] Add typed NgRx feature state for map overlays.
- [ ] Add typed NgRx feature state for accessibility evidence.
- [x] Add typed NgRx feature state for admin sync.

### Sprint 1.1 - Docker Platform

- [x] Add Docker Compose file.
- [x] Add persistent Docker volumes for API artifacts, PostgreSQL, Solr, pnpm store, and container `node_modules`.
- [x] Add PostgreSQL service for DSpace.
- [x] Add Solr service for discovery.
- [x] Add DSpace REST service.
- [x] Add Java API service.
- [x] Add Angular UI service.
- [x] Add local environment sample.
- [x] Document startup and reset commands.
- [x] Verify DSpace API is reachable locally.
- [x] Verify Solr is reachable locally.
- [x] Verify startup sync creates or updates the seed repository objects.
- [x] Index seed discovery objects into Solr on Java API startup.

### Sprint 1.2 - DSpace Seed Repository

- [x] Define DSpace community for Census public research data.
- [x] Define DSpace collection for the first visual geospatial source.
- [x] Create seed metadata for one TIGER/Line or LODES North Dakota item.
- [x] Attach source URLs and documentation URLs.
- [ ] Store small-to-medium mirrored demo artifacts where useful.
- [x] Confirm item appears through DSpace REST.
- [x] Confirm item is indexed into Solr discovery.

## PI 2 - Public Data Harvester

Goal: ingest public metadata from Census and USGS sources into repository-ready objects.

### Sprint 2.1 - Census Metadata Harvester

- [x] Decide harvester placement: Java API owns sync orchestration and sync state.
- [x] Define initial sync state model for sync job, source, status, timestamps, and actions.
- [x] Implement TIGER/Line or LODES metadata source adapter for first visual slice.
- [x] Add startup sync path.
- [x] Add admin UI-triggered sync endpoint.
- [x] Add script/CLI sync entry point.
- [x] Normalize title, program, vintage, geography, file format, source URL, and citation fields.
- [x] Generate DSpace-ready item payload.
- [x] Add dry-run mode.
- [x] Add diff mode to compare source metadata with DSpace item state.
- [x] Add logging and error handling.
- [x] Add unit tests for metadata normalization.
- [x] Guard DSpace item resolution so apply cannot write to a relevance-ranked sibling item.
- [x] Make DSpace metadata comparison order-insensitive so apply stays idempotent.
- [x] Move DSpace admin credentials out of compiled defaults into `.env`.
- [ ] Cover `JdbcSyncJobStore` SQL with Testcontainers once the Java test target moves off `docker build`.

### Sprint 2.2 - Additional Census Sources

- [ ] Add SIPP metadata adapter.
- [ ] Add CPS metadata adapter.
- [ ] Add LODES metadata adapter.
- [ ] Add TIGER/Line metadata adapter.
- [ ] Add source-specific documentation links.
- [ ] Add source freshness notes.

### Sprint 2.3 - USGS Overlay Sources

- [ ] Add USGS earthquake feed adapter.
- [x] Evaluate USGS National Map layer options.
- [x] Document overlay attribution requirements.
- [x] Normalize USGS overlay metadata.
- [x] Add sample overlay fixture for local map development.

### Sprint 2.4 - Optional Cross-Agency Federation

- [ ] Evaluate NOAA Climate Data Online as a later federation source.
- [ ] Evaluate NASA POWER as a later federation source.
- [ ] Confirm metadata model extensions needed for non-Census science datasets.
- [ ] Keep optional sources out of the first vertical slice unless the Census/USGS path is already working.

## PI 3 - Angular Discovery UI

Goal: build an accessible Angular UI for search, facets, dataset details, versions, citations, and typed async data flows.

### Sprint 3.1 - Search and Facets

- [x] Scaffold Angular discovery application.
- [x] Replace starter shell with routed app navigation.
- [x] Define repository API client methods from generated OpenAPI types.
- [x] Build search page.
- [x] Build result card/list component.
- [x] Build facet panel.
- [x] Add URL-driven search state.
- [x] Add loading, empty, and error states.
- [x] Add keyboard interaction tests.
- [x] Add Playwright storyboard checks for primary demo workflows.

### Sprint 3.2 - Dataset Details

- [x] Build dataset detail route.
- [x] Build metadata summary.
- [x] Build file/download section.
- [x] Build citation section.
- [x] Build versions tab.
- [x] Build related research section.
- [x] Add accessible tab behavior.

### Sprint 3.3 - Admin Sync Workflow

- [x] Build admin route.
- [x] Add sync status summary.
- [x] Add manual dry-run sync button.
- [x] Add manual apply sync button.
- [x] Show create, update, skip, and failure results.
- [x] Add typed NgRx state for sync jobs.

## PI 4 - Mapping and USGS Overlays

Goal: deliver the visual map demo mentioned in the role context, with USGS overlays and accessible fallback data.

### Sprint 4.1 - Map Foundation

- [x] Select MapLibre GL first.
- [x] Build MapLibre GL map shell component.
- [x] Add dataset-driven layer loading.
- [x] Add layer toggle controls.
- [x] Add source attribution display.
- [x] Add accessible feature list.
- [x] Add non-color-only legend.

### Sprint 4.2 - Census Geospatial Layers

- [x] Add TIGER/Line boundary preview.
- [x] Add LODES sample layer or fixture.
- [x] Add geography filter integration.
- [x] Add dataset detail map tab.
- [x] Add map state to URL where practical.

### Sprint 4.3 - USGS Overlay Integration

- [x] Add USGS earthquake overlay.
- [x] Add overlay filter by time range or magnitude.
- [x] Add visible source and update timestamp.
- [x] Add accessible event list synchronized with map data.
- [x] Add overlay error and stale-data states.

## PI 5 - Section 508 and WCAG Evidence

Goal: make accessibility evidence visible, repeatable, and tied to release workflows.

### Sprint 5.1 - Automated Checks

- [x] Add Spring context and MockMvc controller coverage for the Java API.
- [x] Add NgRx effect coverage for search, datasets, maps, and sync.
- [x] Add repository API failure-state storyboard checks.

- [x] Add axe-core integration.
- [x] Add Playwright accessibility smoke tests.
- [x] Add WCAG console report script.
- [x] Add Section 508 console report script.
- [x] Expand automated scans to search route.
- [x] Expand automated scans to dataset detail route.
- [x] Expand automated scans to map route or map tab.
- [x] Add keyboard navigation tests for search.
- [x] Add keyboard navigation tests for dataset detail tabs.
- [x] Add keyboard navigation tests for map layer controls.
- [x] Add storyboard checks across discovery, map, admin sync, and evidence routes.
- [ ] Add dialog focus tests if dialogs are introduced.
- [x] Add responsive reflow checks.
- [x] Add color contrast verification.

### Sprint 5.2 - Manual Evidence

- [x] Build accessibility evidence UI route.
- [x] Create manual keyboard test checklist.
- [x] Create NVDA smoke-test checklist.
- [x] Create JAWS smoke-test checklist.
- [x] Create map accessibility checklist.
- [x] Create cognitive and workflow review checklist.
- [x] Create the evidence recording template and folder structure.
- [x] Document known limitations.
- [ ] Execute and record the first keyboard-only run.
- [ ] Execute and record the first NVDA run.
- [ ] Execute and record a JAWS run, or record N/A with the licensing reason.
- [ ] Execute and record the first map-equivalence run.
- [ ] Add forced-colors and high-contrast mode smoke tests.

## PI 6 - AWS Modernization Documentation

Goal: describe a credible container-first modernization path without requiring paid cloud deployment for the demo.

### Sprint 6.1 - AWS Architecture

- [x] Document Docker-first local architecture.
- [x] Document EKS/Kubernetes modernization option.
- [x] Document ECS/Fargate only as an alternate container deployment option.
- [x] Document RDS PostgreSQL option.
- [x] Document Solr persistence and operational tradeoffs.
- [x] Document CloudFront/static frontend option.
- [x] Document logging, monitoring, and backup considerations.
- [x] Document the migration sequence and what the demo deliberately omits.
- [ ] Add Terraform or CDK for the documented target.

### Sprint 6.2 - Interview Demo Package

- [ ] Create demo script.
- [ ] Create architecture walkthrough.
- [ ] Create dataset ingestion walkthrough.
- [ ] Create accessibility evidence walkthrough.
- [ ] Create mapping/USGS overlay walkthrough.
- [ ] Create known tradeoffs and next steps document.
