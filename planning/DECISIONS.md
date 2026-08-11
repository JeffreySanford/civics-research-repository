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

### API Contract

Decision: OpenAPI is the source of truth for application API contracts.

Reason: generated frontend types and later generated Java DTOs prevent frontend/backend drift.

### Frontend State

Decision: use NgRx and RxJS for API-backed search, dataset, map, evidence, and ingestion state. Use Signals only for local derived UI state where appropriate.

Reason: repository discovery workflows need typed async streams, cancellation, shared selectors, and predictable failure handling.

## Pending

### Java Runtime Target

Options: Java 17, Java 21, or Java 25.

Recommendation: Java 21 unless the target environment requires Java 17. Java 17 is installed locally today; Java 21 is a better current long-term baseline for new Spring services.

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

### Map Library

Options: MapLibre GL or Leaflet.

Recommendation: choose after confirming first Census and USGS layer formats. MapLibre is stronger for vector tiles and modern rendering; Leaflet is simpler for accessible control composition and basic overlays.

### DSpace Docker Baseline

Options: official DSpace Docker Compose examples or a project-local Compose file derived from them.

Recommendation: start from DSpace-supported Docker patterns and keep local overrides minimal.
