# Civics Research Repository

Civics Research Repository is an independent **federal Open Science reference implementation** focused on the public research experience: accessible Angular discovery, provenance-aware research detail, geospatial analysis, reviewable evidence, and typed frontend/backend integration over a real mixed-authority corpus.

The browser application is intentionally designed as a **government-grade data discovery frontend**, not as a thin UI over one repository or search engine.

```text
Angular 22 / NgRx / RxJS / MapLibre
        |
        | generated typed REST contract
        v
Spring repository API
        |
        +--> DSpace
        +--> application PostgreSQL
        +--> Solr / OpenSearch
```

The UI owns interaction state, discovery workflows, presentation, accessibility and visualization. It does **not** call DSpace, Solr, OpenSearch or external publisher APIs directly.

This project is not affiliated with, endorsed by, or sponsored by the U.S. Census Bureau, USGS, DSpace, Apache Solr, Data.gov, DOE OSTI, or OpenSearch.

## What the frontend demonstrates

### Discovery that remains shareable and explainable

`/discovery` searches curated DSpace research objects and retained federated publisher metadata through one typed application contract while keeping provenance visible.

The Angular/NgRx workflow demonstrates:

- keyword search and data-driven facets;
- URL-owned query/filter/page state for reproducible links;
- loading, empty, error, fixture/degraded and pagination states;
- source system, origin, access level and authoritative-source presentation;
- bounded result pages rather than client-side million-record processing;
- keyboard-aware paging that restores focus to changed results;
- a context-preserving handoff from discovery into Maps.

The UI does not maintain a fixed allowlist for publisher program names. Values from the active search projection survive URL/deep-link round trips without being collapsed into a curated frontend enum.

### Research-object detail without repository coupling

Canonical `/research/:id` routing resolves either curated repository content or federated metadata behind the Spring API. Angular renders one typed research-object contract rather than deciding how DSpace or a publisher should be queried.

Curated records can expose repository-owned files, relationships, versions, citations and access statements. Federated records identify their external source/publisher and authoritative resource without implying that publisher files are preserved locally.

`/datasets/:id` remains a compatibility route.

### Maps where the canvas is not the accessibility model

`/maps` combines MapLibre visualization with equivalent semantic tables/lists driven from the same application state.

TIGER/Line geography, LODES workplace employment and commuting flows, SAIPE context, optional USGS reference layers and Data.gov spatial coverage can be explored without making WebGL the only way to obtain the underlying research values.

Selection, geography, layer state, URL context, announcements and semantic equivalents are coordinated through Angular/NgRx rather than through direct map-to-DOM coupling.

### Accessibility and evidence as product behavior

Accessibility is treated as an engineering artifact rather than a single axe score.

The repository includes:

- Angular/template accessibility rules;
- component-state tests for loading, failure, empty and restricted states;
- Storybook interaction + axe evidence;
- Playwright real-browser semantics and workflows;
- reflow, zoom, contrast, dark-mode and forced-colors checks;
- map-equivalence and keyboard preconditions;
- generated automated evidence;
- explicit manual keyboard/NVDA/JAWS/map/cognitive checklists that remain separate from automated passes.

The project does **not** represent automated evidence as completed manual Section 508 certification.

### Generated contracts instead of duplicated frontend DTOs

[`schemas/openapi/repository-api.yaml`](schemas/openapi/repository-api.yaml) is the browser/API contract source of truth. TypeScript client types and Java wire DTOs are generated from that contract, and CI rejects stale generated clients.

That boundary is especially important for provenance and evidence surfaces, where a missing or nullable field can change what the UI is allowed to claim.

See [Frontend Engineering Case Study](documentation/frontend-engineering-case-study.md) for the concrete Angular/NgRx/OpenAPI/accessibility decisions and implementation links.

## Primary demo paths

The portfolio-facing route order is intentionally frontend-first:

1. **Discovery** — search, facets, URL state and provenance;
2. **Research detail** — authority-neutral object presentation;
3. **Maps** — visual/nonvisual state equivalence;
4. **Evidence** — accessibility and scientific claim boundaries;
5. **Search Lab** — supporting Solr/OpenSearch engineering depth.

For interviews or stakeholder review, use the [5–8 minute frontend-first walkthrough](documentation/demo/frontend-first-walkthrough.md). The deeper [15–20 minute demo](documentation/demo/demo-script.md) remains available for repository, synchronization and search-architecture discussion.

## Scale validates the frontend; it does not define the product

The current certified C2 corpus is:

- **500,000 Data.gov + 500,000 DOE OSTI** retained federated records;
- **1,000,000** federated records in application PostgreSQL;
- **181** curated DSpace research objects;
- **1,000,181** normalized search documents in both Solr and OpenSearch;
- composition SHA `e2c7cceb641589715a6390cb35846a67d7361fb15ec00fe3445a3e0036a5524b`;
- projection ID `3d461a9feb49f7239f3f6aaacb0c90f1ff43d0c683238acc2202c841154db44d`.

The corpus composition identity is kept separate from the full search projection identity. DSpace records are excluded from the federated composition digest and included in the normalized search projection.

The exact C2 retained corpus is also captured as a verified host-backed Gold Master archive, so the million-record state can be restored without repeating the full external harvest.

### C2.1 adversarial Solr/OpenSearch evidence

The follow-on C2.1 experiment deliberately gave OpenSearch an optimized semantically equivalent treatment and required projection parity, balanced randomized engine order, independent warmed batches, clean restart blocks and an adversarial workload matrix.

Within the certified 1,000,181-object standalone Docker experiment:

- all **24/24 API-latency workload cells** had lower Solr batch-median latency;
- all **24/24 paired batch-level bootstrap intervals** excluded zero in Solr's direction;
- engine-reported timing showed the same 24/24 directional pattern;
- all result cells were retained; no unfavorable cell-removal rule was permitted.

The claim remains scoped to the exact corpus, engine versions, resources, mappings, treatment, workload and standalone topology. It is **not** a universal claim that Solr is faster than OpenSearch.

Historical C2 and adversarial C2.1 remain separate evidence layers in `/evidence`.

See [Federated Scale Evidence](documentation/federation/scale-evidence.md) and the Evidence UI for the measured storage, projection and search-research record.

## Architecture at a glance

```text
Public researcher / repository steward
                  |
                  v
Angular 22 + NgRx + RxJS + MapLibre
Discovery | Research detail | Maps | Evidence | Search Lab
                  |
                  | generated OpenAPI REST contract
                  v
Java 21 / Spring Boot repository-api
       |                 |                    |
       |                 |                    v
       |                 |                DSpace REST
       |                 |                curated system
       |                 |                of record
       |                 |
       v                 v
Application         Discovery projection
PostgreSQL          bounded normalized stream
federated metadata    /             \
+ evidence          Solr          OpenSearch
       ^               \             /
       |                derived search
       |
Federated publishers
Data.gov / DOE OSTI / later controlled sources
metadata + authoritative external links
```

DSpace PostgreSQL/Solr and application PostgreSQL/public search indexes have different owners and lifecycles. DSpace controls its internal database, Solr cores, repository metadata, relations, versions and bitstreams. The application controls operational/federated state and disposable public discovery projections.

## Search and repository ownership

Authority remains explicit:

- DSpace is authoritative for curated repository objects;
- external publishers are authoritative for federated records and downloadable resources;
- application PostgreSQL retains reproducible federated metadata, harvest checkpoints and evidence;
- Solr and OpenSearch are derived discovery projections.

Ordinary `repository-api` restarts do not reset a persisted large projection to the curated demo. Startup verifies the live Solr/OpenSearch counts against the durable activation record and rehydrates the active profile, projection ID and object count without rewriting the indexes.

For `FEDERATED_1M`, activation is also an API invariant: one million arbitrary rows is not sufficient. The server requires the exact 500K Data.gov + 500K DOE OSTI composite recipe.

The Admin data-flow view exposes **Authority → Retention → Projection**, and public Discovery surfaces the active corpus profile, projected document count and C2 identity so users can see what corpus a search is running against.

## Stack

- Angular 22, Angular Material, NgRx, RxJS, and MapLibre GL.
- Nx 23 for workspace orchestration.
- Java 21 and Spring Boot for the typed API, repository synchronization and federated harvesting.
- OpenAPI-generated TypeScript and Java DTOs.
- DSpace 9 as the curated repository system of record.
- Application PostgreSQL for sync state, federated metadata, harvest checkpoints/quarantine and evidence history.
- Apache Solr as the normal public search engine behind the `DiscoveryIndex` boundary.
- OpenSearch as the aligned comparison projection target for controlled evidence.
- Separate PostgreSQL/Solr ownership for application and DSpace runtimes.
- Docker Compose for the complete local platform and standalone scale baseline.
- Playwright, axe-core, Vitest/jsdom, Storybook and Browser Evidence CI.

## Current status

The core product and C2/C2.1 search-research program are implemented. Remaining work is concentrated in portfolio/frontend presentation and optional human assistive-technology evidence rather than proving the first million records again.

The generated repository/platform baseline is [documentation/platform-status.md](documentation/platform-status.md). It derives volatile curated-catalog, source-inventory, mirror, adapter-registry and accessibility facts from committed artifacts.

Heavy live scale facts are recorded separately because a million-record local corpus and its storage measurements are intentionally not committed to Git.

Use:

```bash
pnpm run docs:status
pnpm run docs:check
```

## Quick start

Requirements: Docker Desktop, Node 22, and pnpm 10.

```bash
cp .env.sample .env
pnpm install
pnpm run start:all
```

`start:all` starts the DSpace profile and application stack, waits for health checks, generates/seeds SAF packages when needed, and prints service URLs. Persistent application volumes preserve federated harvest/snapshot/evidence state across ordinary recreate/rebuild operations.

Primary endpoints:

| Service        | URL                                |
| -------------- | ---------------------------------- |
| Discovery UI   | `http://localhost:4200`            |
| Repository API | `http://localhost:8080/api`        |
| DSpace REST    | `http://localhost:8081/server/api` |
| Discovery Solr | `http://localhost:8983/solr`       |
| OpenSearch     | `http://localhost:9200`            |
| DSpace Solr    | `http://localhost:8984/solr`       |

If the Angular container is running but serving a stale/unresponsive UI, restart only that service:

```bash
docker compose restart discovery-ui
```

If a simple restart is insufficient:

```bash
docker compose up -d --force-recreate discovery-ui
```

Stop the full stack without deleting volumes:

```bash
pnpm run demo:down
```

Do not use the destructive `docker:reset:everything` command as an ordinary restart; it intentionally removes volumes.

## Useful commands

```bash
pnpm run start:all                 # complete local platform
pnpm run start:all:rebuild         # rebuild/recreate app stack while retaining volumes
pnpm run sync:diff                 # compare adapter metadata with DSpace
pnpm run sync:apply                # apply owned metadata changes
pnpm run reindex                   # rebuild the selected public discovery projection
pnpm run research:preflight        # non-mutating FEDERATED_1M/C2 readiness check
pnpm run research:report           # current FEDERATED_1M research report
pnpm run federation:sample:all     # bounded source-adapter sample verification
pnpm run evidence:refresh          # run and record automated accessibility evidence
pnpm run docs:status               # regenerate current platform status
pnpm run quality:all               # deterministic ordinary repository quality gate
```

Heavy harvest/projection/measurement operations remain explicit. Ordinary PR CI does not create or rerun the accepted 1M experiment.

## Documentation

- [Frontend engineering case study](documentation/frontend-engineering-case-study.md)
- [Frontend-first demo walkthrough](documentation/demo/frontend-first-walkthrough.md)
- [Current generated platform status](documentation/platform-status.md)
- [Federated scale evidence](documentation/federation/scale-evidence.md)
- [Architecture](documentation/architecture.md)
- [Architecture diagrams](documentation/architecture-diagrams.md)
- [Open Science research objects](documentation/open-science-research-objects.md)
- [Mapping and visualization](documentation/mapping-visualization.md)
- [Section 508 and WCAG evidence](documentation/accessibility-508-wcag.md)
- [Manual accessibility evidence](documentation/accessibility-manual-evidence.md)
- [Full interview/demo package](documentation/demo/README.md)
- [AWS modernization](documentation/aws-modernization.md)
- [Future roadmap](planning/ROADMAP.md)
- [Active backlog](planning/TODO.md)
- [Platform evolution](documentation/history/platform-evolution.md)
