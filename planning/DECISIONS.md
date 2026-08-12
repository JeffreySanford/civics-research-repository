# Decisions

## Accepted

### Product Name

Decision: use `civics-research-repository`.

Reason: describes a public-sector research repository without overfitting to one agency name.

### Repository Pattern

Decision: treat DSpace as the repository system of record and Solr as discovery/search infrastructure.

Reason: keeps repository metadata, files, versions, and relationships separate from search indexing.

### Frontend

Decision: use Nx, Angular 22, Angular Material 22, NgRx, RxJS, Playwright, and axe-core.

Reason: matches the requested frontend architecture and supports typed, accessible, maintainable public workflows.

### Accessibility Standard

Decision: target Section 508 baseline and WCAG 2.1/2.2 AA practices where practical.

Reason: Section 508 is the federal baseline; newer WCAG practices reduce future remediation risk.

### Backend Direction

Decision: prefer Java/Spring Boot for the backend API.

Reason: Java is a stronger fit for likely federal delivery environments and DSpace/Solr/PostgreSQL integration.

NestJS was considered early and is now explicitly rejected, not held as a fallback. A standby second backend costs dual maintenance, splits attention, duplicates setup scripts, and invites divergence in exactly the layer the OpenAPI contract exists to keep singular. Nothing was ever scaffolded, so this is a decision to keep it that way. If a mock backend is wanted for frontend work, generate one from `schemas/openapi/repository-api.yaml` with standard OpenAPI tooling such as Prism — that stays contract-driven by construction and disappears when it is no longer needed.

### Java Runtime Target

Decision: target Java 21 for this reference implementation.

Reason: Java 21 is a strong current baseline for a new service. The likely target environment may run older Java, but this project should use the cleaner current baseline unless a deployment constraint appears.

### API Contract

Decision: OpenAPI is the source of truth for application API contracts.

Reason: generated frontend types and later generated Java DTOs prevent frontend/backend drift.

### Frontend State

Decision: use NgRx and RxJS for API-backed search, dataset, map, evidence, and ingestion state. Use Signals only for local derived UI state where appropriate.

Reason: repository discovery workflows need typed async streams, cancellation, shared selectors, and predictable failure handling.

### Data Sync Ownership

Decision: the Java API should own sync orchestration and sync state, with script entry points available for repeatable local and CI/demo execution.

Reason: sync status, admin-triggered sync, startup sync, and repository write behavior belong close to the typed backend and DSpace integration.

### Sync Triggers

Decision: support automatic sync at Docker app startup, manual sync from an admin UI button, and a script/CLI command.

Reason: startup sync makes the local demo self-healing, while admin and script triggers make the workflow visible and repeatable.

### Docker Storage

Decision: use Docker persistent volumes for DSpace, PostgreSQL, Solr, and small-to-medium mirrored demo artifacts.

Reason: the local demo should survive restarts and show realistic repository persistence without committing generated data or large public datasets to git.

### First Dataset Emphasis

Decision: prioritize a visual geospatial first slice using TIGER/Line or LODES with USGS overlays, while keeping ACS PUMS as a metadata-rich repository example.

Reason: the mapping visualization is a major demo feature and should be visible early.

### Map Library

Decision: use MapLibre GL first.

Reason: MapLibre is stronger for modern geospatial visualization, vector tiles, and layered map experiences. Leaflet can be evaluated later behind a map adapter if there is a concrete demo value, but shipping both engines initially would add test and accessibility surface area without improving the first vertical slice.

### Admin Workflow

Decision: include an admin workflow prototype with manual sync controls, sync status, and submission/review concepts.

Reason: it demonstrates enterprise workflow thinking and supports manual data synchronization from the UI.

### Accessibility Evidence UI

Decision: provide both console accessibility reports and an Angular evidence view.

Reason: scripts are useful for engineering gates; a UI evidence view makes WCAG/Section 508 status understandable in the demo.

### Container Priority

Decision: prioritize a local Docker demo over cloud deployment.

Reason: the most useful demo artifact is a repeatable local container stack. AWS documentation should bias toward containerized modernization, with EKS as the likely future direction and ECS mentioned only as context.

### Repository-Backed Discovery

Decision: DSpace metadata becomes the primary runtime source for discovery and dataset detail. The in-memory seed list and the hard-coded `DatasetService` fixtures are demoted to a fallback used for tests and demo recovery only, and any fallback response must be identifiable as such.

Reason: the project's stated principle is that DSpace is the system of record and Solr is a projection of it. Before this change the `discovery` Solr core was indexed from `SearchService.seedResults()` and dataset detail came from compile-time constants, so the sync path wrote to DSpace while nothing read from it. The demo showed repository synchronization and repository discovery as two disconnected halves, which made the architecture aspirational rather than demonstrated.

Consequence: applied. `DiscoveryProjectionService` is the sole writer of the `discovery` core and builds it from DSpace items; `RepositoryCatalog` and `RepositoryObjectMapper` serve search, dataset detail, and related research from the repository; the fixture catalog survives only as an explicit fallback. Every response carries `resultSource` / `source`, and the UI renders a placeholder-data notice when the value is `FIXTURE`. `pnpm run reindex` rebuilds the projection on demand.

### Datastore Roles and Naming

Decision: the application database is renamed from `dspace` to `civics_ops`, and the custom Solr core is documented explicitly as the public discovery projection — rebuildable from DSpace at any time, never a source of truth.

Reason: the stack runs two PostgreSQL databases and two Solr instances. Both databases are currently named `dspace`, which makes an already subtle split unreadable and invites the assumption that the application is writing into DSpace's own schema. Either architecture — a separate projection core, or querying DSpace discovery directly — is defendable. The ambiguity is not.

Consequence: applied. The application database is `civics_ops` and its role is `civics`, both configurable through `CIVICS_DB_NAME`, `CIVICS_DB_USER`, and `CIVICS_DB_PASSWORD`. The change required recreating the `postgres-data` volume, which was safe because it holds only `sync_jobs` and that table is recreated at startup. The Solr core is documented in `docker-compose.yml` as the rebuildable public discovery projection.

Alternative considered: drop the custom Solr core and query DSpace discovery directly. Rejected for now — the projection lets the public search surface be shaped and tuned independently of DSpace's internal index, which is the more realistic federal pattern. It stays a reasonable simplification if the projection becomes a maintenance burden.

### One-Command Demo Environment

Decision: add `pnpm run demo:up`, which starts the full stack including the DSpace profile, waits for health, seeds, and synchronizes — a single command that ends with a demonstrable system.

Reason: `start:all` deliberately excludes the DSpace profile so routine development does not pay DSpace startup cost, which is the right default for development and the wrong one for a demonstration. Assembling the demo currently takes several commands in the correct order, which is exactly the situation where a live demo fails.

Consequence: applied. `pnpm run demo:up` starts DSpace, waits for REST, seeds, starts the application stack, rebuilds the discovery projection, waits for the UI, and prints the URLs worth showing. Order matters: seeding must precede the API so startup sync does not run against an empty repository. `demo:down` stops everything and keeps data. `start:all` keeps its fast-path behavior and still excludes DSpace. Verified from a cold `docker:reset:everything` and on a warm restart.

### Startup Sync Applies Live Data

Decision: startup sync defaults to `APPLY` against a live DSpace, and is skipped entirely when DSpace is unreachable. `DRY_RUN` is retained as an explicit CLI and admin-UI mode, not as the automatic default.

Reason: the project is far enough along that the automatic path should do real, persisted repository work. A dry run that executes when nobody asked for it produced a log full of `UPSERT_*` actions planned against a DSpace that was not running in the default Compose profile, which reads as success. Apply is idempotent, so applying at every boot is cheap and the second run writes nothing.

Consequence: the demo's default behavior is now live repository reconciliation whose effects persist in the DSpace volumes. Planning-only behavior is still one environment variable away (`CIVICS_SYNC_MODE=DRY_RUN`).

### Unavailability Is Not Absence

Decision: an unreachable DSpace produces an explicit failure naming the endpoint and the command that starts it. It is never reported as "the item does not exist".

Reason: the read path previously collapsed every failure into an empty result, so `sync:diff` reported `CREATE_ITEM` for an item it had never successfully looked for. A confident wrong answer is worse than an error, particularly on a path whose whole purpose is to describe repository state.

Consequence: `DIFF` and `APPLY` both return a `FAILED` job carrying the reason, surfaced through the normal typed response so the admin UI shows it rather than an HTTP 500.

### Multi-Select Program Facet With Defaults

Decision: `program` is a repeatable query parameter. Discovery selects TIGER/Line, LODES, and ACS PUMS by default and sends them explicitly rather than relying on an omitted parameter.

Reason: the repository now holds fourteen programs, and a single-select facet forced a choice between showing everything (burying the geospatial demo story) and showing one program at a time (hiding the breadth). Defaults sent explicitly keep the facet honest: an absent parameter means every program, so the UI must state what it is actually applying rather than let omission imply it.

Consequence: each filter is excluded from its own facet, in Solr through tagged filter queries (`{!tag=...}` / `{!ex=...}`) and in the in-memory path by computing program counts before applying the program filter. Without that, selecting programs collapses the facet to the selection and there is no way to add a fourth — the selection becomes a one-way door. `ResearchProgram` is also the single list the frontend parses against, derived from the contract rather than hand-maintained, because an allowlist that silently drops unknown values makes a newly added program unselectable while quietly restoring the defaults.

### Admin API Authentication

Decision: leave `POST /api/admin/sync` unauthenticated for the local Docker demo, and treat authentication as a prerequisite for any shared or deployed environment.

Reason: the endpoint triggers real DSpace writes in `APPLY` mode, so this is a deliberate tradeoff rather than an oversight. It is acceptable locally because the stack binds to localhost, holds only public federal data, and is reset with `docker compose down --volumes`. The CORS policy in `WebConfig` restricts browser origins only — it is not an access control, and direct clients such as `curl` bypass it entirely, as the `sync:api:apply` script demonstrates.

Consequence: before this runs anywhere other than a developer machine, the admin routes need an authenticated and authorized caller. The likely federal-aligned direction is Spring Security with the repository's existing DSpace administrator identity, or an agency SSO/OIDC provider, plus an audit record of who triggered each sync job. `SyncJob` already records mode, source, and timing; it would gain the requesting principal.

### DSpace Credential Handling

Decision: supply DSpace administrator credentials through environment variables (`.env`, based on the committed `.env.sample`), never as defaults compiled into the application.

Reason: credentials baked into `@Value` defaults ship inside the container image and are easy to promote accidentally beyond local use. Blank credentials now disable DSpace writes rather than failing the sync job, so a misconfigured environment degrades to diff-only instead of authenticating as a built-in identity.

### Demo Priority

Decision: optimize for a working local Docker demo first, then polished Angular screens, then supporting documentation.

Reason: the strongest demo is something that runs locally, looks credible, and has documentation explaining the architecture.

### Java Build Tool

Decision: Gradle, run inside the `gradle:9.6-jdk21` container image rather than through a local wrapper.

Reason: no local Maven or Gradle install is required, the toolchain is pinned by image tag, and the Docker build already owns compilation. Dependency resolution runs in its own image layer so source changes do not re-download the graph.

### DSpace Docker Baseline

Decision: use the official `dspace/dspace:dspace-9.0` images — REST, `dspace-postgres-pgcrypto`, and `dspace-solr` — behind an optional `dspace` Compose profile, with project-local overrides kept minimal.

Reason: staying on DSpace-supported images keeps migration, seeding, and Solr core layout working the way DSpace documents them. The profile keeps DSpace startup cost off the routine development path.

## Pending

### Nx Java Integration

Options, Gradle-oriented only, since the build tool is settled:

- `@nx/gradle`
- `@jnxplus/nx-gradle`
- `@nxrocks/nx-spring-boot`

Recommendation: no plugin for now. Java tasks run through `nx:run-commands` targets that shell out to Docker, which already gives agents, local CLI, and CI one path. Adopt a plugin only if project-graph awareness of Java sources becomes worth the dependency, and only if it works against a containerized build rather than a host toolchain.

### OpenAPI to Java DTO Tooling

Options:

- OpenAPI Generator Gradle plugin (`org.openapi.generator`), generating DTOs and API interfaces from the contract.
- Springdoc annotation flow, generating the contract from controllers.

Recommendation: the OpenAPI Generator **Gradle** plugin, wired into the `compile` task graph so that editing `schemas/openapi/repository-api.yaml` regenerates Java types before compilation and a contract violation fails the build rather than surfacing at runtime. Generating the contract from controllers is rejected: it inverts the contract-first rule and makes the frontend a downstream consumer of Java annotations.

This is the last open contract gate. Today only the frontend half is generated and drift-checked; Java records are hand-written against the schema, so the backend can silently diverge from the contract the frontend is built on.

Not yet implemented, and not a mechanical change — see planning/TODO.md under "Java DTO generation" for the migration path and the specific collisions to resolve first.
