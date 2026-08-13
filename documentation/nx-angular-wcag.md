# Nx, Angular 22, Material Design, WCAG, and Section 508 Architecture

## Version Baseline

Verified package versions on August 11, 2026:

- Angular: 22.1.1
- Angular Material: 22.1.1
- Nx: 23.1.1
- @nx/angular: 23.1.1
- axe-core: 4.13.0
- @axe-core/playwright: 4.13.0
- TypeScript: 6.0.3, matching Angular 22 peer requirements
- NgRx: 22.0.0-rc.0, selected because the stable 21.1.1 line peers Angular 21 while the RC peers Angular 22

## Workspace Direction

The repository should be an Nx monorepo with one public Angular application and focused internal libraries:

```text
apps/discovery-ui
apps/discovery-ui-e2e
libs/shared/ui
libs/shared/material
libs/shared/accessibility
libs/repository/api-client
libs/repository/models
libs/maps/visualization
libs/maps/usgs-overlays
libs/data-sources/census
libs/data-sources/usgs
tools/dspace
tools/scripts
schemas/openapi
apps/repository-api
```

## Application Responsibilities

### discovery-ui

Angular 22 app for:

- Search and facets.
- Dataset details.
- Version history.
- Citation and downloads.
- Map visualization.
- USGS overlays.
- Accessibility evidence views.

### shared/material

Material Design setup:

- Theme tokens.
- Component density decisions.
- Focus indicator rules.
- Overlay styling.
- Snackbar/dialog/menu contrast rules.

### shared/accessibility

Accessibility utilities:

- Route accessibility metadata.
- Focus restoration helpers.
- Live-announcement helpers.
- Keyboard interaction testing helpers.
- WCAG/508 checklist models.

### maps/visualization

Map UI components:

- Map shell.
- Layer controls.
- Legend.
- Feature list.
- Dataset map tab.

### maps/usgs-overlays

USGS overlay adapters:

- Earthquake feed adapter.
- Overlay metadata models.
- Attribution helpers.
- Error and freshness states.

## Automated Accessibility Stack

Use Playwright plus axe-core:

- Route smoke scans.
- Keyboard path tests.
- Focus-visible tests.
- Dialog focus restoration tests.
- Reflow viewport tests.
- Map controls and feature-list checks.

Suggested Nx targets:

```json
{
  "accessibility": {
    "executor": "nx:run-commands",
    "options": {
      "command": "playwright test --project=accessibility"
    }
  },
  "wcag": {
    "executor": "nx:run-commands",
    "options": {
      "command": "playwright test --grep @wcag"
    }
  },
  "section508": {
    "executor": "nx:run-commands",
    "options": {
      "command": "playwright test --grep @section508"
    }
  }
}
```

## Manual Accessibility Evidence

Automation is not enough for conformance. Each release-quality workflow should capture:

- Keyboard-only review.
- NVDA review.
- JAWS review where available.
- Reflow review.
- Color/contrast review.
- Map alternative-data review.

## MCP Direction

MCP integration should expose read-oriented workspace and evidence operations first:

- Nx project discovery.
- Target inspection.
- Accessibility evidence lookup.
- Dataset source status lookup.

Write-oriented MCP operations should call existing Nx targets or repo scripts rather than modifying workspace state directly.

## NgRx and RxJS Data Flow

The frontend should treat backend communication as typed asynchronous streams:

- API clients return typed `Observable<T>` values from Angular `HttpClient`.
- Components dispatch typed actions instead of calling APIs directly.
- Effects own HTTP calls, retries, cancellation, and failure mapping.
- Reducers own durable feature state.
- Selectors expose read models to components.
- Entity adapters should be used for keyed collections such as datasets, files, map features, and evidence entries.
- Signals are acceptable for local derived UI state, but not as a replacement for shared repository/search/map state.
