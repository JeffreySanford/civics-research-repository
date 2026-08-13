# Docker, DSpace, Solr, and PostgreSQL

## Local Platform Goal

Provide a Docker-based development environment that can start the repository platform and application services with a single command.

Target command:

```bash
docker compose up
```

Current default stack:

- Angular Discovery UI on `http://localhost:4200`.
- Java Repository API on `http://localhost:8080/api`.
- PostgreSQL on `localhost:5432`.
- Solr on `http://localhost:8983`.
- Persistent Docker volumes for repository API artifacts, PostgreSQL, Solr, pnpm store, and container `node_modules`.
- DSpace REST profile on `http://localhost:8081/server/api`, started by `pnpm run start:all`.

`pnpm run start:all` is the preferred development command. It starts the DSpace profile, seeds when needed, starts the application stack, reindexes, and prints URLs when every service is healthy. It reconciles containers in both stacks — recreating only broken ones — without deleting persistent volumes. See [Why the scoped commands exist](#why-the-scoped-commands-exist) below.

## Planned Services

### Angular Discovery UI

Public-facing search, dataset detail, mapping, and accessibility evidence UI.

### DSpace REST API

Repository API and content-management layer for communities, collections, items, metadata, bitstreams, and relationships.

Status: Compose profile verified and activated by `pnpm run start:all`. The profile seeds DSpace Solr cores into persistent storage, runs DSpace database migrations, then starts the REST API.

Baseline confirmed from the DSpace project:

- Backend image: `dspace/dspace`, described as the DSpace REST API backend built on Spring Boot.
- Frontend image: `dspace/dspace-angular`, the Angular UI built on the REST API.
- Compose references: the DSpace source tree includes Docker Compose files under `dspace/src/main/docker-compose`.
- Production caution: the DSpace Docker Compose README states the provided images/patterns are useful references, but should not be used as-is for production.

References:

- https://hub.docker.com/r/dspace/dspace
- https://hub.docker.com/r/dspace/dspace-angular
- https://github.com/DSpace-Labs/DSpace-9x/blob/dspace-9_x/dspace/src/main/docker-compose/README.md

### PostgreSQL

Persistent database used by DSpace.

### Apache Solr

Discovery index for DSpace search, facets, full text, and relevance.

### Sync orchestration (Java API)

Public metadata ingestion and DSpace reconciliation live in `apps/repository-api`. The API performs startup sync, exposes admin sync endpoints, and provides script entry points for dry-run, diff, and apply.

## Local Compose Sketch

```text
services:
  discovery-ui:
    role: Angular frontend

  dspace-api:
    role: DSpace REST API
    depends_on:
      - postgres
      - solr

  postgres:
    role: DSpace database

  solr:
    role: DSpace discovery/search index

  repository-api:
    role: Java API, sync orchestration, discovery projection
    depends_on:
      - postgres
      - solr
```

## Implementation Notes

- Start from DSpace-supported Docker patterns instead of inventing a custom DSpace runtime.
- Keep Solr schema/configuration changes documented.
- Use named Docker volumes for PostgreSQL and Solr persistence.
- Use a named Docker volume for small-to-medium mirrored demo artifacts.
- Provide seed metadata for a small first dataset.
- Avoid checking large downloaded datasets into git.
- Use environment files for local service URLs and credentials.

## Demo Command

```bash
pnpm run demo:up
```

One command for a demonstration or daily development. Same flow as `pnpm run start:all`: starts DSpace, waits for REST, seeds the repository, starts the application stack, rebuilds the discovery projection from DSpace, waits for the Angular UI, and prints the URLs worth showing. Re-running is safe: the seed, SAF generation, and sync are all idempotent.

Order matters and is the reason this is a script rather than a Compose profile: DSpace must be migrated and seeded **before** the API starts, otherwise startup sync runs against an empty repository and reports a failure that looks like a defect.

A cold run after `docker:reset:everything` takes several minutes, almost all of it DSpace's database migration. A warm restart takes roughly ninety seconds.

```bash
pnpm run demo:down
```

Stops everything and keeps all data.

## Current Commands

```bash
pnpm run start:all
pnpm run docker:ps
pnpm run docker:logs
pnpm run sync:dry-run
pnpm run sync:diff
pnpm run sync:apply
pnpm run docker:down
```

The API host port is `8080` for the local default. The Angular UI host port is `4200`, the discovery Solr is `8983`, and the application PostgreSQL is `5432`. Do not change these defaults for normal demo work.

The application PostgreSQL holds the database `civics_ops` (role `civics`) and contains only application state — currently the `sync_jobs` table. It is not the repository. DSpace owns its own PostgreSQL on `5433` with the database `dspace`, and its own Solr on `8984`. The `discovery` core on `8983` is a projection of DSpace that can be rebuilt at any time with `pnpm run reindex`.

## Reset Commands

Use the smallest reset that solves the problem. Every command below except the last is **scoped to the application stack** and never touches a running DSpace profile.

```bash
pnpm run docker:reset:containers
```

Stops and removes the application-stack containers (`postgres`, `solr`, `repository-api`, `discovery-ui`). Named volumes survive. Does not stop the DSpace profile.

```bash
pnpm run start:all:recreate
```

Force-recreates every container in the full startup flow (DSpace profile and application stack), then starts detached. Use when a container is wedged but you do not want to lose volume state.

```bash
pnpm run start:all:rebuild
```

Rebuilds the images first, then force-recreates the full stack. Use after changing the Java API `Dockerfile` or its dependencies.

```bash
pnpm run docker:reset:everything
```

The only destructive command: takes down **every** container in the project, DSpace profile included, and deletes all named volumes. That erases the DSpace assetstore, both databases, and both Solr indexes, so the seed and sync must be run again from scratch. It is named `everything` rather than `volumes` precisely so it cannot be reached for casually.

### Why the scoped commands exist

`docker compose down` is not profile-scoped. It removes every container in the project, including the DSpace profile, and `down --volumes` additionally destroys the DSpace assetstore and databases. `start:all` used to begin with `docker compose down --remove-orphans`, which meant starting the UI silently dismantled a running DSpace stack.

`start:all` now runs [tools/scripts/stack.mjs](../tools/scripts/stack.mjs), which orchestrates DSpace startup, seeding, and the application stack through [tools/scripts/compose-stack.mjs](../tools/scripts/compose-stack.mjs). Each service is inspected and only broken containers — unhealthy, dead, stuck restarting, or exited non-zero — are removed before `docker compose up`. Healthy containers are left running. Compose still recreates a service when its image or configuration changed. A lockfile mismatch against `package.json` is checked before the UI container starts.

For normal development, prefer:

```bash
pnpm run start:all
```

### How a failed start reports itself

An attached `start:all` used to be able to reach a state that read as a hang: the UI container died, and Postgres, Solr, and the Java API kept running and printing healthy output, so the terminal filled with Solr pings while nothing was actually starting. Two changes close that.

**Before any container is touched**, the launcher runs `pnpm install --lockfile-only --frozen-lockfile --ignore-scripts`. The `discovery-ui` container installs with `--frozen-lockfile`, so a lockfile that disagrees with `package.json` makes it exit immediately with `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` — the single most likely startup failure, and the least legible from the logs. The check turns it into one sentence and the fix:

```bash
pnpm install --no-frozen-lockfile
```

Commit the regenerated `pnpm-lock.yaml` alongside the `package.json` change.

**Attached runs pass `--abort-on-container-exit`**, so one dead service stops the whole stack and returns control to the shell. The launcher then names the service that failed and prints its last 40 log lines. Because the abort sends SIGTERM to everything else, the other services also exit non-zero (143); the launcher reads each container's `State.FinishedAt` and blames the service that exited **first**, listing the rest as `Stopped by the abort, not the cause`. Without that ordering, killing the UI was reported as a Solr failure.

Detached runs (`--detach`) keep the previous behavior, since there is no attached session to abort.

## Optional DSpace Profile

The DSpace profile is separated from the default demo stack because DSpace uses its own DSpace-flavored Postgres and Solr images. This avoids destabilizing the working Java API, Angular UI, Postgres, and Solr demo path.

```bash
pnpm run dspace:up
pnpm run dspace:migrate
pnpm run dspace:seed
pnpm run dspace:ps
pnpm run dspace:logs
pnpm run dspace:verify
pnpm run dspace:verify:seed
pnpm run dspace:down
```

Profile service ports:

- DSpace REST: `http://localhost:8081/server/api`.
- DSpace PostgreSQL: `localhost:5433`.
- DSpace Solr: `http://localhost:8984/solr`.

The profile uses these images:

- `dspace/dspace:dspace-9.0`
- `dspace/dspace-postgres-pgcrypto:dspace-9.0`
- `dspace/dspace-solr:dspace-9.0`

Startup order:

1. `dspace-solr-init` copies DSpace core templates into the persistent Solr volume when the `search` core is missing.
2. `dspace-solr` starts and must report the `search` core as healthy.
3. `dspace-db-init` runs `/dspace/bin/dspace database migrate` against the persistent DSpace PostgreSQL volume.
4. `dspace-rest` starts after Solr is healthy and database migration has completed.

Verified local REST response:

```bash
pnpm run dspace:verify
```

Expected result: JSON containing `dspaceName`, `dspaceServer`, `dspaceVersion`, and REST API links from `http://localhost:8081/server/api`.

Seeded repository objects come from [tools/dspace/catalog.json](../tools/dspace/catalog.json), expanded into SAF packages by `tools/scripts/generate-saf.mjs` at seed time:

- Community: `Census Public Research Data`.
- Collections per program (TIGER/Line, LODES, ACS PUMS, and eleven additional programs).
- One hundred sixty-four research objects across 52 geographies, verified by `pnpm run dspace:verify:seed`.

`pnpm run dspace:seed` is idempotent on normal persistent volumes. It creates a local admin account only when missing, imports communities and collections when missing, and uses the DSpace import mapfile in the asset store to skip duplicate item imports. `pnpm run dspace:verify:seed` confirms items appear through DSpace discovery.

Piecemeal DSpace commands (`pnpm run dspace:up`, `pnpm run dspace:seed`, `pnpm run dspace:verify:seed`) remain available when working on repository integration outside the unified `start:all` flow.

## Future AWS Direction

Potential production-style architecture:

```text
CloudFront
  -> Angular static or SSR frontend
  -> Application Load Balancer
  -> DSpace REST container
  -> Repository API container (sync orchestration)
  -> RDS PostgreSQL
  -> Solr with persistent storage or managed search decision
```

The AWS path should document tradeoffs between ECS/Fargate and EKS/Kubernetes rather than assuming one is automatically correct.
