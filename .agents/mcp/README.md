# MCP Plan

This directory documents the Model Context Protocol direction for the project. No local Nx-specific MCP server was exposed in the current agent session, so these files are templates and operating notes.

## Desired MCP Capabilities

### Nx Workspace Context

Useful operations:

- List projects.
- Read resolved project configuration.
- Inspect targets.
- Inspect dependency graph.
- Run safe read-only workspace queries.

Fallback command equivalents:

```bash
pnpm nx show projects --json
pnpm nx show project <project-name> --json
pnpm nx graph --print
```

### Accessibility Evidence

Useful operations:

- Run axe scans through Playwright.
- Store small scan summaries.
- Compare route accessibility regressions.
- Read Section 508/WCAG acceptance criteria.

Fallback command equivalents:

```bash
pnpm nx run-many -t accessibility
pnpm nx run-many -t wcag
pnpm nx run-many -t section508
```

### Public Data Sources

Useful operations:

- Validate Census source URLs.
- Validate USGS overlay endpoints.
- Snapshot metadata freshness.
- Produce ingestion dry-run reports.

## Agent Policy

MCP tools should not bypass repo scripts. When a task has a matching Nx target, the MCP operation should call or emulate the same target so CI and local development stay aligned.
