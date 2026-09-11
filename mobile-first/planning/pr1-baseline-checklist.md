# PR 1 Baseline Checklist

Status: in review

## Purpose

PR 1 establishes the planning foundation for the mobile-first Census frontend without changing runtime behavior. It should be easy to review, safe to merge, and clear enough that PR 2 can scaffold the new app without reopening the architecture discussion.

## Scope

PR 1 is documentation-only.

Included:

- architecture decision for a parallel mobile-first Angular app
- target workspace shape
- existing API-client reuse boundary
- module-based, Observable-first Angular direction
- local port plan
- implementation sequence
- UX engagement strategy
- infographics and data visualization plan
- validation plan
- baseline readiness checklist

Excluded:

- no generated Angular app
- no app routing changes
- no backend changes
- no duplicate API-contract/client library
- no Storybook setup yet

## Baseline Checks

Local-runtime rows distinguish user-reported results from repository facts verified directly from the current repository.

| Check                   | Expected Result                                                           | Current Evidence                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Dependencies installed  | `pnpm install` completes at workspace root                                | User reported `pnpm install` completed on 2026-09-11                                                                       |
| pnpm build approvals    | Required local build scripts can run                                      | User reported `pnpm approve-builds` completed; no package change is included in PR 1                                       |
| Existing app target     | Nx exposes `discovery-ui`                                                 | Repository-verified from `apps/discovery-ui/project.json`                                                                  |
| Existing app port       | Existing app remains on `4200`                                            | Repository-verified `serve-static` port is `4200`; existing app behavior is not changed by PR 1                            |
| Existing API base URL   | Shared client defaults to `http://localhost:8080/api`                     | Repository-verified from `repository-api-client`                                                                           |
| Search client           | Shared typed search client already exists                                 | Repository-verified `RepositorySearchApi`, `SearchQuery`, `SearchResponse`, `SearchResult`, `FacetGroup`, and `FacetValue` |
| Local stack starts      | `pnpm start:all` reaches expected running state                           | User reported successful local startup on 2026-09-11                                                                       |
| Git baseline            | PR is based on current intended `main` baseline or divergence is explicit | PR #81 is open against `main`; mergeability remains a required pre-merge check                                             |
| New app name            | `census-mobile-frontend`                                                  | Frozen for PR 2                                                                                                            |
| New app port            | `4300`                                                                    | Frozen for PR 2                                                                                                            |
| Existing Storybook port | `4400`                                                                    | Repository-verified from `apps/discovery-ui/project.json`                                                                  |
| Mobile Storybook port   | `4500`                                                                    | Reserved for the mobile app                                                                                                |

User-reported local results are useful readiness evidence but are not represented as independently reproduced CI results.

## Suggested PR 1 Description

```text
This PR documents the planned mobile-first Census/Civics frontend architecture.

It proposes a new Angular app under apps/census-mobile-frontend that runs beside the existing Angular app, uses port 4300 locally, and consumes the existing API through repository-api-client rather than introducing a second backend or duplicate search client. It also defines the first implementation sequence, Observable-first NgRx/RxJS direction, validation strategy, accessibility expectations, and a visualization/engagement plan for infographics and data visualizations.

No runtime app or backend code changes are included.
```

## PR 1 Acceptance Criteria

- Documentation explains why a parallel app is being created.
- Documentation names the app and development ports.
- Documentation reuses `repository-api-client` as the existing typed data boundary.
- Documentation avoids duplicate search contracts and client services.
- Documentation freezes module-based Angular composition and Observable-first RxJS/NgRx state for the new app.
- Documentation preserves the existing backend as the single source of search truth.
- Documentation describes where infographics and visualizations belong and their data-integrity limits.
- Documentation includes a phased implementation backlog.
- Existing runtime code is not modified.
- Repository CI formatting gate is green before merge.

## Risks to Call Out

- A second frontend increases ongoing maintenance and E2E surface area.
- The existing app and new app will intentionally use different Angular bootstrap styles unless later convergence is justified.
- Visualization usefulness depends on server-provided facet/aggregate data; a paged response must not be misrepresented as a corpus-wide distribution.
- Shared UI libraries should not be created prematurely; reuse should be demonstrated first.
- Storybook and browser evidence for the new app will add CI cost and should be introduced incrementally.
