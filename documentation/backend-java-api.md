# Backend Java API Direction

## Recommendation

Use Java with Spring Boot for the repository API. NestJS would be faster for initial prototyping, but Java is a better signal for the likely federal delivery environment and pairs naturally with DSpace, Solr, PostgreSQL, OpenAPI, validation, and long-lived service contracts.

Spring Boot 4.1.0 is current on the official Spring project page as of August 11, 2026. The local machine currently has OpenJDK 17 available, but Maven is not installed. Before generating the backend, decide whether to target Java 17, Java 21, or Java 25.

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

## Nx Integration Options

Candidate plugins:

- `@nxrocks/nx-spring-boot`: Spring Boot-oriented generator and targets.
- `@jnxplus/nx-maven`: Maven-oriented Java project integration.
- `@jnxplus/nx-gradle`: Gradle-oriented Java project integration.
- `@nx/gradle`: project graph integration when Gradle is used.

Recommendation: use Maven unless there is a strong reason to use Gradle. Maven is still common in federal Java projects, simpler to explain, and aligns well with generated OpenAPI/DTO workflows.

## MCP Direction

No Java/Spring MCP tool is currently exposed in this Codex session. Use MCP as documentation/context first:

- Java API contract context.
- OpenAPI schema lookup.
- DTO generation notes.
- Endpoint and evidence status.

Actual Java build/test/run should be represented as Nx targets so agents, local CLI, and CI all use the same path.
