# PR 1 Readiness Note

Status: proposed

Date: 2026-09-11

## Summary

The mobile-first Census frontend planning package is ready to become PR 1 as a documentation-only change. The current workspace configuration supports the proposed direction: the existing Angular app already has an isolated serve target, a known development port, a Storybook target, and a shared repository API client/base URL that the new mobile app can mirror.

## Repo Facts Verified From Source

| Area | Current Finding | Source |
| --- | --- | --- |
| Existing app project | `discovery-ui` | `apps/discovery-ui/project.json` |
| Existing app source root | `apps/discovery-ui/src` | `apps/discovery-ui/project.json` |
| Existing app serve port | `4200` | `apps/discovery-ui/project.json` |
| Existing API base URL | `http://localhost:8080/api` by default | `libs/repository/api-client/src/lib/repository-api-client.ts` |
| Existing build executor | `@angular/build:application` | `apps/discovery-ui/project.json` |
| Existing style language | `scss` | `apps/discovery-ui/project.json`, `nx.json` |
| Existing unit test pattern | Angular unit-test target/Vitest workspace defaults | `apps/discovery-ui/project.json`, `nx.json`, `package.json` |
| Workspace app generator defaults | SCSS, Vitest, ESLint, Playwright | `nx.json` |
| Existing Nx wrapper | `pnpm nx ...` | `package.json` |
| Package manager | `pnpm@10.14.0` | `package.json` |

## Proposed New App Facts

| Area | Proposed Value | Reason |
| --- | --- | --- |
| App name | `census-mobile-frontend` | Clear, specific, and separate from existing app |
| App path | `apps/census-mobile-frontend` | Matches Nx app layout |
| Serve port | `4300` | Avoids collision with existing `4200` app |
| API client/base URL | Mirror the repository API client target | Reuses existing backend path |
| Styling | SCSS | Matches workspace generator defaults |
| Unit tests | Vitest | Matches workspace generator defaults |
| E2E | Playwright initially | Matches current generator defaults; Playwright can remain browser evidence path where useful |
| Storybook | Use port `4500` for mobile app | Avoids collision with existing `discovery-ui` Storybook on `4400` |

## Environment Status From This Codex Session

This Codex session can see `node_modules` in the D: drive checkout and Nx commands succeed there.

Observed from this session:

```text
Test-Path D:/repos/civics-research-repository/node_modules -> True
Test-Path D:/repos/civics-research-repository/node_modules/.bin/nx -> True
pnpm nx show projects -> succeeds
```

The user has reported running `pnpm install`, `approve-builds`, and `start:all` locally. PR 2 scaffolding should use:

```text
D:\repos\civics-research-repository
```

The current local working tree also has an unstaged `package.json` change from `pnpm approve-builds`; this PR should not stage or overwrite it.

## Branch Status

This Codex session sees the D: drive checkout branch as:

```text
codex/mobile-first-census-pr1
```

## PR 1 Is Ready When

- The planning docs are committed.
- The PR description includes the baseline checks from `pr1-baseline-checklist.md`.
- The PR notes the existing local `package.json` approve-builds change is intentionally excluded.
- No runtime application or backend files are changed.

## PR 2 Gate

Do not scaffold `apps/census-mobile-frontend` until these are true:

- `pnpm nx show projects` succeeds.
- Existing `discovery-ui` target is visible.
- Existing app behavior on `4200` is confirmed or intentionally deferred with a reason.
- The branch is updated or divergence from `origin/main` is understood.
