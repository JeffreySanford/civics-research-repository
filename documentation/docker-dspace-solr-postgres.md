# Docker, DSpace, Solr, and PostgreSQL

## Local Platform Goal

Provide a Docker-based development environment that can start the repository platform and application services with a single command.

Target command:

```bash
docker compose up
```

## Planned Services

### Angular Discovery UI

Public-facing search, dataset detail, mapping, and accessibility evidence UI.

### DSpace REST API

Repository API and content-management layer for communities, collections, items, metadata, bitstreams, and relationships.

### PostgreSQL

Persistent database used by DSpace.

### Apache Solr

Discovery index for DSpace search, facets, full text, and relevance.

### Harvester

Small service or script that imports public metadata and source links from Census and USGS resources.

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
- Provide seed metadata for a small first dataset.
- Avoid checking large downloaded datasets into git.
- Use environment files for local service URLs and credentials.

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
