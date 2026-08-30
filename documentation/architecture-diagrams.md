# Architecture Diagrams

These diagrams describe the current implementation. Planned work is not drawn as if it exists; open seams are listed at the end. Curated volatile counts are generated in [platform-status.md](platform-status.md), while live federation-scale facts are recorded in [PI-1 Data.gov Scale Evidence](../planning/PI1_DATA_GOV_SCALE_EVIDENCE.md).

## C4 Level 1 — System context

```mermaid
flowchart TB
    researcher["Public researcher<br/>Finds, evaluates, cites and explores federal research"]
    steward["Repository steward<br/>Reviews synchronization, harvests, repository state and evidence"]

    crr["Civics Research Repository<br/>Federal Open Science reference platform<br/>curated repository + federated metadata,<br/>discovery, accessible geospatial analysis and evidence"]

    census["U.S. Census Bureau / LEHD<br/>Curated datasets, files, listings and documentation"]
    usgs["U.S. Geological Survey<br/>Curated/reference data and event services"]
    datagov["Data.gov<br/>Federated metadata publisher/catalog"]
    future["OSTI / NASA CMR / PubMed / OpenAlex<br/>Planned PI-1 federated metadata sources"]

    researcher -->|Search, browse, cite, compare, map| crr
    steward -->|Sync, harvest, reindex, review evidence| crr
    crr -->|Verify curated source facts and retrieve public data| census
    crr -->|Retrieve reference/event data| usgs
    crr -->|Harvest metadata and authoritative links| datagov
    crr -.->|Same federated harvester contract in PI-1| future
```

The local demo is unauthenticated. Before deployment, steward actions require an authorization boundary; public discovery remains anonymous.

## C4 Level 2 — Containers

```mermaid
flowchart TB
    researcher["Public researcher"]
    steward["Repository steward"]

    subgraph app["Civics Research Repository"]
        ui["discovery-ui<br/>Angular 22, Material, NgRx, MapLibre<br/>discovery, research objects, maps,<br/>admin workflows and evidence<br/>:4200"]
        api["repository-api<br/>Java 21 / Spring Boot<br/>typed API, repository sync, federated harvest,<br/>combined projection, maps and evidence<br/>:8080/api"]
        ops[("PostgreSQL civics_ops<br/>sync jobs, federated metadata,<br/>runs/checkpoints/quarantine/snapshots/evidence<br/>:5432")]
        solr[("DiscoveryIndex / Solr<br/>normal public mixed-origin projection<br/>:8983")]
        os[("OpenSearch<br/>parallel comparison projection<br/>:9200")]
    end

    subgraph dspace["DSpace 9 platform"]
        rest["DSpace REST<br/>curated communities, collections, items,<br/>metadata, relations and bitstreams<br/>:8081/server"]
        db[("DSpace PostgreSQL<br/>curated repository system of record<br/>:5433")]
        internal[("DSpace Solr<br/>internal discovery and OAI cores<br/>:8984")]
    end

    curated["Census / USGS curated public sources"]
    datagov["Data.gov federated catalog"]

    researcher -->|HTTPS| ui
    steward -->|HTTPS| ui
    ui -->|Generated OpenAPI client| api
    api -->|JDBC| ops
    api -->|DiscoveryIndex operations| solr
    api -->|ProjectionTarget operations| os
    api -->|REST and JSON Patch| rest
    api -->|HTTPS source verification/data retrieval| curated
    api -->|Bounded resumable metadata harvest| datagov
    rest --> db
    rest --> internal
```

## Authority model

```mermaid
flowchart LR
    dspace["DSpace<br/>authoritative curated repository objects"]
    publisher["External publisher<br/>authoritative federated record/resources"]
    fed[("Application PostgreSQL<br/>reproducible federated metadata,<br/>checkpoint + evidence state")]
    combined["CombinedDiscoveryCatalog<br/>bounded deterministic pages"]
    solr["Solr<br/>derived public projection"]
    os["OpenSearch<br/>derived comparison projection"]

    publisher -->|metadata + stable source identity| fed
    dspace --> combined
    fed --> combined
    combined --> solr
    combined --> os
```

Search indexes are never authoritative. Federated records do not become DSpace items merely because they are searchable.

## Curated repository composition and reconciliation

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

The curated composition path remains separate from federated metadata harvesting. Publisher facts can be discovered; repository composition and typed research-package relationships remain curated.

## Federated harvest and scale-evidence path

```mermaid
sequenceDiagram
    autonumber
    actor steward as Operator
    participant api as Federation admin API
    participant run as FederatedHarvestRunService
    participant source as Data.gov
    participant ops as Application PostgreSQL
    participant snapshot as BoundedSnapshot service
    participant projection as DiscoveryProjectionService
    participant solr as Solr
    participant os as OpenSearch

    steward->>api: POST bounded harvest(pageSize, maxPages)
    api->>run: start or resume compatible durable run
    loop bounded pages
        run->>source: Fetch page using opaque cursor
        source-->>run: Publisher metadata + next cursor
        run->>ops: Persist normalized records + checkpoint + counters
    end
    run->>ops: Persist PAUSED/COMPLETED run state

    steward->>snapshot: Capture deterministic bounded snapshot
    snapshot->>ops: Persist snapshot identity + counters + cursor/window

    steward->>projection: Guarded snapshot -> projection
    projection->>ops: Capture checkpoint before projection
    projection->>projection: Stream CombinedDiscoveryCatalog pages + SHA-256 digest
    projection->>solr: Bounded normalized batches
    projection->>os: Same normalized batches
    projection->>ops: Re-read checkpoint after projection
    alt checkpoint unchanged
        projection->>ops: Persist snapshot/projection relationship
    else checkpoint drifted
        projection-->>steward: Reject linkage; do not claim evidence
    end
```

A bounded `PAUSED` run is expected when the operator limit is reached. Ordinary harvest calls resume the same compatible run/cursor; restart-from-beginning is deliberately separate.

## Mixed-origin search and faceted discovery

```mermaid
sequenceDiagram
    autonumber
    actor researcher as Public researcher
    participant ui as Angular discovery UI
    participant effects as NgRx effects
    participant api as repository-api
    participant solr as DiscoveryIndex / Solr

    researcher->>ui: Search, facet or page
    ui->>ui: Persist query state in URL
    ui->>effects: searchSubmitted
    effects->>api: GET /api/search
    api->>solr: eDisMax query + source/publisher/program/etc filters
    solr-->>api: Ranked mixed-origin documents + facet counts
    api-->>effects: SearchResponse with per-record origin/sourceSystem
    effects->>ui: searchLoaded
    ui-->>researcher: Results, reversible facets and provenance-aware links
```

The source/publisher/program facets are response-driven. Federated publisher program values do not require a Java enum or fixed Angular allowlist.

If neither DSpace nor the federated metadata catalog has authoritative content, fixture content may be used only with explicit fixture provenance.

## Authority-neutral research-object detail

```mermaid
sequenceDiagram
    autonumber
    actor researcher as Public researcher
    participant ui as Angular /research/:id
    participant api as ResearchObjectController
    participant service as ResearchObjectService
    participant fed as FederatedMetadataCatalog
    participant dspace as DSpace-backed DatasetService

    researcher->>ui: Open research-object result
    ui->>api: GET canonical research object by route token
    api->>service: Decode canonical identity
    service->>fed: findById(canonicalId)
    alt Federated record exists
        fed-->>service: Federated metadata + publisher authority
        service-->>ui: FEDERATED detail + authoritative external link
    else Curated repository identity
        service->>dspace: Resolve repository object
        dspace-->>service: DSpace-owned detail / files / versions / relationships
        service-->>ui: REPOSITORY detail
    end
```

`/datasets/:id` remains a compatibility UI route. Federated detail does not invent local versions, map layers or file preservation.

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

## Accessibility and browser evidence

```mermaid
sequenceDiagram
    autonumber
    actor engineer as Engineer
    participant refresh as evidence:refresh / Browser Evidence
    participant component as Component accessibility suite
    participant browser as Playwright report suites
    participant live as Live Spring + Solr/OpenSearch smoke
    participant record as automated-scans/latest.json

    engineer->>refresh: Run deterministic evidence
    refresh->>component: State-specific axe checks
    component-->>refresh: Pass or fail
    refresh->>browser: Chromium / Firefox / WebKit workflows
    browser-->>refresh: Pass or fail
    refresh->>live: Independent live-stack smoke
    live-->>refresh: Browser -> API -> search-engine result
    alt Every required refresh suite passes
        refresh->>record: Write commit/date-bound automated evidence
    else Any refresh suite fails
        refresh-->>engineer: Fail without replacing known-good evidence
    end
```

Manual keyboard, NVDA, JAWS, map-equivalence and cognitive records remain outside this automated sequence.

## Current seams

- Data.gov 10K harvest/resume is proven; 10K snapshot/projection/search/storage/resource evidence is still being closed before 100K.
- DOE OSTI, NASA CMR, PubMed and OpenAlex adapters remain PI-1 work.
- DOI/PMID/other durable-identifier reconciliation remains open; title-based silent merging is forbidden.
- Public discovery still uses offset paging; opaque cursor/search-after migration remains open for million-record scale.
- Live Data.gov program values can be opaque codes such as `010:10`; presentation hardening must preserve raw source semantics and avoid fixed UI allowlists.
- Projection-level compatibility `REPOSITORY` can represent a mixed authority-backed corpus; per-record `origin` and `sourceSystem` are correct, but the aggregate label may be clarified later.
- Bitstream mirroring remains bounded by budget rather than complete.
- Manual assistive-technology and trusted map-click evidence is not yet fully recorded.
- Browser evidence exists; required-check/branch-protection governance remains open.
- AWS architecture is documented but is intentionally deferred until PI-2 local Kubernetes evidence informs the implementation candidate.
