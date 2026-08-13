# Planning

This directory tracks the implementation plan for Civics Research Repository.

## Current Planning Answer

The first vertical slice is connected end to end. DSpace drives discovery and dataset detail, the datastore roles are named and documented, `pnpm run start:all` (alias `demo:up`) starts the full stack, Java DTOs are generated from OpenAPI, and architecture diagrams plus AWS modernization documentation are delivered.

What remains is breadth and explainability rather than scaffolding: live catalog harvesting in place of curated tables, the interview demo package, optional IaC for the documented AWS target, and recorded manual accessibility evidence.

The near-term order, with rationale, is in [ROADMAP.md](ROADMAP.md#near-term-order) and tracked in [TODO.md](TODO.md#current-priorities):

1. ~~Make DSpace drive one complete vertical slice.~~ **Delivered.**
2. ~~Disambiguate the two PostgreSQL and two Solr systems.~~ **Delivered.**
3. ~~Add a true one-command demo environment.~~ **Delivered** — `start:all` and `demo:up` share the same full-stack flow.
4. ~~Diagrams and AWS modernization documentation.~~ **Delivered.**
5. Manual accessibility evidence checklists **delivered**; a recorded run is outstanding.
6. Catalog harvesting, demo walkthrough scripts, and Terraform/CDK for the documented AWS target.

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
- DSpace 9.0, two PostgreSQL instances, and two Solr instances run under Docker Compose. `pnpm run start:all` activates the DSpace profile, seeds from `tools/dspace/catalog.json`, and reindexes before printing URLs.
- Sync supports dry-run, diff, and idempotent apply against DSpace for Dublin Core and `crr.*` metadata.
- Discovery, dataset detail, maps with USGS overlays, admin sync, and an evidence route are implemented in Angular.
- `quality:all` covers formatting, OpenAPI lint and drift, lint, unit tests, build, storyboard, WCAG, and Section 508.

## Remaining Decision Gates

Only two are open:

- Nx Java integration plugin — adopt only if project-graph awareness of Java sources becomes worth the dependency.
- Generated Spring controller interfaces — deferred until the OpenAPI Generator supports Spring 7 conventions; model DTOs are already generated on every build.

Everything else is recorded in [DECISIONS.md](DECISIONS.md).
