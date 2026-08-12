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
- Optional DSpace REST profile on `http://localhost:8081/server/api`.

DSpace REST is available as an optional Compose profile. The default stack intentionally starts with the Java API, PostgreSQL, and Solr so the local demo remains reliable while DSpace repository seeding is added.

`pnpm run start:all` is the preferred development command. It reconciles the containers in the active Compose profile — recreating only the broken ones — without changing the configured ports or deleting persistent volumes. See [Why the scoped commands exist](#why-the-scoped-commands-exist) below.

## Planned Services

### Angular Discovery UI

Public-facing search, dataset detail, mapping, and accessibility evidence UI.

### DSpace REST API

Repository API and content-management layer for communities, collections, items, metadata, bitstreams, and relationships.

Status: optional Compose profile added and runtime verified. The profile seeds DSpace Solr cores into persistent storage, runs DSpace database migrations, then starts the REST API.

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

### Harvester

Small service or script that imports public metadata and source links from Census and USGS resources.

Status: represented by the Java API sync placeholder. The API currently performs startup sync and exposes admin sync endpoints returning typed dry-run actions.

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

  harvester:
    role: public metadata ingestion
    depends_on:
      - dspace-api
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

One command for a demonstration. It starts DSpace, waits for REST, seeds the repository, starts the application stack, rebuilds the discovery projection from DSpace, waits for the Angular UI, and prints the URLs worth showing in order. Re-running is safe: the seed and the sync are both idempotent.

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

Stops and removes the four application-stack containers. Named volumes survive, including PostgreSQL, Solr, pnpm store, container `node_modules`, Nx cache, and API artifact storage.

```bash
pnpm run start:all:recreate
```

Force-recreates the application-stack containers, then starts and attaches. Use when a container is wedged but you do not want to lose volume state.

```bash
pnpm run start:all:rebuild
```

Rebuilds the images first, then force-recreates. Use after changing the Java API `Dockerfile` or its dependencies.

```bash
pnpm run docker:reset:everything
```

The only destructive command: takes down **every** container in the project, DSpace profile included, and deletes all named volumes. That erases the DSpace assetstore, both databases, and both Solr indexes, so the seed and sync must be run again from scratch. It is named `everything` rather than `volumes` precisely so it cannot be reached for casually.

### Why the scoped commands exist

`docker compose down` is not profile-scoped. It removes every container in the project, including the DSpace profile, and `down --volumes` additionally destroys the DSpace assetstore and databases. `start:all` used to begin with `docker compose down --remove-orphans`, which meant starting the UI silently dismantled a running DSpace stack.

`start:all` now runs [tools/scripts/stack.mjs](../tools/scripts/stack.mjs), which reads the services in the active Compose profile, inspects each container, and removes only the ones that are actually broken — unhealthy, dead, stuck restarting, or exited non-zero. Healthy containers are left running, and any container outside the active profile is reported and left alone.

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

Seeded repository objects:

- Community: `Census Public Research Data`.
- Collection: `TIGER/Line Geospatial Files`.
- Item: `2025 TIGER/Line - Census Tracts - North Dakota`.

`pnpm run dspace:seed` is idempotent on normal persistent volumes. It creates a local admin account only when missing, imports the community/collection when missing, imports the metadata-only SAF item once, and then uses the DSpace import mapfile in the asset store to skip future duplicate item imports. `pnpm run dspace:verify:seed` confirms the TIGER/Line item appears through DSpace discovery.

Use this only when working on DSpace REST integration. The default demo remains `pnpm run start:all`.

## Future AWS Direction

Potential production-style architecture:

```text
CloudFront
  -> Angular static or SSR frontend
  -> Application Load Balancer
  -> DSpace REST container
  -> Harvester container
  -> RDS PostgreSQL
  -> Solr with persistent storage or managed search decision
```

The AWS path should document tradeoffs between ECS/Fargate and EKS/Kubernetes rather than assuming one is automatically correct.
