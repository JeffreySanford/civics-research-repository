# Federated Metadata Architecture

## Purpose

Expand discovery to large external Open Science catalogs without turning the local workstation into a file mirror and without pretending that every externally indexed record is a DSpace-owned repository object.

The design preserves the existing principle that Solr and OpenSearch are rebuildable projections while introducing a second authoritative metadata path beside curated DSpace content.

## Target architecture

```text
                    AUTHORITATIVE PUBLIC SOURCES
        Data.gov   OSTI   NASA CMR   PubMed   OpenAlex
             \       |       |         |        /
              \      |       |         |       /
                 source-specific adapters
                          |
                resumable harvest framework
                          |
                 normalize + validate
                          |
                Federated Metadata Store
                          |
                          |                      DSpace
                          |                 curated repository
                          |                       |
                          +-----------+-----------+
                                      |
                           Combined Discovery Catalog
                                      |
                           DiscoveryDocument stream
                                      |
                         deterministic projection ID
                              /               \
                           Solr             OpenSearch
                              \               /
                                Spring API
                                    |
                                 Angular
```

## Authority model

### DSpace-backed records

DSpace remains authoritative for records intentionally curated into the repository, including repository relationships, preservation state, files/manifests and DSpace identity.

### Federated records

The external publisher remains authoritative for federated records. The local platform stores normalized metadata, source identity, provenance, harvest state and enough source-specific metadata to reproduce the search projection.

### Search engines

Solr and OpenSearch remain derived state for both record classes.

A search-engine document that cannot be reproduced from either DSpace or the federated metadata catalog is an integrity failure.

## Required provenance

Every discoverable object should identify at minimum:

```text
origin
  REPOSITORY | FEDERATED | FIXTURE

sourceSystem
  CENSUS | USGS | DATA_GOV | DOE_OSTI | NASA_CMR | PUBMED | OPENALEX | ...

sourceIdentifier
sourceUrl
sourceUpdatedAt      when supplied by publisher
harvestedAt
adapterVersion       git SHA or adapter version
```

Federated metadata must never be rendered as if it were a locally preserved DSpace object.

## Identity

Use namespaced source identifiers as the first identity layer:

```text
DATA_GOV:<dataset-id>
DOE_OSTI:<osti-id>
NASA_CMR:<concept-id>
PUBMED:<pmid>
OPENALEX:<work-id>
```

Cross-source reconciliation is a separate layer. DOI, PMID and other globally meaningful identifiers may establish equivalence or relationships later, but title equality is never sufficient for silent merging.

Recommended model:

```text
source_record_identity
  source_system
  source_identifier
  canonical_research_object_id (optional)

research_identifiers
  DOI
  PMID
  agency identifiers
  other persistent identifiers
```

This supports three legitimate states:

1. one source record maps to one research object,
2. several source records describe one research object,
3. equivalence is unknown and records remain separate.

## Metadata storage

Do not store publisher binaries merely because a record references them.

Persist metadata and provenance in the application data layer, likely PostgreSQL, using relational columns for fields we query operationally and JSONB for source-specific payload fragments that should not be flattened away.

Suggested logical tables:

```text
federated_research_objects
federated_authors
federated_subjects
federated_identifiers
federated_relationships
harvest_runs
harvest_checkpoints
harvest_errors
corpus_snapshots
```

Exact physical design should be tested before committing to aggressive normalization. At million-record scale, unnecessary join amplification can become more expensive than compact JSONB source metadata.

## Dynamic taxonomy

The current `ResearchProgram` enum is too narrow for heterogeneous catalogs.

PI-1 separates:

- `sourceSystem` — controlled enum owned by this application,
- `publisher` / `agency` — data-driven strings or normalized entities,
- `programName` — data-driven source/program value carried by the engine-neutral `DiscoveryDocument`,
- legacy `ResearchProgram` — compatibility classification retained for the curated Census slice while the public contract migrates,
- `contentType` — controlled high-level research-object classification,
- `subjects` — data-driven multi-value terms.

Federated records must not expand the `ResearchProgram` enum merely to represent publisher program names. For example, a DOE OSTI record may keep `ResearchProgram.OTHER` as the compatibility classification while its canonical discovery taxonomy preserves `programName = "Office of Science"`.

Unknown source program names must not collapse into one giant `OTHER` discovery facet.

A source adapter may still map provider-specific resource types to a controlled `contentType`, for example:

```text
OSTI technical report -> REPORT
OSTI dataset          -> DATASET
OSTI software         -> SOFTWARE
PubMed citation       -> PUBLICATION
NASA CMR granule      -> GRANULE or benchmark-specific scientific record
```

## Combined discovery catalog

`CombinedDiscoveryCatalog` is the current bounded authority-composition seam.

It emits the small curated DSpace slice first and then advances through federated metadata using the catalog's stable namespaced identifier cursor. Federated records are mapped through `FederatedDiscoveryDocumentMapper`, which preserves their explicit `FEDERATED` origin, controlled `sourceSystem`, publisher, data-driven `programName`, subjects and authors.

The current page cursor is deliberately an internal domain value. A later browser/search cursor must be opaque and versioned rather than exposing database offsets or identifiers directly.

The combined catalog does not materialize the retained federated corpus into one list. It is designed to feed the bounded projection pipeline below.

## Projection pipeline

The projection process should operate in bounded batches:

```text
combined discovery cursor
  -> 500-2,000 normalized documents
  -> update deterministic digest
  -> Solr bulk/update
  -> OpenSearch bulk
  -> record checkpoint/progress
  -> next batch
```

Requirements:

- bounded memory,
- identical ordered normalized input for both engines,
- deterministic corpus identity independent of batching,
- accepted/rejected/skipped counts,
- resumable or restartable indexing strategy,
- no giant million-document HTTP body,
- projection target failures isolated and recorded.

The bounded combined catalog is implemented; the existing projection service still materializes its current repository/fixture input and remains the next seam to replace before 100K+ projection work.

## Corpus identity

A million-record projection ID must not require keeping one million Java objects in memory.

Use a canonical deterministic ordering and streaming digest. For example:

```text
sort/order key: authority order + sourceSystem + sourceIdentifier
canonical normalized representation per record
SHA-256 digest updated record-by-record
```

Record the algorithm/version in the corpus manifest so a future canonicalization change cannot masquerade as source-data drift.

## Search and UI behavior

The main discovery result list and facets are already largely response-driven, which is the right architecture for scale.

PI-1 must remove the remaining repository-only assumptions:

1. migrate the public program filter/result contract from the fixed enum to the canonical data-driven program value while preserving compatibility,
2. introduce `origin` and `sourceSystem` in the search/detail contract,
3. add `/research/:id` as the canonical detail route while preserving `/datasets/:id` compatibility,
4. resolve detail from DSpace or the federated metadata catalog,
5. label federated records clearly and link to authoritative source resources,
6. preserve accessible pagination and filtering.

Federated record detail should show metadata and outbound resources without inventing local files or preservation claims.

## Pagination at scale

Offset pagination becomes increasingly expensive at deep pages.

Plan a contract that can support engine-native cursor semantics:

```text
Solr       cursorMark
OpenSearch search_after
```

The Angular UI can remain `Previous` / `Next`; the API should not require deep offsets to represent navigation.

Any cursor token must remain opaque to Angular and bound to a stable query/sort definition.

## Standalone and clustered compatibility

PI-1 must work first against the existing Docker Compose topology:

```text
Solr standalone
OpenSearch single node
```

PI-2 must use the **same normalized snapshots, search contract and UI** against:

```text
SolrCloud
multi-node OpenSearch
```

No source adapter should know whether its eventual projection target is standalone or Kubernetes-clustered. Topology is infrastructure, not domain semantics.

## Testing strategy

Each source adapter requires:

- representative source fixtures,
- malformed/missing-field fixtures,
- deterministic normalization tests,
- source identity tests,
- paging/checkpoint tests,
- retry/rate-limit behavior tests where practical.

The combined catalog requires:

- provenance tests,
- duplicate/equivalence tests,
- stable authority/order tests,
- bounded page traversal tests,
- deterministic digest tests,
- batch-size independence tests.

The search/UI path requires:

- repository and federated result rendering,
- dynamic source/publisher/program facets,
- federated detail routing,
- keyboard/accessibility coverage,
- standalone real-stack evidence at staged corpus sizes.

## Non-goals

PI-1 does not:

- download every linked full-text artifact,
- make Solr or OpenSearch authoritative,
- require every external record to become a DSpace item,
- claim every external source record is a distinct intellectual work,
- run the full multi-million corpus in ordinary CI,
- replace the curated DSpace path,
- require Kubernetes before the federated data architecture works.
