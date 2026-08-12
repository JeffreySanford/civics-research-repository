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

Reason: Java is a stronger fit for likely federal delivery environments and DSpace/Solr/PostgreSQL integration. NestJS remains a fallback for rapid prototypes only.

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

Reason: the project's stated principle is that DSpace is the system of record and Solr is a projection of it. Today the `discovery` Solr core is indexed from `SearchService.seedResults()` and dataset detail is served from compile-time constants, so the sync path writes to DSpace while nothing reads from it. The demo therefore shows repository synchronization and repository discovery as two disconnected halves. Until this is closed, the architecture is aspirational rather than demonstrated, and that is the single largest gap between what the documentation claims and what runs.

Consequence: `SearchIndexStartupRunner` projects DSpace items into the `discovery` core instead of the seed list; `DatasetService` reads from DSpace; the seed list survives only as an explicit fallback. This is the current top priority, ahead of additional source adapters and additional UI breadth.

### Datastore Roles and Naming

Decision: the application database is renamed from `dspace` to `civics_ops`, and the custom Solr core is documented explicitly as the public discovery projection — rebuildable from DSpace at any time, never a source of truth.

Reason: the stack runs two PostgreSQL databases and two Solr instances. Both databases are currently named `dspace`, which makes an already subtle split unreadable and invites the assumption that the application is writing into DSpace's own schema. Either architecture — a separate projection core, or querying DSpace discovery directly — is defendable. The ambiguity is not.

Consequence: `POSTGRES_DB`, `SPRING_DATASOURCE_URL`, and the `.env` files change together, and the change requires `docker compose down --volumes` or a manual database rename because the existing volume holds the old name. Not yet applied.

Alternative considered: drop the custom Solr core and query DSpace discovery directly. Rejected for now — the projection lets the public search surface be shaped and tuned independently of DSpace's internal index, which is the more realistic federal pattern. It stays a reasonable simplification if the projection becomes a maintenance burden.

### One-Command Demo Environment

Decision: add `pnpm run demo:up`, which starts the full stack including the DSpace profile, waits for health, seeds, and synchronizes — a single command that ends with a demonstrable system.

Reason: `start:all` deliberately excludes the DSpace profile so routine development does not pay DSpace startup cost, which is the right default for development and the wrong one for a demonstration. Assembling the demo currently takes several commands in the correct order, which is exactly the situation where a live demo fails.

Consequence: `start:all` keeps its current fast-path behavior. `demo:up` composes DSpace startup, `wait-dspace-ready`, `dspace-seed`, sync, and the application services, and reports the URLs to open. Not yet implemented.

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

Options:

- `@nxrocks/nx-spring-boot`
- `@jnxplus/nx-maven`
- `@jnxplus/nx-gradle`
- `@nx/gradle`

Recommendation: choose after confirming the backend build tool. The key requirement is that build, test, serve, OpenAPI generation, and quality tasks run through Nx targets.

### OpenAPI to Java DTO Tooling

Options:

- OpenAPI Generator Maven/Gradle plugin.
- Springdoc/OpenAPI controller annotation flow with generated DTOs.

Recommendation: generate DTOs from OpenAPI rather than generating OpenAPI from controllers. This is the last open contract gate — Java records are currently hand-written against the schema, and only the frontend side of the contract has a drift check.
