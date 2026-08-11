# Planning

This directory tracks the implementation plan for Civics Research Repository.

## Current Planning Answer

Yes, the project needs a little more planning before deeper implementation, but not broad discovery planning. The product direction and technical baseline are set. The remaining planning should focus on decisions that would otherwise create rework:

- Java build/runtime path.
- DSpace Docker baseline.
- Map library selection.
- First vertical-slice acceptance criteria.
- Accessibility evidence scope for the first demo.
- API contract generation path into both Java DTOs and Angular API clients.

## Planning Documents

- [TODO.md](TODO.md) - PI and sprint backlog.
- [ROADMAP.md](ROADMAP.md) - implementation sequence and dependencies.
- [DECISIONS.md](DECISIONS.md) - accepted and pending architecture decisions.
- [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md) - first vertical-slice demo criteria.
- [RISKS.md](RISKS.md) - delivery risks and mitigations.

## Current Baseline

- Repository exists on GitHub as `civics-research-repository`.
- Nx workspace exists with Angular 22, Angular Material 22, Playwright, axe-core, NgRx, and generated libraries.
- OpenAPI is the API source of truth.
- Frontend TypeScript DTOs are generated from `schemas/openapi/repository-api.yaml`.
- `quality:all` includes formatting, OpenAPI lint, OpenAPI drift check, lint, tests, build, WCAG report, and Section 508 report.
- Backend direction is Java/Spring Boot, with NestJS kept only as a prototyping fallback.

## Next Planning Gate

Before building `apps/repository-api`, close these decisions:

- Maven vs Gradle.
- Java runtime target: 17, 21, or 25.
- Nx Java integration plugin.
- Java OpenAPI DTO generation tool.
- DSpace Docker source baseline.
