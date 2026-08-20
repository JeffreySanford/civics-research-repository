# Architecture Diagrams

These diagrams describe the current implementation. Planned work is not drawn as if it exists; open seams are listed at the end. Volatile counts are generated in [platform-status.md](platform-status.md).

## C4 Level 1 — System context

```mermaid
flowchart TB
    researcher["Public researcher<br/>Finds, evaluates, cites and explores federal research"]
    steward["Repository steward<br/>Reviews synchronization, repository state and evidence"]

    crr["Civics Research Repository<br/>Federal Open Science reference platform<br/>repository, discovery, research relationships,<br/>accessible geospatial analysis and evidence"]

    census["U.S. Census Bureau / LEHD<br/>Public datasets, files, listings and documentation"]
    usgs["U.S. Geological Survey<br/>Hydrography, elevation/reference and event services"]

    researcher -->|Search, browse, cite, compare, map| crr
    steward -->|Dry-run, diff, apply, reindex, review evidence| crr
    crr -->|Verify public source facts and retrieve public data| census
    crr -->|Retrieve reference and event layers| usgs
```

The local demo is unauthenticated. Before deployment, steward actions require an authorization boundary; public discovery remains anonymous.

## C4 Level 2 — Containers

```mermaid
flowchart TB
    researcher["Public researcher"]
    steward["Repository steward"]

    subgraph app["Civics Research Repository"]
        ui["discovery-ui<br/>Angular 22, Material, NgRx, MapLibre<br/>discovery, research objects, maps,<br/>admin workflows and evidence<br/>:4200"]
        api["repository-api<br/>Java 21 / Spring Boot<br/>typed API, adapter registry, sync,<br/>projection, maps and evidence<br/>:8080/api"]
        ops[("PostgreSQL civics_ops<br/>sync jobs and operational state<br/>:5432")]
        index[("DiscoveryIndex<br/>Apache Solr discovery core<br/>rebuildable public projection<br/>:8983")]
    end

    subgraph dspace["DSpace 9 platform"]
        rest["DSpace REST<br/>communities, collections, items,<br/>metadata, relations and bitstreams<br/>:8081/server"]
        db[("DSpace PostgreSQL<br/>repository system of record<br/>:5433")]
        internal[("DSpace Solr<br/>internal discovery and OAI cores<br/>:8984")]
    end

    census["Census / LEHD public sources"]
    usgs["USGS public services"]

    researcher -->|HTTPS| ui
    steward -->|HTTPS| ui
    ui -->|Generated OpenAPI client| api
    api -->|JDBC| ops
    api -->|DiscoveryIndex operations| index
    api -->|REST and JSON Patch| rest
    api -->|HTTPS source verification and data retrieval| census
    api -->|HTTPS reference/event retrieval| usgs
    rest --> db
    rest --> internal
```

## Repository composition and reconciliation

```mermaid
sequenceDiagram
    autonumber
    actor steward as Repository steward
    participant catalog as catalog.json
    participant generator as generate-saf.mjs
    participant dspace as DSpace
    participant registry as Metadata adapter registry
    participant publisher as Census / USGS publisher
    participant sync as SyncService
    participant ops as civics_ops

    Note over catalog,dspace: Curated composition path
    generator->>catalog: Read enabled programs and authored research objects
    generator->>generator: Resolve templates, types, access, authors, relations and file manifests
    generator->>dspace: Import idempotent SAF packages by collection

    Note over registry,ops: Runtime reconciliation path
    steward->>sync: DRY_RUN / DIFF / APPLY
    sync->>registry: Select one adapter or all registered adapters
    registry->>catalog: Read catalog-backed definitions
    registry->>publisher: Verify reachable facts where supported
    publisher-->>registry: Size, date, listing/vintage or public data response
    registry-->>sync: Normalized ResearchObjectMetadata
    sync->>dspace: Resolve recorded source identity and read current metadata
    sync->>sync: Compare synchronization-owned fields only
    alt APPLY and fields differ
        sync->>dspace: JSON Patch owned metadata
    else No difference
        sync->>sync: SKIP_ITEM
    end
    sync->>ops: Persist job, action and outcome
```

The two paths are complementary. Publisher facts can be discovered; repository composition and typed research-package relationships remain curated.

## Search and faceted discovery

```mermaid
sequenceDiagram
    autonumber
    actor researcher as Public researcher
    participant ui as Angular discovery UI
    participant effects as NgRx effects
    participant api as repository-api
    participant dspace as DSpace REST
    participant projection as DiscoveryProjectionService
    participant index as DiscoveryIndex / Solr

    Note over dspace,index: Reindex path
    projection->>dspace: Read repository research objects
    dspace-->>projection: Metadata, types, access, authors, relations and files
    projection->>index: Replace rebuildable public projection

    Note over researcher,index: Query path
    researcher->>ui: Search, facet or page
    ui->>ui: Persist query state in URL
    ui->>effects: searchSubmitted
    effects->>api: GET /api/search
    api->>index: eDisMax query, filters, facets and paging
    index-->>api: Ranked documents and counts
    api-->>effects: SearchResponse with resultSource
    effects->>ui: searchLoaded
    ui-->>researcher: Results, reversible facets, range and provenance notice
```

If the repository path is unavailable, fixture content may be used only with `resultSource: FIXTURE` and a visible notice.

## Discovery to workforce map

```mermaid
sequenceDiagram
    autonumber
    actor researcher as Public researcher
    participant discovery as Discovery page
    participant maps as Maps NgRx feature
    participant api as repository-api
    participant census as Census / LEHD sources
    participant usgs as USGS services

    researcher->>discovery: Search for an area and workforce topic
    discovery->>maps: Navigate with geography, research context and workforce layer state
    par Geography and workforce data
        maps->>api: Area boundaries and map-layer definitions
        maps->>api: LODES WAC workplace employment
        maps->>api: LODES OD commuting flows
        api->>census: Retrieve/aggregate published data where feasible
        census-->>api: Public source records
    and Context layers
        maps->>api: SAIPE and optional USGS layers
        api->>usgs: Hydrography or earthquake requests
        usgs-->>api: Reference/event data or explicit fallback/error state
    end
    api-->>maps: Typed layer and feature payloads with provenance
    maps->>maps: Render map and equivalent tables/lists from shared state
    researcher->>maps: Select from map or table, toggle layer, change area
    maps->>maps: Synchronize selection, URL, focus and live-region announcement
```

## Accessibility evidence refresh

```mermaid
sequenceDiagram
    autonumber
    actor engineer as Engineer
    participant refresh as evidence:refresh
    participant component as Component accessibility suite
    participant browser as Playwright report suites
    participant record as automated-scans/latest.json
    participant manifest as API evidence manifest

    engineer->>refresh: pnpm run evidence:refresh
    refresh->>component: Run state-specific axe checks
    component-->>refresh: Pass or fail
    refresh->>browser: Run storyboard, WCAG and Section 508 suites
    browser-->>refresh: Pass or fail
    alt Every automated suite passes
        refresh->>record: Write commit- and date-bound evidence
        refresh->>manifest: Regenerate API manifest
    else Any suite fails
        refresh-->>engineer: Fail without replacing known-good evidence
    end
```

Manual keyboard, NVDA, JAWS, map-equivalence and cognitive records remain outside this automated sequence.

## Current seams

- The catalog is curated; publisher listing and vintage checks support it but do not automatically redefine repository composition.
- Bitstream mirroring is bounded by budget rather than complete.
- Curated research-package objects intentionally do not pretend to have publisher-derived adapter identities.
- Manual assistive-technology and trusted map-click evidence is not yet recorded.
- The full browser-evidence matrix is not yet a required CI check.
- AWS architecture is documented but not expressed as Terraform/CDK.
- Some route names and residual UI copy remain dataset-shaped while the domain model is research-object-shaped.
