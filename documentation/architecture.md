# Architecture

This document describes the architecture that runs today. Planned work is kept in [planning/ROADMAP.md](../planning/ROADMAP.md); historical delivery detail is kept in [history/platform-evolution.md](history/platform-evolution.md). Current volatile counts live in the generated [platform status](platform-status.md).

## System purpose

Civics Research Repository is a federal Open Science reference platform. It preserves and relates research objects in DSpace, projects them into a public discovery index, and exposes accessible search, repository workflows, and geospatial research views through a single typed API.

The platform is intentionally broader than an open-data catalog. It models:

- datasets,
- publications,
- methodology and supporting material,
- projects,
- researchers and DOI metadata,
- access restrictions and access instructions,
- typed relationships between research objects,
- source files, manifests, provenance, versions, and mirrored bitstreams.

## Current container architecture

```text
Public researcher / repository steward
                  |
                  v
Angular discovery-ui (:4200)
  - search, facets, paging and research-object detail
  - workforce and reference mapping
  - admin synchronization and repository/index views
  - accessibility and pipeline evidence
                  |
                  | REST/JSON, generated OpenAPI types
                  v
Spring Boot repository-api (:8080/api)
  - owns every browser-facing integration
  - catalog-backed metadata adapters
  - dry-run / diff / apply synchronization
  - DSpace identity and repository projection
  - search, maps, overlays and evidence endpoints
        |                 |                    |
        v                 v                    v
Application          DiscoveryIndex         DSpace REST (:8081)
PostgreSQL            Solr implementation    repository system of record
(:5432)               (:8983)                communities, collections,
sync jobs             rebuildable            items, metadata, relations,
                                            versions and bitstreams
                                                 |              |
                                                 v              v
                                        DSpace PostgreSQL   DSpace Solr
                                        (:5433)             (:8984)
```

The Angular application never calls DSpace, Solr, Census, or USGS directly. The Java API owns those integrations, keeps credentials server-side, and presents one generated contract to the browser.

## Four datastore roles

| Datastore                           | Role                                               | Owner                                     |
| ----------------------------------- | -------------------------------------------------- | ----------------------------------------- |
| Application PostgreSQL `civics_ops` | Sync jobs and application operational state        | `repository-api`                          |
| DSpace PostgreSQL                   | Repository system of record                        | DSpace                                    |
| Discovery Solr `discovery` core     | Public, rebuildable research-object projection     | `repository-api` through `DiscoveryIndex` |
| DSpace Solr                         | DSpace internal discovery, authority and OAI cores | DSpace                                    |

The duplication is an ownership boundary, not accidental redundancy. DSpace controls its own schema, migrations, search configuration, and upgrade lifecycle. The application-owned projection can be discarded and rebuilt without treating DSpace's internal Solr as a public API.

## Architectural rules

### DSpace is authoritative

Repository metadata, access statements, relationships, versions, files, and bitstreams belong in DSpace. The public discovery index is derived state.

### The public index is replaceable

Application services depend on `DiscoveryIndex`, not directly on a Solr client. Apache Solr is the current implementation; an alternate engine would replace that implementation without changing DSpace's own Solr or the repository model.

### Browser integrations are typed and centralized

OpenAPI is the contract source of truth. TypeScript API types and Java wire DTOs are generated from the same schema. Browser code receives repository/source provenance explicitly instead of guessing whether a result is live or fixture-backed.

### Accessibility is part of the architecture

The accessible table/list representation is generated from the same state as the map. Selection, URL state, announcements, layer visibility, and errors flow through NgRx rather than through direct map-to-DOM coupling.

## Repository population and synchronization

There are two complementary paths.

### Curated repository composition

`tools/dspace/catalog.json` declares which research objects belong in the reference repository. `generate-saf.mjs` resolves program templates and authored research objects into DSpace SAF packages. This path creates the broad catalog and the curated Open Science research package.

The catalog is deliberately curated. Publisher APIs and listings can verify file existence, dates, sizes, and vintages, but they cannot determine all curatorial relationships or decide that a publication, methodology report, project, public dataset, and restricted microdata form one research package.

### Runtime reconciliation

Registered Spring metadata adapters read catalog-backed definitions, verify publisher facts where available, normalize them as `ResearchObjectMetadata`, and reconcile fields owned by synchronization into DSpace. Startup, the admin UI, and command-line sync use the same `SyncService` path.

The current adapter registry covers the publisher-backed objects. A small curated research package intentionally remains outside adapter identity coverage because its relationships are repository curation, not publisher-discovered facts. See [platform-status.md](platform-status.md) for the current counts.

Synchronization guarantees:

- dry-run and diff do not write,
- apply is idempotent,
- only synchronization-owned fields are compared and changed,
- ambiguous DSpace matches fail instead of writing to the first search result,
- source identifier to DSpace identity is recorded where reconciliation applies,
- file manifests describe authoritative publisher files whether or not a bitstream is mirrored.

## Discovery flow

```text
DSpace research objects
        |
        v
DiscoveryProjectionService
        |
        v
DiscoveryIndex
  Apache Solr implementation
        |
        v
SearchService / typed API
        |
        v
NgRx search state and Angular views
```

Search uses eDisMax relevance, field and phrase boosts, facets, paging, URL state, and repository metadata such as subjects, authors, citation, DOI, geography, type, access level, and vintage. A fixture catalog is available only as a labelled degradation path when repository content cannot be obtained.

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

- Metadata, authoritative source URLs, documentation, access statements, and file manifests are always represented.
- Eligible source files are mirrored into DSpace as real bitstreams within a per-file and total-byte budget.
- Large or budget-exceeding artifacts remain authoritative links.
- The Evidence page reports subscribed, mirrored, curated, and indexed as distinct measures.

## Accessibility evidence architecture

```text
Angular template lint
        +
component-state axe tests
        +
real-browser WCAG/508 suites
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

An automated pass is not presented as full Section 508 conformance. Manual evidence remains a separate, recorded step.

## Deployment direction

Docker Compose is the implemented platform and demo environment. The documented AWS target uses EKS as the preferred orchestration model, with ECS/Fargate as an alternate, RDS PostgreSQL, a persistent search-engine decision, CloudFront for the frontend, and explicit backup/observability posture. Infrastructure-as-code is not yet implemented.

## Current seams

The remaining seams are deliberately narrow:

1. Complete and record the manual keyboard, NVDA, JAWS, and map-equivalence evidence.
2. Add a dedicated browser-evidence CI workflow or schedule and decide branch-protection policy.
3. Implement Terraform or CDK for the documented AWS target.
4. Finish research-object language and add a `/research/:id` route alias while preserving existing links.
5. Expand publisher listing/vintage coverage and optional cross-agency federation without turning catalog curation into unsafe automatic edits.
6. Continue provenance hardening: source freshness, indexing timestamps, and precise fallback provenance where a derived map can use either live aggregation or a stored sample.
