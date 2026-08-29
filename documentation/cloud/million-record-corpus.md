# Million-Record Open Science Corpus

## Purpose

The current repository corpus is intentionally small enough to understand by inspection. That is excellent for architecture and accessibility work but too small to answer serious search-scaling questions.

This plan adds reproducible metadata corpora at 10K, 100K, 1M and optionally 5M+ records without pretending that record count alone improves the product.

The primary goals are to measure:

- normalization throughput,
- repository ingest/reconciliation throughput,
- Solr/OpenSearch indexing throughput,
- query latency distributions,
- concurrent search throughput,
- shard/replica behavior,
- memory/storage growth,
- restart and recovery behavior,
- semantic/result differences at realistic index sizes.

Full-text binary files are **not** required for this experiment. Metadata-rich records are the correct first scale unit.

## Candidate corpora

Corpus sizes below are source-reported values observed in August 2026 and will change over time. Harvesters must record the actual source count and snapshot date for every run.

| Source | Current public scale | Access | Fit for this repository | Recommended use |
| --- | ---: | --- | --- | --- |
| Data.gov | ~556K datasets | catalog/API feeds | excellent federal open-data fit | 10K-500K dataset metadata tiers |
| DOE OSTI.GOV | 4M records | REST API, OAI-PMH, bulk metadata options | excellent federal research/Open Science fit | **preferred first 1M+ corpus** |
| PubMed | 40M+ citations/abstracts | NCBI E-utilities and bulk/FTP options | excellent federal scholarly metadata source, broader biomedical domain | bibliographic 1M-5M+ scale tier |
| NASA Earthdata CMR | ~65K collections / 2.529B granules | CMR Search APIs | exceptional federal geospatial/science scale; granules are finer-grained than current research objects | controlled 1M+ stress corpus and spatial/temporal experiments |
| OpenAlex | 320M+ core works / 510M+ all works | REST API and snapshots | broad open-science corpus, not a federal repository | optional external benchmark corpus |

Official source references:

- Data.gov: <https://data.gov/>
- DOE OSTI API: <https://www.osti.gov/api/v1/docs>
- DOE OSTI corpus description: <https://www.osti.gov/faqs>
- PubMed: <https://pubmed.ncbi.nlm.nih.gov/about/>
- NASA CMR: <https://www.earthdata.nasa.gov/about/esdis/eosdis/cmr>
- NASA current holdings: <https://access.earthdata.nasa.gov/holdings>
- OpenAlex works: <https://help.openalex.org/data/works/>

## Recommended source order

### 1. DOE OSTI — first million-record source

OSTI is the strongest first choice because it closely matches the repository's intended research-object model. OSTI describes a corpus of 4 million DOE research records covering journal articles, reports, datasets, software, patents, conference outputs, books, theses and multimedia.

It also explicitly offers API and OAI-PMH access to the full metadata corpus.

That makes it a better first million-record experiment than duplicating the existing fixture or importing unrelated synthetic documents.

Suggested normalized mapping:

```text
OSTI record
  osti_id                 -> sourceIdentifier
  title                   -> title
  description/abstract    -> summary
  authors                 -> authors
  publication_date        -> published/vintage metadata
  research_org            -> publisher/research organization
  sponsoring_org          -> sponsoring organization
  subjects                -> subjects
  resource_type           -> research object type mapping
  doi                     -> DOI identifier
  product/reference URL   -> source/documentation URL
```

The adapter should preserve unmapped OSTI fields in typed source metadata where useful rather than flattening everything into text.

### 2. Data.gov — federal dataset breadth

Data.gov is currently around 556K datasets, so it cannot independently supply a one-million-record dataset catalog today. It is still extremely valuable because it broadens agency and subject coverage while remaining tightly aligned with government Open Data.

Use it to validate:

- many agencies/publishers,
- heterogeneous tags and descriptions,
- resource links,
- update/freshness metadata,
- duplicate/cross-listed datasets,
- source normalization at hundreds-of-thousands scale.

### 3. NASA CMR — very large geospatial/scientific stress corpus

NASA CMR is in a different scale class. Earthdata currently reports roughly 65,633 collections and 2,529,290,985 granules.

Do **not** immediately import billions of granules.

Instead use CMR to create deterministic scale slices such as:

```text
10K granules
100K granules
1M granules
5M granules
```

CMR granules are not equivalent to top-level research datasets, so they should be normalized as a dedicated benchmark/scientific-file metadata type or benchmark document shape rather than mislabeled as one million independent research projects.

CMR is especially attractive for later spatial/temporal search experiments because its metadata is designed for Earth observation discovery.

### 4. PubMed — bibliographic scale

PubMed contains more than 40 million citations and abstracts. A PubMed adapter would stress:

- titles/abstracts,
- many authors,
- journal/source metadata,
- controlled vocabulary/MeSH-style subject richness,
- dates,
- identifiers,
- citation-oriented search.

This is a good second 1M+ source after OSTI if the goal is rich lexical relevance rather than geospatial scale.

### 5. OpenAlex — optional non-federal open-science scale

OpenAlex currently documents more than 320 million core works and more than 510 million works when its expansion corpus is included.

It should remain optional because the repository's primary story is federal Open Science. It is valuable when we want a massive, openly accessible scholarly corpus with authors, institutions, topics, funders and citation relationships.

## Two scale modes

A critical requirement is to separate **repository scaling** from **search-engine scaling**.

### Mode A — repository-integrated scale

```text
publisher/API
    -> adapter
    -> DSpace / repository identity
    -> normalized DiscoveryDocument
    -> deterministic projection
    -> Solr + OpenSearch
```

Use this mode when measuring the whole platform.

It answers:

- how quickly can DSpace accept/reconcile records?
- how large can the repository metadata catalog become locally?
- how long does normalization/reindexing take?
- does repository identity remain stable?
- does the full Open Science chain remain auditable?

Recommended initial checkpoints:

```text
10K
100K
then evaluate whether 1M DSpace-backed objects is practical locally
```

Do not assume DSpace must hold one million records merely because the search engines can.

### Mode B — search-scale benchmark corpus

```text
publisher/API or captured snapshot
    -> adapter
    -> normalized DiscoveryDocument snapshot
    -> benchmark projection ID
    -> Solr / SolrCloud + OpenSearch
```

This mode deliberately bypasses DSpace persistence after normalization so the experiment can isolate search/indexing behavior.

Requirements:

- label the source as benchmark/snapshot evidence,
- never show it as repository-backed production evidence,
- preserve source identifiers and provenance,
- compute a deterministic snapshot/projection fingerprint,
- write a manifest containing source, retrieval window, count and hash,
- use the exact same normalized snapshot for both engines.

This mode is the preferred path for the first 1M and 5M search experiments.

## Corpus checkpoints

### C0 — 181 records

Purpose: preserve the current known functional/performance baseline.

### C1 — 10,000 records

Purpose:

- prove the harvester,
- prove deterministic normalization,
- prove resumable indexing,
- catch field/mapping explosions,
- establish first clustered Kubernetes run.

### C2 — 100,000 records

Purpose:

- expose heap/storage behavior,
- measure meaningful reindex duration,
- inspect facet cardinality,
- compare single-node and clustered search.

### C3 — 1,000,000 records

Purpose:

- first true large-corpus benchmark,
- evaluate shard count,
- evaluate concurrency `1`, `8`, `32`,
- measure indexing throughput and query distributions,
- observe whether distributed search begins paying for its coordination overhead.

### C4 — 5,000,000+ records

Optional only after C3 is repeatable.

Purpose:

- stress index lifecycle and storage,
- examine larger shard layouts,
- exercise recovery/rebalancing,
- evaluate whether the workstation remains a useful environment or cloud infrastructure is required.

## Harvesting architecture

Large-source adapters should not load an entire corpus into memory.

Use streaming/page-based ingestion:

```text
source page/cursor
  -> validate
  -> normalize batch
  -> write checkpoint
  -> persist snapshot or repository batch
  -> continue
```

Each harvester needs:

- source-specific cursor/page token,
- retry with bounded backoff,
- rate-limit awareness,
- resumable checkpoints,
- idempotent identifiers,
- duplicate detection,
- error quarantine/dead-letter output,
- progress metrics,
- source count where available,
- final accepted/rejected/skipped counts.

## Snapshot manifest

Every benchmark corpus should produce a small manifest similar to:

```json
{
  "source": "DOE_OSTI",
  "retrievedAt": "2026-08-29T00:00:00Z",
  "requestedRecords": 1000000,
  "normalizedRecords": 1000000,
  "rejectedRecords": 0,
  "projectionId": "<sha256>",
  "adapterVersion": "<git-sha>",
  "mode": "SEARCH_SCALE_SNAPSHOT"
}
```

The manifest is evidence. The million metadata documents themselves do not belong in Git.

## Deduplication and identity

Multiple sources may describe the same research output. Do not assume one source record equals one globally unique research object.

Maintain namespaced source identity:

```text
DOE_OSTI:1234567
PUBMED:98765432
DATA_GOV:<dataset-id>
NASA_CMR:<concept-id>
OPENALEX:W...
```

Later cross-source reconciliation can use identifiers such as DOI, PMID or source-specific relationships. Scale ingestion must not silently collapse records merely because titles match.

## Storage policy

The first million-record experiment should be **metadata-first**.

Do not download a million PDFs, granules or ZIP files.

Store:

- normalized metadata,
- source identifiers,
- URLs,
- compact source provenance,
- benchmark manifests,
- optional bounded source samples for debugging.

Large publisher binaries remain external unless a separate preservation experiment explicitly budgets them.

## Performance matrix

For each corpus checkpoint, record at minimum:

| Dimension | Values |
| --- | --- |
| topology | Compose standalone, Kubernetes clustered |
| corpus | 181, 10K, 100K, 1M, optional 5M+ |
| concurrency | 1, 8, 32 |
| warm-ups | >= 5 |
| measured requests | >= 100 per scenario |
| metrics | API elapsed, Solr QTime, OpenSearch took, throughput, errors |
| context | shards, replicas, pod resources, heap, storage, projection ID |

Do not run the full Cartesian product blindly. Use lower tiers to eliminate obviously poor configurations before expensive 1M+ runs.

## Relevance and semantic quality at scale

Performance is not the only question.

At 1M records, add stable query sets that cover:

- exact identifier lookup,
- rare phrase,
- common multi-term query,
- agency/publisher filter,
- object-type filter,
- year/vintage filter,
- high-cardinality facet,
- low-cardinality facet,
- empty-result query,
- broad result query.

Record result-set overlap, rank movement and facet-bucket differences alongside timing. Faster incorrect or semantically divergent results are not a successful benchmark.

## Proposed implementation order

1. Build a generic resumable scale-harvest interface.
2. Implement DOE OSTI adapter/harvester first.
3. Produce deterministic 10K snapshot.
4. Project 10K into existing standalone Solr/OpenSearch and validate parity.
5. Produce 100K snapshot and repeat.
6. Bring up local Kubernetes search topology.
7. Compare Compose vs Kubernetes at 10K/100K.
8. Produce the first 1M OSTI snapshot.
9. Run 1M topology/concurrency experiments.
10. Add NASA CMR or PubMed as a second 1M+ corpus so results are not overfit to one metadata shape.
11. Consider OpenAlex only after the federal-source path is established.

## Acceptance criteria for the first million-record slice

The first large-corpus slice is complete when:

- at least one public source can be harvested resumably,
- the source adapter is covered by unit/fixture tests,
- a deterministic 10K, 100K and 1M normalized snapshot can be reproduced or regenerated,
- snapshots contain provenance and a deterministic identity,
- Solr and OpenSearch receive exactly the same normalized 1M-document snapshot,
- document counts and projection IDs match,
- indexing duration and failure counts are recorded,
- query measurements include warm-up and p50/p95/p99 distributions,
- 1/8/32 concurrency evidence is captured where the workstation remains stable,
- the benchmark distinguishes repository-integrated from search-scale snapshot mode,
- no million-record corpus or large source binaries are committed to Git.
