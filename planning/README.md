# Planning

This directory tracks the implementation plan for Civics Research Repository.

## Current Planning Answer

Planning is no longer the constraint. The product direction, technical baseline, and every early decision gate are closed except Java DTO generation. What remains is execution against a known order, plus the demo artifacts that make the system explainable.

The near-term order, with rationale, is in [ROADMAP.md](ROADMAP.md#near-term-order) and tracked in [TODO.md](TODO.md#current-priorities):

1. Make DSpace drive one complete vertical slice, replacing the fixture path.
2. Disambiguate the two PostgreSQL and two Solr systems.
3. Add a true one-command demo environment.
4. Diagrams and AWS modernization documentation. **Delivered.**
5. Manual accessibility evidence checklists **delivered**; a recorded run is outstanding.

## Planning Documents

- [TODO.md](TODO.md) - PI and sprint backlog.
- [ROADMAP.md](ROADMAP.md) - implementation sequence and dependencies.
- [DECISIONS.md](DECISIONS.md) - accepted and pending architecture decisions.
- [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md) - first vertical-slice demo criteria.
- [RISKS.md](RISKS.md) - delivery risks and mitigations.

## Current Baseline

- Repository exists on GitHub as `civics-research-repository`.
- Nx workspace with Angular 22, Angular Material 22, Playwright, axe-core, NgRx, and generated libraries.
- OpenAPI is the API source of truth; frontend TypeScript DTOs are generated from `schemas/openapi/repository-api.yaml` with a drift check.
- `apps/repository-api` runs on Java 21 and Spring Boot, built with Gradle inside a container image.
- DSpace 9.0, two PostgreSQL instances, and two Solr instances run under Docker Compose, with DSpace behind an optional profile.
- Sync supports dry-run, diff, and idempotent apply against DSpace for Dublin Core and `crr.*` metadata.
- Discovery, dataset detail, maps with USGS overlays, admin sync, and an evidence route are implemented in Angular.
- `quality:all` covers formatting, OpenAPI lint and drift, lint, unit tests, build, storyboard, WCAG, and Section 508.

## Remaining Decision Gates

Only two are open:

- Nx Java integration plugin.
- Java OpenAPI DTO generation tool — the last unclosed contract gate, since Java records are currently hand-written against the schema.

Everything else is recorded in [DECISIONS.md](DECISIONS.md).
