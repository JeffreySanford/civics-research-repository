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

## Dependency Vulnerabilities

Risk: GitHub reported moderate Dependabot findings after initial dependency push.

Mitigation: review Dependabot alerts before production-style demo delivery, update safe packages, and document accepted temporary risk if any package cannot be upgraded immediately.
