# Java API and Contract Guidance

## Backend Decision

Use Java 21 with Spring Boot for the backend API, built with Gradle inside the container image. This is the only backend: do not introduce NestJS, a Node backend, or a Maven build path. If a mock API is needed for frontend work, generate it from `schemas/openapi/repository-api.yaml` with OpenAPI tooling such as Prism rather than standing up a second application.

## Contract Rules

- OpenAPI schemas come before controller code.
- Java DTOs must be generated or manually kept in sync with OpenAPI.
- Angular TypeScript API types must be generated from the same OpenAPI contract.
- Frontend DTO/type imports must come from `libs/repository/api-client/src/generated/repository-api.types.ts`.
- Run `pnpm run openapi:generate` after contract edits and `pnpm run openapi:check` before committing.
- Do not use `any`, raw maps, or loose JSON passthroughs for application-owned data.
- External metadata can be modeled as unknown only at integration boundaries.

## Java API Standards

- Use immutable DTOs where practical.
- Use Bean Validation annotations on request DTOs.
- Use explicit enums for domain values.
- Use typed error responses.
- Keep controllers thin.
- Put DSpace, Solr, Census, and USGS integration logic behind service interfaces.
- Add tests for controller validation, service mapping, and integration adapters.

## Angular Data Flow Standards

- Components dispatch NgRx actions and read selectors.
- Effects own HTTP calls, retries, cancellation, and failures.
- Services should be typed API clients, not state stores.
- Use RxJS streams for async repository/search/map workflows.
- Use Signals for local derived UI state where they simplify rendering.
- Do not duplicate source-of-truth state between service subjects and NgRx.

## Initial State Domains

- Search query, filters, sort, pagination, and results.
- Dataset detail, versions, files, and citation.
- Map layers, selected feature, visible overlays, and feature-list summary.
- Accessibility evidence summaries.
- Ingestion jobs and progress once backend ingestion exists.
