# Architecture Diagrams

C4 context and container views plus the three sequences that carry the demo: public dataset ingestion, search and faceted discovery, and dataset map rendering.

These diagrams describe **what runs today**, not the target state. Where the implementation is still fixture-backed, the diagram says so rather than drawing the intended arrow. Planned-but-absent paths are drawn as dashed lines and labelled `planned`. See [Known Seams](#known-seams) for the list and [planning/TODO.md](../planning/TODO.md) for the work that closes them.

## C4 Level 1 - System Context

```mermaid
flowchart TB
    researcher["Public Researcher<br/><i>Person</i><br/>Finds and cites public<br/>federal research datasets"]
    steward["Repository Steward<br/><i>Person</i><br/>Triggers and reviews<br/>metadata synchronization"]

    crr["Civics Research Repository<br/><i>Software System</i><br/>Accessible discovery, dataset detail,<br/>geospatial visualization, and<br/>repository synchronization for<br/>public federal research data"]

    census["U.S. Census Bureau<br/><i>External System</i><br/>TIGER/Line, LODES, ACS PUMS,<br/>SIPP, CPS public data and<br/>documentation"]
    usgs["U.S. Geological Survey<br/><i>External System</i><br/>Earthquake Hazards Program<br/>GeoJSON feed and<br/>National Map services"]

    researcher -->|"Searches, browses,<br/>views maps"| crr
    steward -->|"Runs dry-run, diff,<br/>and apply sync"| crr
    crr -->|"Reads public metadata<br/>and source links"| census
    crr -->|"Reads live earthquake<br/>overlay data"| usgs
```

The system is unauthenticated in the local demo. Both people are roles rather than accounts; see [planning/DECISIONS.md](../planning/DECISIONS.md) under "Admin API Authentication" for what changes before deployment.

## C4 Level 2 - Containers

```mermaid
flowchart TB
    researcher["Public Researcher"]
    steward["Repository Steward"]

    subgraph crr["Civics Research Repository"]
        ui["discovery-ui<br/><i>Angular 22, NgRx, MapLibre GL</i><br/>Search, dataset detail, maps,<br/>admin sync, evidence<br/>:4200"]
        api["repository-api<br/><i>Java 21, Spring Boot</i><br/>Search, datasets, maps, overlays,<br/>sync orchestration<br/>:8080/api"]
        opsdb[("PostgreSQL<br/><i>application database</i><br/>sync_jobs<br/>:5432")]
        discovery[("Solr<br/><i>discovery core</i><br/>Public discovery projection<br/>:8983")]
    end

    subgraph dspace["DSpace Platform (optional 'dspace' Compose profile)"]
        dsrest["DSpace REST<br/><i>DSpace 9.0</i><br/>Communities, collections, items,<br/>metadata, bitstreams<br/>:8081/server"]
        dsdb[("PostgreSQL<br/><i>DSpace database</i><br/>Repository system of record<br/>:5433")]
        dssolr[("Solr<br/><i>DSpace cores</i><br/>DSpace internal discovery<br/>:8984")]
    end

    census["U.S. Census Bureau"]
    usgs["U.S. Geological Survey"]

    researcher -->|HTTPS| ui
    steward -->|HTTPS| ui
    ui -->|"JSON/REST<br/>generated OpenAPI types"| api

    api -->|"Reads/writes sync job state<br/>JDBC"| opsdb
    api -->|"Queries and indexes<br/>research objects<br/>HTTP"| discovery
    api -->|"Discovery search and<br/>item metadata PATCH<br/>REST + JSON Patch"| dsrest
    api -->|"Live earthquake GeoJSON<br/>HTTPS, fixture fallback"| usgs

    dsrest --> dsdb
    dsrest --> dssolr

    api -->|"Projects repository items<br/>into the discovery core"| discovery
    api -.->|"planned: harvest live<br/>source metadata"| census
```

### Why two PostgreSQL instances and two Solr instances

This is the most common question the diagram raises, and the current naming does not answer it well. The four datastores serve two different jobs:

| Container                                        | Role                                                                | Owner            |
| ------------------------------------------------ | ------------------------------------------------------------------- | ---------------- |
| Application PostgreSQL (`postgres`, :5432)       | Application operational state — currently only `sync_jobs`          | `repository-api` |
| DSpace PostgreSQL (`dspace-postgres`, :5433)     | Repository system of record — items, metadata, bitstreams, workflow | DSpace           |
| Discovery Solr (`solr`, core `discovery`, :8983) | Public discovery projection queried by the API                      | `repository-api` |
| DSpace Solr (`dspace-solr`, :8984)               | DSpace's own internal search and OAI cores                          | DSpace           |

Both PostgreSQL databases are currently named `dspace`, which makes the split harder to read than it needs to be. Renaming the application database to `civics_ops` is an accepted decision that has not yet been applied — see [planning/DECISIONS.md](../planning/DECISIONS.md) under "Datastore Roles and Naming".

## Sequence - Public Dataset Ingestion

`pnpm run sync:apply`, or `POST /api/admin/sync` with `mode: APPLY`. Dry-run and diff share this path and stop before the write.

```mermaid
sequenceDiagram
    autonumber
    actor steward as Repository Steward
    participant api as repository-api
    participant adapter as TigerLineMetadataAdapter
    participant mapper as DspaceItemPayloadMapper
    participant client as DspaceRestClient
    participant dspace as DSpace REST
    participant store as sync_jobs (PostgreSQL)

    steward->>api: POST /api/admin/sync {mode, source}
    api->>store: Save job as RUNNING
    api->>adapter: firstVisualSlice()
    adapter-->>api: PublicDatasetMetadata (static source constants)
    api->>mapper: toItemPayload(metadata)
    mapper-->>api: DspaceItemPayload (dc.* and crr.* fields)

    Note over api,dspace: DIFF and APPLY read current DSpace state first

    api->>client: findItem(sourceIdentifier, expectedTitle)
    client->>dspace: GET /api/discover/search/objects?query=...
    dspace-->>client: Relevance-ranked discovery results
    client->>client: DspaceItemMatcher.selectTargetItem

    alt Item claimed by matching dc.identifier.other
        client-->>api: The one target item
    else Unclaimed item with exact title match
        client-->>api: Adoptable seed item
    else Two or more plausible items
        client-->>api: AmbiguousDspaceItemException
        api->>store: Save job as FAILED
    end

    alt mode = APPLY and metadata differs
        api->>client: patchItemMetadata(uuid, operations)
        client->>dspace: POST /api/authn/login (admin from .env)
        dspace-->>client: Bearer token + CSRF token
        client->>dspace: PATCH /api/core/items/{uuid} (JSON Patch)
        dspace-->>client: 200 OK
    else Metadata already current
        Note over api: No write. Apply is idempotent.
    end

    api->>store: Save job as APPLIED / DIFF_COMPLETE / DRY_RUN_COMPLETE
    api-->>steward: SyncJob with planned and executed actions
```

Two properties this sequence is designed to guarantee:

- **It never guesses which item to write to.** Discovery is relevance-ranked, so an unqualified first result is not a safe write target. Ambiguity fails the job.
- **A second identical apply performs no write.** Metadata is compared as unordered value/language pairs, because DSpace orders repeated values by `place` and that order need not match adapter order.

Not yet implemented: bitstream and file-manifest reconciliation. `sync:diff` therefore still reports `UPDATE_ITEM` rather than `SKIP_ITEM` for the seeded item.

## Sequence - Search and Faceted Discovery

```mermaid
sequenceDiagram
    autonumber
    actor researcher as Public Researcher
    participant ui as discovery-ui
    participant effects as SearchEffects (NgRx)
    participant api as repository-api
    participant service as SearchService
    participant solr as Solr discovery core

    researcher->>ui: Enters terms / selects a facet
    ui->>ui: Write query into URL parameters
    ui->>effects: SearchActions.searchSubmitted({query})
    effects->>api: GET /api/search?q&program&geography&vintageYear&page&pageSize
    api->>service: search(...)

    alt Solr configured and reachable
        service->>solr: GET /solr/discovery/select (edismax, facet.field)
        Note right of service: Filter values are escaped before<br/>interpolation into the fq phrase
        solr-->>service: Documents + facet counts
    else Solr disabled or failing
        Note over service: Falls back to the in-memory seed list<br/>so the demo degrades instead of erroring
    end

    service-->>api: SearchResponse (results + facet groups)
    api-->>effects: 200 JSON
    effects->>ui: SearchActions.searchLoaded({response})
    ui->>researcher: Results, facet counts, and loading/empty/error states
```

The `discovery` core is populated by `DiscoveryProjectionService` from DSpace items, so both the Solr path and the in-memory path serve repository content. When the repository returns nothing — DSpace down, unseeded, or genuinely empty — the fixture catalog is indexed instead and every response carries `resultSource: FIXTURE`, which the UI displays as a placeholder-data notice. Rebuild the projection at any time with `pnpm run reindex`.

## Sequence - Dataset Map Rendering with USGS Overlay

```mermaid
sequenceDiagram
    autonumber
    actor researcher as Public Researcher
    participant ui as discovery-ui (MapLibre GL)
    participant effects as MapsEffects (NgRx)
    participant api as repository-api
    participant usgs as USGS Earthquake Catalog

    researcher->>ui: Opens /maps or a dataset Map tab
    ui->>effects: MapsActions.mapOpened()

    par Census layers and boundaries
        effects->>api: GET /api/datasets/{id}/map-layers
        effects->>api: GET /api/maps/census-areas
        api-->>effects: Layer definitions + boundary extents
        effects->>ui: mapDataLoaded({layers, censusAreaBoundaries})
    and USGS overlay
        effects->>api: GET /api/overlays/usgs/earthquakes?minMagnitude&days
        api->>usgs: GET /fdsnws/event/1/query (bounded, max 25 features)
        alt Live feed responds
            usgs-->>api: GeoJSON features
        else Timeout, error, or empty result
            Note over api: Returns the bundled fixture with<br/>fallback = true and a stale-after timestamp
        end
        api-->>effects: UsgsEarthquakeOverlay
        effects->>ui: earthquakeOverlayLoaded({earthquakeOverlay})
    end

    ui->>ui: Render layers, legend, attribution, timestamp
    ui->>ui: Render the accessible feature list from the same data
    ui->>researcher: Map plus keyboard-operable layer toggles
    researcher->>ui: Toggles a layer
    ui->>ui: Reflect toggle state in the URL
```

The two effects are deliberately independent: a USGS outage degrades the overlay to an error or stale state while the Census layers stay usable. Accessibility requirements carried by this sequence — the feature list rendered from the same data as the map, the non-color-only legend, visible attribution and update timestamp, and keyboard-operable toggles — are specified in [mapping-visualization.md](mapping-visualization.md) and verified in the storyboard and WCAG suites.

## Known Seams

Places where the implementation is narrower than the architecture. Each is tracked in [planning/TODO.md](../planning/TODO.md).

1. **Source metadata is static.** `TigerLineMetadataAdapter` returns compile-time constants rather than harvesting Census.
2. **Bitstream reconciliation is absent.** Sync reconciles Dublin Core and `crr.*` metadata only, so `sync:diff` reports `UPDATE_ITEM` rather than `SKIP_ITEM`.
3. **Application database naming is ambiguous.** Both PostgreSQL databases are named `dspace`.
4. **`start:all` does not include DSpace.** The DSpace profile must be started separately, so there is no single command that brings up the whole demo.
5. **Only the TIGER/Line North Dakota item is synchronized.** The other five seeded items are imported by the DSpace seed and read back through discovery, but no adapter reconciles them.

Closed: discovery and dataset detail are now served from DSpace. The fixture catalog remains only as a labelled fallback.
