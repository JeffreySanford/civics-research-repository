# Architecture

This document describes the architecture that runs today. Planned work is kept in [planning/ROADMAP.md](../planning/ROADMAP.md); historical delivery detail is kept in [history/platform-evolution.md](history/platform-evolution.md). Curated artifact-derived counts live in the generated [platform status](platform-status.md), while live federation-scale evidence is recorded in [PI-1 Data.gov Scale Evidence](../planning/PI1_DATA_GOV_SCALE_EVIDENCE.md).

## System purpose

Civics Research Repository is a federal Open Science reference platform. It preserves and relates curated research objects in DSpace, retains reproducible metadata and provenance for federated publisher records in application PostgreSQL, projects both origins into rebuildable public-search representations, and exposes accessible search, research-object detail, repository workflows, search-engine comparison, and geospatial research views through one typed API.

The platform is intentionally broader than an open-data catalog. It models:

- datasets,
- publications,
- methodology and supporting material,
- projects,
- researchers and DOI metadata,
- access restrictions and access instructions,
- typed relationships between curated research objects,
- source files, manifests, provenance, versions, and mirrored bitstreams,
- federated external-source metadata with publisher authority and stable namespaced identity.

## Current container architecture

```text
Public researcher / repository steward
                  |
                  v
Angular discovery-ui (:4200)
  - search, facets, paging and research-object detail
  - Search Lab: Solr/OpenSearch side-by-side comparison
  - workforce and reference mapping
  - admin synchronization, corpus/storage and evidence views
                  |
                  | REST/JSON, generated OpenAPI types
                  v
Spring Boot repository-api (:8080/api)
  - owns every browser-facing integration
  - curated metadata adapters and repository sync
  - federated source harvesters / durable checkpoints / quarantine
  - federated metadata and bounded snapshot evidence
  - authority-neutral research-object detail resolution
  - bounded combined repository + federated discovery catalog
  - deterministic streaming projection identity
  - independent Solr/OpenSearch projection targets
  - search, comparison, maps, overlays and evidence endpoints
        |                 |                    |                    |
        v                 v                    v                    v
Application          Solr discovery       OpenSearch           DSpace REST (:8081)
PostgreSQL            (:8983)              comparison (:9200)   curated repository authority
(:5432)               normal public        parallel target      communities, collections,
sync/federation       search projection    rebuildable          items, metadata, relations,
state + evidence                                               versions and bitstreams
     ^                                                              |              |
     |                                                              v              v
     |                                                       DSpace PostgreSQL   DSpace Solr
     |
Federated publishers
Data.gov / OSTI / CMR / PubMed / OpenAlex
metadata + authoritative external resource links
```

The Angular application never calls DSpace, Solr, OpenSearch or external publisher APIs directly. The Java API owns those integrations, keeps credentials and engine-specific behavior server-side, and presents one generated contract to the browser.

## Datastore and search roles

| Datastore or engine                     | Role                                                                                             | Owner                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Application PostgreSQL `civics_ops`     | Sync jobs, federated metadata, harvest runs/checkpoints/quarantine, snapshots and evidence state | `repository-api`                                     |
| DSpace PostgreSQL                       | Curated repository system of record                                                              | DSpace                                               |
| Discovery Solr `discovery` core         | Normal public, rebuildable mixed-origin discovery projection                                     | `repository-api` through `DiscoveryIndex`            |
| OpenSearch `discovery-comparison` index | Parallel rebuildable mixed-origin projection for controlled engine comparison                    | `repository-api` through `DiscoveryProjectionTarget` |
| DSpace Solr                             | DSpace internal discovery, authority and OAI cores                                               | DSpace                                               |

The duplication is an ownership boundary, not accidental redundancy. DSpace controls its own schema, migrations, search configuration, and upgrade lifecycle. Application-owned federated state and search projections can evolve or be rebuilt without treating DSpace's internal Solr as a public API or forcing external publisher records into DSpace.

## Architectural rules

### Authority is explicit by origin

Curated repository metadata, access statements, relationships, versions, files, and bitstreams belong in DSpace.

Federated records remain authoritative at their external publisher. The application retains searchable metadata, stable source identity, provenance, checkpoints and evidence; it does not claim publisher files are locally preserved merely because their metadata is searchable.

Search-engine indexes are derived state for both origins.

### Normalize once, project many — in bounded pages

`CombinedDiscoveryCatalog` composes curated DSpace-backed records and persisted federated records into bounded, deterministically ordered pages of engine-neutral `DiscoveryDocument` values.

`DiscoveryProjectionService` streams those pages through one deterministic SHA-256 digest and hands the same normalized batches to every active `DiscoveryProjectionTarget`. It does **not** require one whole-corpus `List<DiscoveryDocument>` before projection.

This prevents a Solr/OpenSearch comparison from quietly becoming a comparison of two different source datasets while keeping memory bounded for 100K/1M-class work.

Each target records its own most-recent projection outcome. A failure rebuilding one engine does not erase authoritative source state or prevent another configured target from being attempted.

### Projection identity is stronger than document count

Two indexes containing the same number of documents are not necessarily equivalent. Projection parity is verified only when:

- a current deterministic projection ID exists,
- each engine records a successful current projection,
- each engine records that same projection ID,
- each engine reports the expected normalized document count.

For bounded federation checkpoints, the project can also persist a guarded relationship between a deterministic source snapshot and the projection built from it. The linkage operation captures the source checkpoint, rebuilds discovery, rescans the source run and refuses to persist the relationship if the checkpoint changed during projection.

### The public query path and projection lifecycle are separate contracts

`DiscoveryProjectionTarget` represents a rebuildable destination. `DiscoveryIndex` extends it with browser-facing discovery query behavior.

Solr remains the current `DiscoveryIndex` implementation used by normal public discovery. OpenSearch implements the projection lifecycle and comparison query behavior without becoming a second public `DiscoveryIndex` bean. This keeps migration experimentation from silently changing production-shaped application routing.

The architecture therefore supports two different decisions independently:

1. **Can an engine receive and query an equivalent projection?**
2. **Should that engine become the normal browser-facing discovery implementation?**

The current OpenSearch work answers the first question; it does not presuppose the second.

### Research-object detail is authority-neutral

`/research/:id` is the canonical UI route. Route tokens are Base64URL-safe representations of canonical research identities. The API resolves the identity against federated metadata or curated repository content and returns one typed research-object detail contract.

`/datasets/:id` remains a compatibility route for existing links.

Federated detail:

- labels the object as federated,
- identifies the source system/publisher,
- links to the authoritative external resource,
- does not invent local versions, map layers or file preservation.

Curated repository detail retains DSpace-owned enrichments such as versions, files and repository-specific relationships.

### Browser integrations are typed and centralized

OpenAPI is the contract source of truth. TypeScript API types and Java wire DTOs are generated from the same schema. Browser code receives per-record origin/source provenance explicitly instead of guessing whether a result is repository-backed, federated or fixture-backed.

The comparison API returns both engine blocks in one typed response so one engine's failure does not mask useful evidence from the other.

### Accessibility is part of the architecture

The accessible table/list representation is generated from the same state as the map. Selection, URL state, announcements, layer visibility, and errors flow through NgRx rather than through direct map-to-DOM coupling.

Search and Search Lab follow the same rule: state, warnings, facets/aggregations, ranked results and provenance are exposed as semantic text/list structures and do not depend on color to communicate differences.

## Curated repository population and synchronization

There are two complementary curated-repository paths.

### Curated repository composition

`tools/dspace/catalog.json` declares which research objects belong in the reference repository. `generate-saf.mjs` resolves program templates and authored research objects into DSpace SAF packages. This path creates the broad curated catalog and the worked Open Science research package.

The catalog is deliberately curated. Publisher APIs and listings can verify file existence, dates, sizes, and vintages, but they cannot determine all curatorial relationships or decide that a publication, methodology report, project, public dataset, and restricted microdata form one research package.

### Runtime reconciliation

Registered Spring metadata adapters read catalog-backed definitions, verify publisher facts where available, normalize them as `ResearchObjectMetadata`, and reconcile synchronization-owned fields into DSpace. Startup, the admin UI, and command-line sync use the same `SyncService` path.

Synchronization guarantees:

- dry-run and diff do not write,
- apply is idempotent,
- only synchronization-owned fields are compared and changed,
- ambiguous DSpace matches fail instead of writing to the first search result,
- source identifier to DSpace identity is recorded where reconciliation applies,
- file manifests describe authoritative publisher files whether or not a bitstream is mirrored.

## Federated ingestion and evidence flow

Federated harvesting is a separate authority path from DSpace synchronization but remains inside the same Spring Boot application.

```text
External publisher API
        |
        v
FederatedSourceHarvester
 sourceSystem + adapterVersion
        |
        v
FederatedHarvestRunService
 durable run / page bound / retry / pause
        |
        +--> checkpoint cursor
        +--> accepted/rejected/skipped counters
        +--> bounded quarantine
        |
        v
FederatedMetadataCatalog (application PostgreSQL)
        |
        +--> deterministic bounded snapshot
        |
        v
CombinedDiscoveryCatalog
        |
        v
guarded projection rebuild
        |
        +--> Solr
        +--> OpenSearch
        |
        v
persisted snapshot <-> projection evidence
```

An operator-bound harvest that reaches `maxPages` is intentionally `PAUSED`, not falsely `COMPLETED`. Ordinary harvest calls resume a compatible paused run with the same page size, adapter version and cursor. Restart-from-beginning is deliberately separate and clears traversal state without deleting retained federated metadata.

The certified C2 corpus retains 500,000 Data.gov and 500,000 DOE OSTI federated records and projects them with 181 curated DSpace objects into the 1,000,181-document Solr/OpenSearch Gold Master. See the scale-evidence document for the exact corpus, archive, projection, restart-safety, and C2/C2.1 evidence.

## Discovery and comparison flow

```text
DSpace curated objects             FederatedMetadataCatalog
        |                                    |
        +----------------+-------------------+
                         |
                         v
              CombinedDiscoveryCatalog
                 bounded pages
                         |
                         v
              DiscoveryProjectionService
          streaming deterministic SHA-256
                 /                 \
                v                   v
       DiscoveryIndex / Solr     OpenSearch target
          normal search           comparison
                |                    |
                +--------+-----------+
                         |
        SearchService / SearchComparisonService
                         |
                         v
                 typed Spring API
                         |
                         v
               Angular Discovery/Search Lab
```

Normal public search uses Solr eDisMax relevance, field and phrase boosts, data-driven facets, paging, URL state, and mixed-origin metadata including publisher, source system, program name, subjects, authors, citation, DOI, geography, type, access level, and vintage where present.

The implemented OpenSearch comparison query uses weighted lexical matching, phrase boosts, structured filters, and self-excluding aggregations so equivalent user-visible facet behavior can be compared. OpenSearch field names remain engine-neutral rather than copying Solr suffix conventions.

A fixture catalog is available only as a labelled degradation path when neither authoritative repository nor federated content is available. Fixture-backed comparison remains useful for engine behavior but is not presented as authority-backed evidence.

The projection-level compatibility field currently reports `REPOSITORY` for any authority-backed projection, including mixed repository + federated corpora. Per-record `origin` and `sourceSystem` are therefore the authoritative provenance fields. Renaming/expanding the projection-level label is a contract-cleanup seam, not a record-correctness defect.

## What comparison timing means

Search Lab reports API elapsed time around each engine request. This is deliberately labelled local demo timing and is not a production benchmark.

Meaningful scale evidence should separate:

- harvest duration/throughput,
- projection duration,
- API elapsed time,
- Solr engine-native `QTime`,
- OpenSearch engine-native `took`,
- repeated-run p50/p95/p99 distributions,
- corpus/snapshot/projection identity,
- index/storage size,
- concurrency,
- host/container/JVM resources,
- shard/replica/node topology.

The comparison exists to evaluate functional semantics, operational fit, scaling behavior, resilience, analytics, and future vector/hybrid capabilities—not to force a predetermined performance winner.

## Geospatial and research-to-impact flow

The map workspace is a consumer of repository and public-source services, not the repository itself.

Current layers include:

- TIGER/Line boundaries,
- LODES workplace employment,
- LODES origin-destination commuting flows,
- SAIPE socioeconomic context,
- USGS 3D Hydrography Program reference data,
- USGS earthquake events.

The workforce journey begins in discovery, carries the selected geography into the map, opens with workforce layers visible, and links back to the originating research context. Map marks and accessible tables share selection state; hiding a layer clears incompatible selection; live regions announce meaningful changes.

## Preservation model

The repository uses bounded mirroring rather than either extreme of mirroring nothing or downloading every public archive.

- Curated metadata, authoritative source URLs, documentation, access statements, and file manifests are represented in DSpace.
- Eligible curated source files are mirrored into DSpace as real bitstreams within a bounded total-byte budget.
- Large or budget-exceeding curated artifacts remain authoritative links.
- Federated records retain publisher metadata/provenance and authoritative links without mirroring their underlying files merely for search scale.
- Evidence distinguishes subscribed, mirrored, curated, federated and indexed concepts rather than collapsing them into one storage claim.

## Accessibility and evidence architecture

```text
Angular template lint
        +
component-state/unit tests
        +
Java service/controller/request-semantics tests
        +
deterministic mocked Playwright scenarios
        +
real-browser WCAG/508 suites
        +
real-stack browser -> API -> Solr/OpenSearch smoke
        +
forced-colors / dark mode / reflow / contrast
        +
map-equivalence and keyboard preconditions
        |
        v
generated automated evidence record
        |
        v
API evidence manifest and Evidence page
        |
        v
manual keyboard / NVDA / JAWS / map / cognitive records
```

Evidence types are intentionally distinct:

- a unit/use-case test proves application logic under controlled dependencies,
- a mocked Playwright test proves deterministic browser workflow against a known contract response,
- an axe scan proves only detectable automated rules in that rendered state,
- a real-stack smoke test proves the browser/API/live-engine integration path,
- manual keyboard/screen-reader evidence proves interactions automation cannot responsibly claim.

An automated pass is not presented as full Section 508 conformance.

## Testing-first rule

New federation, comparison or scale capability should not outrun its evidence.

Normal CI uses small deterministic fixtures. Heavy 10K/100K/1M work is manual/scheduled evidence tied to deterministic snapshot/projection identity; full corpora are not committed merely to make CI look production-sized.

A test file existing in the repository is not enough; CI must actually execute the relevant normal evidence path, while heavy scale evidence must record the runtime context that CI cannot economically reproduce.

## Deployment direction

Docker Compose is the implemented platform, demo environment, and reproducible standalone baseline used by C2/C2.1. The proposed local Kubernetes/SolrCloud/OpenSearch laboratory is not an active completion requirement; that issue was closed `not_planned`. Production-shaped AWS topology and infrastructure-as-code remain deliberate future work if a deployment target requires them.

A production search-engine decision must include topology, persistent storage, backup/rebuild strategy, availability, cost, observability, security, index migration/alias strategy and operational ownership. Local single-node timing does not make that decision.

## Current seams

The foundation architecture, exact million-record C2 baseline, adversarial C2.1 search comparison, Maps research workflow, generated API boundary, and automated browser/accessibility evidence are implemented.

Frontend mission alignment and portfolio presentation are implemented alongside the foundation architecture, exact million-record C2 baseline, adversarial C2.1 search comparison, Maps research workflow, generated API boundary, and automated browser/accessibility evidence.

Remaining work is intentionally narrow:

1. record manual keyboard/NVDA/JAWS/map/cognitive evidence under issue #49 when human AT verification is required;
2. reconcile generated planning/status documentation after the final frontend merge;
3. treat additional federation sources or production-cloud topology as deliberate future work rather than prerequisites for the completed reference implementation.

Kubernetes experimentation is not an active completion requirement. The prior Kubernetes laboratory issue was closed `not_planned`; the implemented Docker Compose topology remains the reproducible local platform and the scoped C2/C2.1 research environment.
