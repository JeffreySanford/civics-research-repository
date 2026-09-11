# PR 1 Readiness Note

Status: in review

Date: 2026-09-11

## Summary

The mobile-first Census frontend planning package is ready for PR 1 as a documentation-only change. The current repository configuration supports the proposed direction: the existing Angular app has an isolated project target, a known development port, Storybook on a separate port, and an existing generated `repository-api-client` that the new mobile app can reuse directly.

The new app should prefer module-based Angular composition while using a hybrid state model: NgRx/RxJS for shared and asynchronous search-domain state, with Angular Signals used where they simplify local synchronous UI state.

## Repo Facts Verified From Source

| Area                           | Current Finding                                                             | Source                                                        |
| ------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Existing app project           | `discovery-ui`                                                              | `apps/discovery-ui/project.json`                              |
| Existing app source root       | `apps/discovery-ui/src`                                                     | `apps/discovery-ui/project.json`                              |
| Existing app serve/static port | `4200`                                                                      | `apps/discovery-ui/project.json`                              |
| Existing Storybook port        | `4400`                                                                      | `apps/discovery-ui/project.json`                              |
| Existing API base URL          | `http://localhost:8080/api` by default                                      | `libs/repository/api-client/src/lib/repository-api-client.ts` |
| Existing search client         | `RepositorySearchApi`                                                       | `libs/repository/api-client/src/lib/repository-api-client.ts` |
| Existing search types          | `SearchQuery`, `SearchResponse`, `SearchResult`, `FacetGroup`, `FacetValue` | `libs/repository/api-client/src/lib/repository-api-client.ts` |
| Existing build executor        | `@angular/build:application`                                                | `apps/discovery-ui/project.json`                              |
| Existing style language        | SCSS                                                                        | `apps/discovery-ui/project.json`                              |
| Existing unit test target      | Angular unit-test target                                                    | `apps/discovery-ui/project.json`                              |
| Package manager                | `pnpm@10.14.0`                                                              | `package.json`                                                |

## Proposed New App Facts

| Area                | Proposed Value                           | Reason                                                                       |
| ------------------- | ---------------------------------------- | ---------------------------------------------------------------------------- |
| App name            | `census-mobile-frontend`                 | Clear, specific, and separate from existing app                              |
| App path            | `apps/census-mobile-frontend`            | Matches Nx app layout                                                        |
| Angular composition | Module-based (`standalone=false`)        | Preferred application/component organization for the new frontend            |
| Serve port          | `4300`                                   | Avoids collision with existing `4200` app                                    |
| API boundary        | Existing `repository-api-client`         | Reuses typed OpenAPI contracts and `RepositorySearchApi`                     |
| Shared search state | NgRx/RxJS                                | Fits effects, cancellation, selectors, URL state, and asynchronous workflows |
| Local UI state      | Angular Signals where appropriate        | Fits drawer/disclosure state and simple synchronous computed presentation    |
| Styling             | SCSS                                     | Matches repository conventions                                               |
| Unit tests          | Repository-standard Angular/Vitest setup | Keeps validation consistent with the workspace                               |
| Storybook           | Port `4500`                              | Avoids collision with existing `discovery-ui` Storybook on `4400`            |

## Local Environment Evidence

The user reported completing these local baseline steps on 2026-09-11:

```text
pnpm install
pnpm approve-builds
pnpm start:all
```

These are recorded as user-reported local readiness evidence, not as independently reproduced CI results.

The `pnpm approve-builds` operation produced a local `package.json` change during setup. That change was intentionally removed from PR 1 so this remains a documentation-only architecture PR.

## Branch Status

PR #81 is open from:

```text
codex/mobile-first-census-pr1
```

into:

```text
main
```

The PR remains mergeable. Final repository CI and Browser Evidence should be green on the final documentation tree before merge.

## PR 1 Is Ready When

- The planning docs are committed and repository-formatted.
- The PR description reflects the existing `repository-api-client` instead of proposing duplicate API libraries.
- The architecture prefers module-based Angular composition for the new app.
- The state boundary explicitly allows Signals for appropriate local synchronous UI state.
- NgRx/RxJS remains responsible for asynchronous/shared search state, effects, cancellation, and URL synchronization.
- No runtime application or backend files are changed.
- The final CI run passes.

## PR 2 Gate

After PR 1 is merged, PR 2 should scaffold `apps/census-mobile-frontend` only after confirming the implementation branch starts from the merged PR 1 baseline.

PR 2 should prove only:

- module-based Angular app generation
- routing + SCSS
- lint/test/build targets
- serve port `4300`
- existing app remains unchanged
- existing `repository-api-client` can be imported

Search NgRx/effects, component-level Signals, the full mobile vertical slice, Storybook, and data visualization should remain in the later PRs already defined in the implementation plan.
