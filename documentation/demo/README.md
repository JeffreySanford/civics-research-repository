# Interview Demo Package

Narrative artifacts for stakeholder demos, frontend interviews, Open Science modernization discussions, and deeper architecture review. The stack itself is delivered; these documents explain what to show, what to say, and how the pieces fit together.

## Recommended paths

Start with the frontend story unless the audience explicitly asks for repository/search internals:

- [Frontend-first walkthrough](frontend-first-walkthrough.md): **5–8 minute** Angular/NgRx/accessibility/product path through Discovery, research detail, Maps, Evidence and Search Lab.
- [Deep demo script](demo-script.md): **15–20 minute** walkthrough including synchronization, preservation, repository identity and architecture tradeoffs.

The short walkthrough is the default for frontend-heavy federal UI roles. Search-engine research is presented as supporting evidence rather than as the product itself.

## Supporting documents

- [Architecture walkthrough](architecture-walkthrough.md): system context, request flow, datastore roles, Docker ports, seed/sync/projection, fixture fallback.
- [Ingestion walkthrough](ingestion-walkthrough.md): how data moves from publisher URLs through SAF generation, DSpace seed, sync, and search projection.
- [Mapping and USGS walkthrough](mapping-usgs-walkthrough.md): MapLibre layers, accessible feature list, fixture vs live overlay data, North Dakota default geography.
- [Accessibility evidence walkthrough](accessibility-evidence-walkthrough.md): automated vs manual evidence, report commands, `/evidence` demo stop.
- [Tradeoffs](tradeoffs.md): architecture decisions and honest limits for interview Q&A.
- [Frontend engineering case study](../frontend-engineering-case-study.md): concrete Angular/NgRx/OpenAPI/accessibility decisions and implementation boundaries.

## Frontend ownership boundary

```text
Angular / NgRx / RxJS / MapLibre
        |
        | generated typed REST contract
        v
Spring repository API
        |
        +--> DSpace
        +--> application PostgreSQL
        +--> Solr / OpenSearch
```

The browser owns interaction state, discovery workflows, presentation, accessibility and visualization. It does not bind directly to DSpace, Solr or OpenSearch.

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

When startup completes, begin at `http://localhost:4200` or go directly to `/discovery` for the frontend-first path. Stop with `pnpm run demo:down`.
