# Cloud and Scale Laboratory

This directory describes the next infrastructure and scale experiments for Civics Research Repository. The goal is not to replace the fast Docker Compose development path. The goal is to create a reproducible laboratory for answering two larger questions:

1. How does the current standalone Solr/OpenSearch architecture behave when moved into a Kubernetes topology with SolrCloud and a multi-node OpenSearch cluster?
2. At what corpus size and request concurrency does distributed search begin to justify its coordination and infrastructure overhead?

The work deliberately keeps **architecture experiments** separate from **performance claims**. More pods do not automatically mean lower latency, especially when every Kubernetes node still shares one workstation's CPU, memory, disk and Docker engine.

## Documents

- [Local Kubernetes Search Cluster](local-kubernetes-search-cluster.md) — kind-based local Kubernetes, SolrCloud, multi-node OpenSearch, topology experiments, resilience tests and the path toward EKS.
- [Million-Record Corpus](million-record-corpus.md) — candidate federal/open-science metadata sources, staged corpus sizes, ingestion modes, provenance rules and 1M+ search-scale experiments.
- [AWS Modernization](../aws-modernization.md) — existing production-cloud direction. The local Kubernetes laboratory should become a reproducible stepping stone toward that architecture rather than a separate technology demonstration.
- [Search Performance Evidence](../search-performance-evidence.md) — current warm-up, percentile and API-versus-engine timing discipline that all scale experiments must preserve.

## Guiding architecture

The current local baseline remains intentionally simple:

```text
Docker Compose
  DSpace
  PostgreSQL
  Spring API
  Solr standalone
  OpenSearch single node
  Angular UI
```

The proposed scale laboratory adds a second, optional topology:

```text
kind Kubernetes cluster
  Spring API
  SolrCloud
    3 Solr pods
    ZooKeeper
    sharded collection
  OpenSearch
    3 OpenSearch pods
    sharded index
  persistent volumes
  Kubernetes Services
  health/readiness probes
  benchmark runner
```

Docker Compose remains the developer fast path. Kubernetes becomes the production-topology, resilience and scaling laboratory.

## Why this is worth doing even with one user

At the current small corpus and low concurrency, Kubernetes is unlikely to reduce single-request latency. A standalone Lucene-backed search node has less coordination overhead than a distributed query that fans out across shards and merges responses.

The experiment becomes valuable when one or more of these dimensions increase:

- corpus size,
- number of shards,
- replica count,
- request concurrency,
- indexing/reindexing load,
- node loss and recovery,
- resource limits,
- persistence and restart behavior.

The useful question is therefore not **"Is Kubernetes faster?"**. It is:

> At what corpus size and concurrency does distributed search begin paying for its coordination overhead, and what resilience or throughput benefits appear before or after that crossover?

## Required evidence discipline

Every scale experiment should record enough context to reproduce and interpret the result:

- source corpus and snapshot date,
- normalized document count,
- deterministic projection or snapshot identity,
- topology name,
- Solr shard/replica configuration,
- OpenSearch primary/replica configuration,
- pod CPU/memory requests and limits,
- JVM heap settings,
- persistence/storage class,
- warm-up count,
- measured sample count,
- request concurrency,
- API elapsed distribution,
- Solr `QTime` distribution,
- OpenSearch `took` distribution,
- throughput where concurrency is greater than one,
- fixed, balanced or randomized engine execution order,
- errors/timeouts/retries,
- machine and Docker/Kubernetes context.

Do not infer production superiority from one workstation, one query or one topology.

## Planned checkpoints

The initial scale matrix should use progressively larger normalized corpora:

| Checkpoint | Purpose |
| ---: | --- |
| 181 | preserve the current known baseline |
| 10,000 | validate ingestion, projection and cluster mechanics |
| 100,000 | expose indexing and memory behavior |
| 1,000,000 | first meaningful large-corpus search comparison |
| 5,000,000+ | optional stress tier after 1M is repeatable |

For each meaningful corpus size, compare at least concurrency `1`, `8` and `32` after the single-request path is stable.

## Non-goals

This laboratory does not imply that:

- Kubernetes is inherently faster than Docker Compose,
- OpenSearch scales horizontally while Solr does not,
- a three-pod cluster on one workstation behaves like three physical nodes,
- every harvested public record belongs permanently in DSpace,
- full-text artifacts should be downloaded merely to inflate corpus size,
- benchmark-only snapshots are equivalent to repository-backed Open Science evidence,
- a local benchmark establishes production capacity or cost.

The laboratory exists to make those distinctions measurable.