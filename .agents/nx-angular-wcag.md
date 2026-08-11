# Nx, Angular, Material, WCAG, and Section 508 Working Guide

## Workspace Commands

Use the package manager prefix:

```bash
pnpm nx show projects
pnpm nx show project discovery-ui --json
pnpm nx graph
pnpm nx affected -t lint,test,build
```

## Generation Plan

Generate the first app with Nx after dependencies are installed:

```bash
pnpm nx g @nx/angular:application --name=discovery-ui --directory=apps/discovery-ui --routing --standalone --style=scss --unitTestRunner=vitest-angular --e2eTestRunner=playwright --no-interactive
```

Generate shared libraries as non-buildable internal libraries:

```bash
pnpm nx g @nx/angular:library --name=shared-ui --directory=libs/shared/ui --standalone --style=scss --unitTestRunner=vitest-analog --no-interactive
pnpm nx g @nx/angular:library --name=shared-material --directory=libs/shared/material --standalone --style=scss --unitTestRunner=vitest-analog --no-interactive
pnpm nx g @nx/js:library --name=repository-models --directory=libs/repository/models --bundler=none --unitTestRunner=vitest --useProjectJson --no-interactive
pnpm nx g @nx/js:library --name=repository-api-client --directory=libs/repository/api-client --bundler=none --unitTestRunner=vitest --useProjectJson --no-interactive
pnpm nx g @nx/angular:library --name=maps-visualization --directory=libs/maps/visualization --standalone --style=scss --unitTestRunner=vitest-analog --no-interactive
pnpm nx g @nx/js:library --name=maps-usgs-overlays --directory=libs/maps/usgs-overlays --bundler=none --unitTestRunner=vitest --useProjectJson --no-interactive
```

## Angular 22 Patterns

- Prefer standalone components, directives, and pipes.
- Use typed reactive forms for search and submission workflows.
- Use route-level lazy loading for discovery, dataset detail, admin, and evidence areas.
- Keep state URL-driven for search terms, filters, sort, page, and selected map layers.
- Keep DSpace and Solr response mapping outside components.

## Angular Material 22 Patterns

- Use Material controls for form fields, tabs, dialogs, menus, tooltips, sidenav, chips, table, paginator, and progress indicators.
- Keep icon-only actions accessible with `aria-label`.
- Verify focus indicator contrast against all supported surfaces.
- Centralize Material theme tokens and component overrides.
- Avoid one-off color overrides in page components.

## WCAG and 508 Acceptance Criteria

Each route should define:

- Keyboard path.
- Focus order.
- Focus restoration behavior.
- Accessible names for controls.
- Heading structure.
- Landmark structure.
- Error and status announcements.
- Reflow behavior.
- Contrast expectations.
- Automated axe scan.
- Manual assistive-technology notes when workflow risk is high.

## Map-Specific Criteria

Every map route must include:

- Layer control reachable by keyboard.
- Visible source attribution.
- Text summary of visible layers and filtered geography.
- Accessible feature list or table.
- Non-color-only legend.
- Reduced-motion behavior.
- Clear error state when overlays fail to load.
