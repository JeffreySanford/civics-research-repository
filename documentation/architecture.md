# Architecture

This document describes the architecture that runs today. Planned work is kept in [planning/ROADMAP.md](../planning/ROADMAP.md); historical delivery detail is kept in [history/platform-evolution.md](history/platform-evolution.md). Current volatile counts live in the generated [platform status](platform-status.md).

## System purpose

Civics Research Repository is a federal Open Science reference platform. It preserves and relates research objects in DSpace, projects them into rebuildable public-search representations, and exposes accessible search, repository workflows, search-engine comparison, and geospatial research views through a single typed API.

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
  - Search Lab: Solr/OpenSearch side-by-side comparison
  - workforce and reference mapping
  - admin synchronization and repository/index views
  - accessibility, provenance and pipeline evidence
                  |
                  | REST/JSON, generated OpenAPI types
                  v
Spring Boot repository-api (:8080/api)
  - owns every browser-facing integration
  - catalog-backed metadata adapters
  - dry-run / diff / apply synchronization
  - DSpace identity and repository projection
  - normalizes one DiscoveryDocument set
  - computes deterministic projection identity
  - projects configured search targets independently
  - search, comparison, maps, overlays and evidence endpoints
        |                 |                    |                    |
        v                 v                    v                    v
Application          Solr discovery       OpenSearch           DSpace REST (:8081)
PostgreSQL            (:8983)              comparison (:9200)   repository system of record
(:5432)               public DiscoveryIndex parallel target     communities, collections,
sync jobs             rebuildable          rebuildable          items, metadata, relations,
                                                               versions and bitstreams
                                                                    |              |
                                                                    v              v
                                                           DSpace PostgreSQL   DSpace Solr
                                                           (:5433)             (:8984)
```

The Angular application never calls DSpace, Solr, OpenSearch, Census, or USGS directly. The Java API owns those integrations, keeps credentials and engine-specific behavior server-side, and presents one generated contract to the browser.

## Five datastore/search roles

| Datastore or engine                     | Role                                                             | Owner                                                |
| --------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------- |
| Application PostgreSQL `civics_ops`     | Sync jobs and application operational state                      | `repository-api`                                     |
| DSpace PostgreSQL                       | Repository system of record                                      | DSpace                                               |
| Discovery Solr `discovery` core         | Public, rebuildable research-object discovery projection         | `repository-api` through `DiscoveryIndex`            |
| OpenSearch `discovery-comparison` index | Parallel rebuildable projection for controlled engine comparison | `repository-api` through `DiscoveryProjectionTarget` |
| DSpace Solr                             | DSpace internal discovery, authority and OAI cores               | DSpace                                               |

The duplication is an ownership boundary, not accidental redundancy. DSpace controls its own schema, migrations, search configuration, and upgrade lifecycle. Application-owned search projections can be discarded and rebuilt without treating DSpace's internal Solr as a public API or source of truth.

## Architectural rules

### DSpace is authoritative

Repository metadata, access statements, relationships, versions, files, and bitstreams belong in DSpace. Search-engine indexes are derived state.

### Normalize once, project many

`DiscoveryProjectionService` obtains one normalized `List<DiscoveryDocument>` and computes one deterministic SHA-256 identity for that document set. Every configured `DiscoveryProjectionTarget` receives that same list.

This prevents a comparison from quietly becoming a comparison of two different source datasets. Search-engine differences can then be investigated as query, analyzer, mapping, ranking, aggregation, runtime, or operational differences rather than unexplained projection drift.

Each target records its own most-recent projection outcome. A failure rebuilding one engine does not erase the normalized repository state or prevent another configured target from being attempted.

### Projection identity is stronger than document count

Two indexes containing 181 documents are not necessarily equivalent. Projection parity is verified only when:

- a current deterministic projection ID exists,
- each engine records a successful current projection,
- each engine records that same projection ID,
- each engine reports the expected normalized document count.

Search Lab exposes that evidence before showing engine differences.

### The public query path and projection lifecycle are separate contracts

`DiscoveryProjectionTarget` represents a rebuildable destination. `DiscoveryIndex` extends it with browser-facing discovery query behavior.

Solr remains the current `DiscoveryIndex` implementation used by normal public discovery. OpenSearch implements the projection lifecycle and comparison query behavior without becoming a second public `DiscoveryIndex` bean. This keeps migration experimentation from silently changing production-shaped application routing.

The architecture therefore supports two different decisions independently:

1. **Can an engine receive and query an equivalent projection?**
2. **Should that engine become the normal browser-facing discovery implementation?**

The current OpenSearch work answers the first question; it does not presuppose the second.

### Browser integrations are typed and centralized

OpenAPI is the contract source of truth. TypeScript API types and Java wire DTOs are generated from the same schema. Browser code receives repository/source provenance explicitly instead of guessing whether a result is live or fixture-backed.

The comparison API returns both engine blocks in one typed response so one engine's failure does not mask useful evidence from the other.

### Accessibility is part of the architecture

The accessible table/list representation is generated from the same state as the map. Selection, URL state, announcements, layer visibility, and errors flow through NgRx rather than through direct map-to-DOM coupling.

Search Lab follows the same rule: status, projection parity, warnings, facets/aggregations, and ranked results are exposed as semantic text/list structures and do not depend on color to communicate engine differences.

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

## Discovery and comparison flow

```text
DSpace research objects
        |
        v
DiscoveryProjectionService
        |
        +--> normalized DiscoveryDocument[]
        |
        +--> deterministic projection SHA-256
        |
        +------------------------+
        |                        |
        v                        v
DiscoveryIndex             DiscoveryProjectionTarget
Solr `discovery`           OpenSearch `discovery-comparison`
        |                        |
        |                        +----------------------+
        |                                               |
        +--> SearchService                              |
        |    normal public search                       |
        |                                               |
        +----------------> SearchComparisonService <----+
                              |
                              v
                       typed comparison API
                              |
                              v
                         Angular Search Lab
```

Normal public search uses Solr eDisMax relevance, field and phrase boosts, facets, paging, URL state, and repository metadata such as subjects, authors, citation, DOI, geography, type, access level, and vintage.

The implemented OpenSearch comparison query uses weighted lexical matching, phrase boosts, structured filters, and self-excluding aggregations so equivalent user-visible facet behavior can be compared. OpenSearch field names remain engine-neutral rather than copying Solr suffix conventions.

A fixture catalog is available only as a labelled degradation path when repository content cannot be obtained. Fixture-backed comparison remains useful for engine behavior but is not presented as repository-backed evidence.

## What comparison timing means

Search Lab currently reports **API elapsed time around each engine request**. This is deliberately labelled local demo timing and is not a production benchmark.

At the current small index size, a single observed result such as Solr 20 ms and OpenSearch 46 ms can be dominated by fixed overhead:

- HTTP and Docker networking,
- JVM scheduling,
- JSON serialization/deserialization,
- connection behavior,
- query/aggregation construction,
- host activity and container warm-up.

OpenSearch is not architecturally valuable only when more nodes are added, and more nodes do not guarantee a lower single-query latency. Distributed execution can add coordination overhead. Horizontal scaling is also not unique to OpenSearch; SolrCloud supports distributed shards and replicas.

Future measurement should separate:

- API elapsed time,
- Solr engine-native `QTime`,
- OpenSearch engine-native `took`,
- repeated-run p50/p95/p99 distributions,
- index size,
- concurrency,
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

- Metadata, authoritative source URLs, documentation, access statements, and file manifests are always represented.
- Eligible source files are mirrored into DSpace as real bitstreams within a bounded total-byte budget.
- Large or budget-exceeding artifacts remain authoritative links.
- The Evidence page reports subscribed, mirrored, curated, and indexed as distinct measures.

## Admin Sync direction

Admin Sync currently combines repository synchronization with operational visibility. The search-comparison architecture extends the second responsibility.

The page should present reindexing as:

```text
DSpace -> normalized projection -> projection ID -> Solr + OpenSearch
```

rather than visually implying that the projection pipeline terminates only at Solr.

Per-engine state should expose enabled/reachable/projected status, index name, current projection identity, document count, parity, and warnings while preserving the statement that Solr is still the normal browser-facing discovery path.

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

New comparison capability should not outrun its evidence.

Before adding broader phrase/highlight/geo/suggest/synonym/vector/hybrid scenarios, the current comparison path is expected to have:

1. Java service/use-case tests,
2. controller/contract tests,
3. OpenSearch HTTP request-semantics tests,
4. Angular Search Lab component tests,
5. Angular comparison API-client tests,
6. format/lint/generated-drift gates,
7. deterministic Playwright scenario coverage,
8. axe WCAG/Section 508 route coverage,
9. storyboard coverage,
10. a live Solr/OpenSearch browser smoke path,
11. manual evidence where manual conformance claims are made.

A test file existing in the repository is not enough; CI must actually execute the relevant evidence path.

## Deployment direction

Docker Compose is the implemented platform and demo environment. The documented AWS target uses EKS as the preferred orchestration model, with ECS/Fargate as an alternate, RDS PostgreSQL, a persistent search-engine decision, CloudFront for the frontend, and explicit backup/observability posture. Infrastructure-as-code is not yet implemented.

A production search-engine decision must include topology, persistent storage, backup/rebuild strategy, availability, cost, observability, security, index migration/alias strategy and operational ownership. Local single-node timing does not make that decision.

## Current seams

The remaining seams are deliberately narrow:

1. Complete and record manual keyboard, NVDA, JAWS, Search Lab, and map-equivalence evidence.
2. Finish enforcing the dedicated browser-evidence workflow and decide branch-protection/required-check policy.
3. Extend Admin Sync and Evidence so projection identity and per-engine parity are visible outside Search Lab.
4. Add engine-native timing and repeated measurement before making any performance claims.
5. Implement Terraform or CDK for the documented AWS target.
6. Finish research-object language and add a `/research/:id` route alias while preserving existing links.
7. Expand publisher listing/vintage coverage and optional cross-agency federation without turning catalog curation into unsafe automatic edits.
8. Continue provenance hardening: source freshness, indexing timestamps, and precise fallback provenance where a derived map can use either live aggregation or a stored sample.
