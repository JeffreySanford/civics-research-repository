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

## Pending

### Java Build Tool

Options: Maven or Gradle.

Recommendation: Maven unless a chosen Nx plugin or generated backend baseline strongly favors Gradle.

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

Recommendation: generate DTOs from OpenAPI rather than generating OpenAPI from controllers.

### DSpace Docker Baseline

Options: official DSpace Docker Compose examples or a project-local Compose file derived from them.

Recommendation: start from DSpace-supported Docker patterns and keep local overrides minimal.
