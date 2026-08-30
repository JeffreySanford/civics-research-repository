# Federated Metadata Architecture

## Purpose

Expand discovery to large external Open Science catalogs without turning the local workstation into a file mirror and without pretending that every externally indexed record is a DSpace-owned repository object.

The implemented design preserves the principle that Solr and OpenSearch are rebuildable projections while introducing a second authoritative metadata path beside curated DSpace content.

## Current architecture

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
               application PostgreSQL
                          |
                          |                      DSpace
                          |                 curated repository
                          |                       |
                          +-----------+-----------+
                                      |
                           CombinedDiscoveryCatalog
                                bounded pages
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

Data.gov is the first live implemented external adapter. OSTI, NASA CMR, PubMed and OpenAlex are controlled source-system identities and PI-1 adapter targets; they are not documented as live merely because the shared architecture supports them.

## Authority model

### DSpace-backed records

DSpace remains authoritative for records intentionally curated into the repository, including repository relationships, preservation state, files/manifests and DSpace identity.

### Federated records

The external publisher remains authoritative for federated records. The local platform stores normalized metadata, source identity, provenance, harvest state and enough source-specific metadata to reproduce the search projection.

### Search engines

Solr and OpenSearch remain derived state for both record classes.

A search-engine document that cannot be reproduced from either DSpace or the federated metadata catalog is an integrity failure.

## Required provenance

Every discoverable object should identify at minimum where applicable:

```text
origin
  REPOSITORY | FEDERATED | FIXTURE

sourceSystem
  CENSUS | USGS | DATA_GOV | DOE_OSTI | NASA_CMR | PUBMED | OPENALEX | ...

sourceIdentifier
sourceUrl
sourceUpdatedAt      when supplied by publisher
harvestedAt
adapterVersion
```

Federated metadata must never be rendered as if it were a locally preserved DSpace object.

The public contract currently exposes the per-record `origin` and `sourceSystem` fields needed to preserve this distinction through search and detail. Projection-level `REPOSITORY` remains a compatibility label for any authority-backed projection; it is not the per-record provenance source of truth.

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

Recommended future reconciliation model:

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

The namespaced source-identity layer is implemented. Cross-source durable-identifier reconciliation remains open PI-1 work.

## Metadata storage

Federated metadata is persisted in application PostgreSQL, separate from DSpace-owned PostgreSQL.

The current data layer stores normalized operational/queryable fields plus bounded source-specific metadata needed for provenance and reproduction. It also owns:

- federated research records,
- durable harvest runs,
- source checkpoints,
- bounded quarantine/error evidence,
- deterministic corpus/snapshot manifests,
- snapshot/projection evidence relationships,
- corpus storage measurements.

Do not store publisher binaries merely because a federated record references them.

At million-record scale, physical storage design should continue to favor bounded writes and avoid unnecessary join amplification or unbounded raw-payload mirroring.

## Dynamic taxonomy

The curated `ResearchProgram` enum is too narrow for heterogeneous catalogs.

PI-1 separates:

- `sourceSystem` — controlled enum owned by this application,
- `publisher` / `agency` — data-driven values,
- `programName` — canonical data-driven publisher/source program value carried by `DiscoveryDocument`,
- legacy `ResearchProgram` — compatibility classification retained for the curated Census slice,
- `contentType` — controlled high-level research-object classification,
- `subjects` — data-driven multi-value terms.

Federated records do not expand the `ResearchProgram` enum merely to represent publisher program names. Unknown source program names therefore do not collapse into one giant `OTHER` discovery facet.

Live Data.gov evidence has exposed valid but opaque publisher program values such as `010:10` and `010:12`. The architecture should preserve those raw source values while adding a presentation/label strategy that does not reintroduce a fixed UI allowlist or silently rewrite publisher semantics.

## Combined discovery catalog

`CombinedDiscoveryCatalog` is the implemented bounded authority-composition seam.

It emits the small curated DSpace slice and federated metadata through a deterministic cursor traversal. Federated records are mapped through `FederatedDiscoveryDocumentMapper`, which preserves their explicit `FEDERATED` origin, controlled `sourceSystem`, publisher, data-driven `programName`, subjects and authors.

The combined catalog does not materialize the retained federated corpus into one list. It feeds bounded pages into the projection pipeline.

Its current cursor is an internal domain value. A future browser/search cursor must be opaque and versioned rather than exposing database offsets or identifiers directly.

## Projection pipeline

The implemented projection path operates in bounded batches:

```text
combined discovery cursor
  -> bounded normalized page
  -> update deterministic streaming digest
  -> Solr batch/update
  -> OpenSearch bulk
  -> next page
  -> final projection identity
```

Current guarantees:

- bounded-memory traversal,
- identical ordered normalized input for active targets,
- deterministic corpus/projection identity independent of batching,
- no giant million-document HTTP body,
- projection target failures isolated and recorded,
- repository identity updates limited to repository-origin documents.

Remaining scale hardening:

- reusable progress/throughput evidence during large projection,
- host/container/JVM resource context,
- 10K/100K storage growth measurements,
- 1M acceptance evidence.

## Bounded snapshots and guarded projection evidence

Intentionally paused 1K/10K/100K checkpoints require a reproducible content identity even though the publisher source has not been exhausted.

`BOUNDED_SNAPSHOT` manifests record the durable run/checkpoint state, including source system, adapter version, accepted/rejected/skipped counts, retained count, cursor and observed source-update window.

The guarded snapshot -> projection operation:

1. captures the bounded snapshot/checkpoint,
2. rebuilds the combined discovery projection,
3. computes the deterministic projection ID,
4. rescans the harvest run after projection,
5. persists the snapshot/projection relationship only when the checkpoint is unchanged.

If counters, cursor, status or run update time drift during projection, the relationship is rejected rather than recorded as valid evidence.

The 1K Data.gov path has proven this end to end. The 10K harvest is complete and awaiting the same evidence closure. See [PI-1 Data.gov Scale Evidence](../../planning/PI1_DATA_GOV_SCALE_EVIDENCE.md).

## Corpus identity

A million-record projection ID must not require keeping one million Java objects in memory.

The current deterministic streaming digest uses a canonical normalized document sequence and is independent of database page/search bulk size. Snapshot identity and projection identity remain separate evidence concepts:

- snapshot identity proves the retained source checkpoint content,
- projection identity proves the normalized ordered search document set,
- guarded linkage proves which projection was built from a stable snapshot checkpoint.

Canonicalization/version changes must remain explicit so a future normalization change cannot masquerade as source-data drift.

## Search and UI behavior

The mixed-authority product slice is implemented:

- source-system facet is selectable in normal discovery,
- publisher/program facets are response-driven rather than fixed allowlists,
- URL/query state carries source and publisher filters,
- `/research/:id` is the canonical research-object detail route,
- `/datasets/:id` remains a compatibility route,
- detail resolves from DSpace or `FederatedMetadataCatalog`,
- federated detail labels external authority and links to the publisher without inventing local files/versions/maps,
- repository detail retains repository-specific enrichments,
- browser/accessibility tests cover mixed-origin states.

Live 1K Data.gov public-search evidence returned exactly 1,000 `DATA_GOV` records with `origin: FEDERATED` and indexed source/publisher/program facets.

## Pagination at scale

Offset pagination remains the public compatibility contract today. It becomes increasingly inefficient at deep pages.

PI-1 still needs a contract that can support engine-native cursor semantics:

```text
Solr       cursorMark
OpenSearch search_after
```

The Angular UI can remain accessible `Previous` / `Next`; the API should not require deep offsets to represent navigation at million-record scale.

Any cursor token must remain opaque to Angular and bound to a stable query/sort definition. The current offset contract must keep working until the cursor path is tested and ready.

## Standalone and clustered compatibility

PI-1 works first against the existing Docker Compose topology:

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

The combined/harvest evidence path requires:

- provenance tests,
- stable authority/order tests,
- bounded page traversal tests,
- deterministic digest tests,
- batch-size independence tests,
- run resume/restart/cancel lifecycle tests,
- quarantine tests,
- bounded snapshot determinism,
- guarded projection drift rejection,
- persistent snapshot/projection evidence tests.

The search/UI path requires:

- repository and federated result rendering,
- dynamic source/publisher/program facets,
- federated detail routing,
- keyboard/accessibility coverage,
- standalone real-stack evidence at staged corpus sizes.

Normal CI stays fixture-sized. Heavy scale runs record deterministic evidence rather than downloading 100K/1M publisher records in every pull request.

## Non-goals

PI-1 does not:

- download every linked full-text artifact,
- make Solr or OpenSearch authoritative,
- require every external record to become a DSpace item,
- claim every external source record is a distinct intellectual work,
- run the full multi-million corpus in ordinary CI,
- replace the curated DSpace path,
- require Kubernetes before the federated data architecture works.
