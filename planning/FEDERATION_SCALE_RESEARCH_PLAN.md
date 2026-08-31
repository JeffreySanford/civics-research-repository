# Federation Scale Research Plan

## Purpose

Civics Research Repository is a research system. Its scale program should answer how a provenance-aware Open Science repository behaves as source diversity, corpus size, query shape and search topology change. It should not manufacture record counts merely to reach a round number.

The established 100K Data.gov corpus remains the first evidence-grade baseline. Future tiers become increasingly multi-source so the research can distinguish **scale effects** from **source-shape effects**.

## Source portfolio

The modeled federation authorities are:

| Source             |                    Public corpus scale | Initial live adapter role                                 | Large-scale transport                                               | Credentials                                                            |
| ------------------ | -------------------------------------: | --------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Data.gov           | ~556K datasets observed in August 2026 | federal dataset breadth; proven 100K baseline             | Catalog API v4 / bounded source completion                          | personal api.data.gov key required for meaningful harvesting           |
| DOE OSTI.GOV       |                            >4M records | DOE publications, reports, datasets, software and patents | OSTI API or OAI-PMH/full-corpus metadata service                    | none for public metadata                                               |
| NASA Earthdata CMR |      ~65K collections / >2.5B granules | collection-level Earth science sample                     | explicit collection or granule stream using CMR Search-After        | none for public metadata; Earthdata token only for protected holdings  |
| PubMed             |                         >40M citations | biomedical/bibliographic relevance sample                 | NCBI bulk baseline + update files for large tiers                   | API key optional for sample, recommended for sustained E-utilities use |
| OpenAlex           |     >320M core works / >510M all works | broad scholarly sample                                    | pinned public S3 snapshot, preferably Parquet/JSONL manifest-driven | API key optional for sample; no key for public S3 snapshot             |

Source sizes are observations, not immutable constants. A research report must capture the source count/manifest date used for its run.

## Phase 0 — representative source sampling

Before scaling any new source deeply, retain one small bounded page from every authority.

Command:

```bash
pnpm federation:sample:all
```

Rules:

- existing retained sources are observed but not advanced,
- empty sources receive one bounded page,
- failures are reported per source and do not prevent attempts against the remaining sources,
- no mixed-source search profile is activated automatically,
- no publisher binaries are mirrored,
- the result is written as JSON + Markdown under ignored `browser-evidence-artifacts/`.

The first objective is semantic coverage: confirm that datasets, publications, software, Earth science collections, authors, subjects, identifiers and publisher provenance all survive normalization into the shared catalog.

## Scale ladder

The planned scale ladder is intentionally broader than the current enum. Profile names should be added to the runtime/OpenAPI only when their evidence recipe is implemented.

### 100K — established baseline

Composition:

```text
100,000 Data.gov
+ 181 curated DSpace objects
= 100,181 projected objects
```

Purpose:

- deterministic baseline,
- Solr/OpenSearch paired-order research,
- storage slope,
- aggregation-shape experiments,
- restart/resume evidence.

Do not replace this baseline when later tiers are added.

### 500K — single-source ceiling probe

Candidate composition:

```text
500,000 Data.gov
+ curated DSpace
```

Purpose:

- preserve one-source methodology between 100K and near-full Data.gov,
- observe storage/index/search scaling before source composition changes,
- exercise publisher-rate-limit and long-running checkpoint behavior.

This tier is optional if Data.gov API policy or time cost makes it poor research value. It must use a personal API key and remain below the live source ceiling.

### 1M — first true multi-source tier

Preferred initial composition:

```text
500K Data.gov
500K DOE OSTI
+ curated DSpace
```

Reasoning:

- deterministic round per-source quotas,
- neither source silently dominates,
- combines dataset-heavy and publication/research-output-heavy metadata,
- avoids pretending Data.gov alone contains one million records.

The evidence model must become **composite** before this tier is activated: one profile must link multiple source-run/snapshot identities into one corpus identity.

### 10M — heterogeneous research tier

A possible recipe is:

```text
0.5M Data.gov
2.0M DOE OSTI
2.0M PubMed
2.0M OpenAlex
3.5M NASA granules or another explicitly defined CMR slice
= 10M federated records
```

The exact recipe is not frozen yet. The invariant is that each source quota and source transport is explicit in the corpus manifest.

Purpose:

- high-cardinality source/program/topic facets,
- source-shape sensitivity,
- larger index merges/segments,
- concurrency and saturation research,
- standalone-to-cluster crossover evidence.

### 100M — bulk-ingest / cluster research tier

The 100M tier must **not** be built by REST-crawling every source.

Use bulk transports where the publisher provides them:

- OpenAlex public S3 snapshot,
- NCBI PubMed baseline/update files,
- NASA CMR Search-After over an explicitly bounded granule partition or publisher-supported bulk route,
- OSTI full-corpus API/OAI metadata as appropriate,
- Data.gov bounded at its actual source size.

Candidate research questions:

- PostgreSQL versus columnar/staging ingest costs,
- Solr/OpenSearch bulk projection throughput,
- shard/segment sizing,
- query latency under tens/hundreds of millions of documents,
- source-facet and type-facet cardinality,
- recovery/reprojection time,
- storage amplification,
- whether single-workstation Compose remains useful or the tier becomes cluster-only.

A 100M experiment may use a deliberately source-skewed recipe, but the skew must be named. `100M documents` without composition is not a reproducible corpus definition.

## Two ingestion classes

### Live API adapters

Use for:

- small representative samples,
- mapping development,
- freshness checks,
- modest bounded source slices,
- retry/rate-limit lifecycle research.

Current live adapters:

- Data.gov Catalog API v4,
- DOE OSTI.GOV records API,
- NASA CMR collections Search-After,
- PubMed E-utilities sampler,
- OpenAlex Works cursor sampler.

### Bulk snapshot adapters

Use for 10M/100M where available.

A bulk adapter must retain:

- publisher/source identity,
- publisher snapshot/release/manifest identity,
- file/partition identity,
- source record ID,
- normalization adapter version,
- accepted/rejected/skipped counts,
- deterministic normalized-record digest.

Bulk transport does not change the authoritative-source rule. The local files are an ingestion artifact, not a new publisher authority.

## Composite corpus evidence

The current bounded snapshot evidence describes one source/run. Multi-source profiles need a higher-level immutable composition record.

Conceptual shape:

```json
{
  "corpusProfile": "FEDERATED_1M",
  "compositionVersion": "federated-composition/v1",
  "sources": [
    {
      "sourceSystem": "DATA_GOV",
      "requestedRecords": 500000,
      "snapshotId": "...",
      "sha256": "..."
    },
    {
      "sourceSystem": "DOE_OSTI",
      "requestedRecords": 500000,
      "snapshotId": "...",
      "sha256": "..."
    }
  ],
  "federatedRecordCount": 1000000,
  "compositionSha256": "...",
  "projectionId": "..."
}
```

The composition digest must be independent of database page size, ingestion batch size, process restarts and search-engine bulk size.

## Search research matrix

At every evidence-grade tier, preserve the existing matched-corpus paired-order methodology and add source-aware scenarios as the corpus diversifies.

Minimum matrix:

- cross-source full text,
- source-system filter,
- content-type filter,
- publisher/agency filter,
- author query where the corpus supports authors,
- persistent identifier query (DOI/PMID/source ID),
- high-cardinality subject/topic facet,
- selective source-specific filter,
- unqualified facets,
- intentionally broad and empty queries.

Performance claims remain separate from relevance/semantic claims.

## Resource planning

Before each tier:

1. estimate steady-state PostgreSQL/Solr/OpenSearch footprint from prior measured slopes,
2. include staging-index and ingest-file headroom,
3. record free disk and host memory,
4. estimate publisher/API request budget when using live APIs,
5. prefer bulk transport when API request count is unreasonable,
6. record activation/ingest duration separately from search timing.

The 100K measurements showed that DSpace stays approximately fixed while federated metadata/index footprints grow. Continue estimating components separately rather than multiplying total repository storage by the scale factor.

## CI and quality policy

Normal CI should verify the **protocol**, not download large corpora.

Normal quality gates include:

- every live adapter has deterministic local HTTP fixture tests,
- malformed records quarantine rather than abort a page,
- transient statuses become retryable failures,
- cursors/checkpoints are deterministic and explicit,
- source-system identity cannot drift,
- all-source sampling orchestration is unit tested,
- composite evidence and bulk-manifest logic will receive deterministic fixture tests before live use,
- formatting and linting cover new scripts/docs,
- large live runs remain explicit workstation/manual research commands.

## Near-term sequence

1. validate all five live adapters locally,
2. run `pnpm federation:sample:all`,
3. inspect normalized source diversity and UI/detail implications,
4. preserve the established 100K benchmark evidence,
5. close a deterministic 500K Data.gov tier only if it has research value,
6. implement composite multi-source snapshot/evidence,
7. add runtime/OpenAPI profile definitions for 500K/1M/10M/100M only as their recipes become executable,
8. produce the first 1M mixed-source projection,
9. extend the same report methodology to 10M,
10. treat 100M as a bulk-ingest/cluster research program, not a larger REST loop.
