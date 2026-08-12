# Risks

## DSpace Docker Complexity

Risk: DSpace, Solr, PostgreSQL, initialization, and indexing can take more time than the Angular/API prototype.

Mitigation: start from DSpace-supported Docker examples, keep local overrides small, and seed one dataset first.

## Java Tooling Gap

Risk: OpenJDK 17 is installed locally, but Maven is not installed.

Mitigation: choose a wrapper-based strategy. Prefer Maven wrapper or Gradle wrapper so agents and CI do not depend on a global install.

## Java Version Choice

Risk: Spring Boot direction and federal runtime availability may not align on the same Java version.

Mitigation: decide Java 17 vs 21 before generating the backend. Use Java 21 unless deployment constraints require Java 17.

## OpenAPI Drift

Risk: frontend types, backend DTOs, and controllers can diverge as implementation speeds up.

Mitigation: keep OpenAPI as the source of truth, keep `openapi:check` in `quality:all`, and add Java DTO generation to the same quality gate once backend exists.

## Angular 22 and NgRx RC

Risk: NgRx 22 is currently an RC line selected for Angular 22 compatibility.

Mitigation: keep NgRx usage conventional, avoid experimental APIs unless needed, and upgrade to stable NgRx 22 when available.

## Map Accessibility

Risk: interactive maps can pass axe checks while still being inaccessible.

Mitigation: require feature-list/table equivalence, keyboard-operable controls, source attribution, non-color-only legends, and manual screen-reader review.

## Public Data Size and Rate Limits

Risk: Census and USGS data can be large or subject to service limits.

Mitigation: ingest metadata and source links first, use small fixtures for local development, and avoid committing large datasets.

## DSpace/Solr Schema Coupling

Risk: discovery fields may require DSpace/Solr configuration work beyond simple item creation.

Mitigation: define only the first slice fields initially and document each Solr field/configuration change.

## Nx Migration Warnings

Risk: existing Nx warnings about inferred targets and Analog/Vitest configuration can become CI failures during upgrades.

Mitigation: address these warnings before broad feature work and keep commands routed through `pnpm nx`.

## Unauthenticated Admin Sync Endpoint

Risk: `POST /api/admin/sync` performs real DSpace writes in `APPLY` mode and has no authentication. CORS restricts browser origins but does not stop direct clients.

Mitigation: accepted for the localhost-only demo and recorded in DECISIONS.md ("Admin API Authentication"). Add Spring Security and a recorded requesting principal before the stack runs anywhere shared, and raise it explicitly during the demo walkthrough rather than waiting to be asked.

## Sync Job Store Coverage Gap

Risk: `JdbcSyncJobStore` uses PostgreSQL-native `insert ... on conflict do update`, which H2 cannot parse, so the store's SQL has no automated coverage. A typo in that statement surfaces only when the Compose stack runs.

Mitigation: cover it with Testcontainers against real PostgreSQL. That requires the `repository-api:test` target to move off `docker build`, which cannot host a Docker daemon. Until then, treat changes to that SQL as requiring a manual `pnpm run sync:apply` check.

## Dependency Vulnerabilities

Risk: GitHub reported moderate Dependabot findings after initial dependency push.

Mitigation: review Dependabot alerts before production-style demo delivery, update safe packages, and document accepted temporary risk if any package cannot be upgraded immediately.
