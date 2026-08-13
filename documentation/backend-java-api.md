# Backend Java API Direction

## Decision

Java 21 with Spring Boot for the repository API, built with **Gradle inside the `gradle:9.6-jdk21` container image**. This is the single backend. There is no secondary Node backend and no Maven path.

Spring Boot 4.1.0 is current as of August 2026 and is what `apps/repository-api` runs.

### Why Gradle in a container, not Maven and not a wrapper

The original recommendation in this document was Maven, on the reasoning that it is more common in federal Java projects. That was superseded: the build runs entirely inside Docker, so the argument that decided it was reproducibility, not familiarity.

- No local Java, Maven, or Gradle install is required. The toolchain is pinned by image tag, so every developer and every CI runner compiles with the identical JDK and build tool.
- A wrapper (`mvnw` or `gradlew`) solves a different problem — bootstrapping a build tool onto a host that lacks one. That problem does not exist here, because the host never builds. Adding a wrapper would introduce a second, unpinned path to the same artifacts.
- Dependency resolution runs in its own image layer, so editing Java source does not re-download the dependency graph.

Familiarity is a real consideration for a federal delivery team, and Maven would win on that alone. It loses here because the container already provides the reproducibility that argument is usually reaching for. If a target environment ever mandates Maven, the migration is mechanical: the dependency set is small and the Dockerfile is the only place the build tool is named.

## Backend Scope

The API should not duplicate DSpace. It should act as a typed backend-for-frontend and integration layer:

- Normalize DSpace REST responses for Angular.
- Provide search endpoints backed by DSpace/Solr discovery.
- Aggregate dataset detail, files, versions, citations, and relationships.
- Expose USGS overlay metadata and map-ready summaries.
- Expose accessibility evidence summaries.
- Own ingestion orchestration and dry-run reporting.

## Contract-First Rule

Every endpoint starts with OpenAPI schemas before controller code:

```text
OpenAPI schema
  -> Java DTO/request/response classes
  -> validation annotations
  -> service interfaces
  -> controller implementation
  -> Angular TypeScript client/types
  -> NgRx actions/effects/selectors
```

Do not add untyped maps, raw JSON passthroughs, implicit `any`, or loosely shaped DTOs unless the value is explicitly modeled as unknown external metadata and isolated.

## OpenAPI to Frontend Type Flow

The Angular frontend must not hand-author API DTOs. Frontend API request/response types are generated from `schemas/openapi/repository-api.yaml` into:

```text
libs/repository/api-client/src/generated/repository-api.types.ts
```

Use:

```bash
pnpm run openapi:generate
pnpm run openapi:check
```

`openapi:check` regenerates the frontend types and fails if git detects drift in the generated file. `quality:all` includes this check so schema/frontend drift blocks the quality gate.

## OpenAPI to Java DTO Flow

Java DTOs are generated from the same contract, by the OpenAPI Generator Gradle plugin:

```text
schemas/openapi/repository-api.yaml
  -> openApiGenerate (Gradle)
  -> build/generated/openapi/src/main/java/org/civicsrepo/generated/dto
  -> compiled as part of the main source set
```

`compileJava` depends on `openApiGenerate`, so the contract is read on every build and the Java side cannot be stale. A breaking schema change fails compilation rather than surfacing at runtime — verified by renaming a field in the contract and watching the build fail on the code that used it.

Generated output lives under `build/` and is git-ignored. The contract is the committed source of truth; the DTOs are build output, exactly as on the frontend.

### Models only, deliberately

The `spring` generator can also emit controller interfaces. It writes them against Spring 6 conventions while this service runs Spring 7 on Boot 4, so adopting them is a separate change with its own failure modes. DTOs are where drift actually hurts, so that is what is generated. Swagger annotations are disabled: they would decorate types the contract already describes and would add a dependency purely for decoration.

### Migration status

**Complete for model DTOs.** Every wire type consumed by controllers and services is generated from the contract on every build. `/maps/census-areas` was migrated first as a clean proof of the wiring; `SearchResponse`, `SearchResult`, `DatasetDetail`, `SyncJob`, `MapLayer`, `UsgsEarthquake*`, and `RepositorySource` followed. Per-type decisions — for example removing `SearchResponse.withResultSource` rather than fighting the generator's mutable model — are recorded in [planning/TODO.md](../planning/TODO.md#p6---java-dto-generation-from-openapi).

Generated Spring controller interfaces remain deferred until the OpenAPI Generator supports Spring 7 conventions.

## Suggested Java Package Boundaries

```text
apps/repository-api/src/main/java/org/civicsrepo
├── RepositoryApiApplication.java
├── config
├── dataset
│   ├── DatasetController.java
│   ├── DatasetService.java
│   ├── dto
│   └── mapper
├── search
│   ├── SearchController.java
│   ├── SearchService.java
│   ├── dto
│   └── solr
├── maps
│   ├── MapLayerController.java
│   ├── UsgsOverlayService.java
│   ├── dto
│   └── mapper
├── evidence
│   ├── AccessibilityEvidenceController.java
│   ├── AccessibilityEvidenceService.java
│   └── dto
└── ingest
    ├── IngestionController.java
    ├── IngestionService.java
    ├── dto
    └── sources
```

## Runtime Design

- Angular uses `HttpClient` observables.
- NgRx Effects own HTTP calls and cancellation behavior.
- Java API can start with Spring MVC for simplicity.
- Use Spring WebFlux only if streaming, SSE, or high-concurrency async IO becomes an actual requirement.
- For long-running ingestion, return a job resource and stream progress later through polling or server-sent events.

## Validation

Required backend validation:

- Bean Validation on request DTOs.
- Enum types for content type, program, file format, evidence status, and layer type.
- Pagination bounds.
- Sort-field allowlists.
- Date/year range validation.
- Source URL validation.
- Explicit error response DTO.

## Security Posture

The API currently has no authentication. This is a deliberate local-demo tradeoff, not an oversight, and it is worth stating plainly during a walkthrough:

- `POST /api/admin/sync` triggers real DSpace writes in `APPLY` mode and accepts any caller.
- `WebConfig` restricts CORS to `http://localhost:4200`. CORS is a browser policy, not an access control: `curl` and any other non-browser client ignore it. The `sync:api:apply` script in `package.json` is itself an example of bypassing it.
- This is acceptable because the stack binds to localhost and holds only public federal data.

Before this runs in any shared or deployed environment:

- Put Spring Security in front of `/admin/**` with an authenticated, authorized caller — the DSpace administrator identity or an agency SSO/OIDC provider.
- Record the requesting principal on `SyncJob` alongside the existing mode, source, and timing fields, so sync history is an audit trail.
- Keep read endpoints (`/search`, `/datasets/**`, `/maps/**`, `/overlays/**`) public; they serve public data and are the demo's main surface.

See planning/DECISIONS.md ("Admin API Authentication") for the decision record.

## Credentials and Configuration

DSpace administrator credentials come from the environment, never from compiled-in defaults:

- `CIVICS_DSPACE_ADMIN_EMAIL` and `CIVICS_DSPACE_ADMIN_PASSWORD` are read by `DspaceRestClient`.
- Copy `.env.sample` to `.env` for local development. `.env` is git-ignored; `.env.sample` holds fictitious local-demo values and produces a working stack when copied as-is, because the DSpace seed job creates the administrator from the same variables.
- Blank credentials disable DSpace writes rather than failing the sync job, so a misconfigured environment degrades to diff-only.

## Testing Layers

- Unit tests cover metadata normalization, item resolution, diff planning, and Solr query construction.
- `@WebMvcTest` slices cover request mapping, parameter binding, validation, and status codes for each controller.
- `RepositoryApiApplicationContextTest` loads the real Spring context so bean wiring, `@Value` binding, and `@ConfigurationProperties` binding fail at `nx run repository-api:test` rather than at Compose startup. It runs against an H2 datasource with every outbound integration disabled.
- `JdbcSyncJobStore` is not covered: its `on conflict do update` upsert is PostgreSQL-specific and H2 cannot parse it. Covering it needs Testcontainers, which needs the test target to move off `docker build`. Tracked in planning/RISKS.md.

## Nx Integration Options

Java tasks currently run through `nx:run-commands` targets that shell out to `docker build` and `docker compose`, which keeps agents, local CLI, and CI on one path without a plugin.

If a plugin is adopted later, only the Gradle-oriented ones are candidates:

- `@nx/gradle`: project-graph integration when Gradle is used.
- `@jnxplus/nx-gradle`: Gradle-oriented Java project integration.
- `@nxrocks/nx-spring-boot`: Spring Boot generators and targets.

Maven-oriented plugins such as `@jnxplus/nx-maven` are out of scope. Any plugin must keep working with a containerized build; a plugin that assumes a host-installed toolchain would reintroduce exactly the drift the container removes.

## MCP Direction

No Java/Spring MCP tool is currently exposed in this Codex session. Use MCP as documentation/context first:

- Java API contract context.
- OpenAPI schema lookup.
- DTO generation notes.
- Endpoint and evidence status.

Actual Java build/test/run should be represented as Nx targets so agents, local CLI, and CI all use the same path.
