# Interview Demo Package

Narrative artifacts for PI 6.2: spoken walkthrough material for Census Bureau interviews and stakeholder demos. The stack itself is delivered; these documents explain what to show, what to say, and how the pieces fit together.

## Documents

- [Demo script](demo-script.md): ordered 15–20 minute walkthrough matching `pnpm run start:all` / `demo:up` URL output.
- [Architecture walkthrough](architecture-walkthrough.md): system context, request flow, datastore roles, Docker ports, seed/sync/projection, fixture fallback.
- [Ingestion walkthrough](ingestion-walkthrough.md): how data moves from publisher URLs through SAF generation, DSpace seed, sync, and Solr reindex.
- [Mapping and USGS walkthrough](mapping-usgs-walkthrough.md): MapLibre layers, accessible feature list, fixture vs live overlay data, North Dakota default geography.
- [Accessibility evidence walkthrough](accessibility-evidence-walkthrough.md): automated vs manual evidence, report commands, `/evidence` demo stop.
- [Tradeoffs](tradeoffs.md): architecture decisions and honest limits for interview Q&A.

## Related documentation

- [Architecture](../architecture.md): system model, datastore roles, DSpace-as-source-of-record rule.
- [Architecture diagrams](../architecture-diagrams.md): C4 views and sequence diagrams.
- [Docker, DSpace, Solr, PostgreSQL](../docker-dspace-solr-postgres.md): local platform startup, reset, and service responsibilities.
- [Data storage and sync](../data-storage-sync.md): sync modes, file manifest policy, expansion order.
- [Mapping visualization](../mapping-visualization.md): accessibility requirements and layer behavior.

## Before the demo

```bash
pnpm run start:all
```

Or the equivalent detached demo command:

```bash
pnpm run demo:up
```

When startup completes, the stack prints five URLs in demo order. Stop with `pnpm run demo:down`.
