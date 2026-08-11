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

## Planned Services

### Angular Discovery UI

Public-facing search, dataset detail, mapping, and accessibility evidence UI.

### DSpace REST API

Repository API and content-management layer for communities, collections, items, metadata, bitstreams, and relationships.

Status: planned next. DSpace official Docker images and compose patterns should be used for this service instead of a hand-rolled runtime.

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
pnpm run sync:dry-run
pnpm run sync:apply
pnpm run docker:down
```

The API host port is `8080` for the local default. If another project is using that port, temporarily remap `repository-api` in `docker-compose.yml`.

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
