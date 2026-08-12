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

DSpace REST integration remains the next platform step. The default stack intentionally starts with the Java API, PostgreSQL, and Solr so the local demo has a reliable Docker baseline before DSpace initialization and repository seeding are added.

`pnpm run start:all` is the preferred development command. It runs `docker compose down --remove-orphans` first so stale containers from earlier iterations are removed without changing the configured ports or deleting persistent volumes.

## Planned Services

### Angular Discovery UI

Public-facing search, dataset detail, mapping, and accessibility evidence UI.

### DSpace REST API

Repository API and content-management layer for communities, collections, items, metadata, bitstreams, and relationships.

Status: planned next. DSpace official Docker images and compose patterns should be used for this service instead of a hand-rolled runtime.

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

The API host port is `8080` for the local default. The Angular UI host port is `4200`, Solr is `8983`, and PostgreSQL is `5432`. Do not change these defaults for normal demo work.

## Reset Commands

Use the smallest reset that solves the problem:

```bash
pnpm run docker:reset:containers
```

Stops and removes current Compose containers and orphans. This preserves named volumes, including PostgreSQL, Solr, pnpm store, container `node_modules`, and API artifact storage.

```bash
pnpm run docker:reset:volumes
```

Stops containers and deletes named volumes. This removes persistent database/index/cache state and should be used only when you intentionally want a clean local demo storage reset.

For normal development, prefer:

```bash
pnpm run start:all
```

That command removes stale containers first, then starts the stack on the default ports with persistent storage intact.

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
