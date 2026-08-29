# Local Cloud Search Laboratory

This directory owns **PI-2**, the infrastructure/topology project for Civics Research Repository.

It intentionally does **not** own source ingestion or corpus creation. Those belong to [`documentation/federation/`](../federation/), which produces the deterministic 10K/100K/1M-class corpus manifests and normalized data that PI-2 consumes.

## Project question

PI-2 asks:

> When the exact same normalized corpus and queries move from standalone Docker Compose search engines to SolrCloud and multi-node OpenSearch on local Kubernetes, what changes in latency, throughput, resilience, recovery and operational complexity?

The question is not simply whether Kubernetes is faster.

## Permanent supported topologies

### Topology A — Docker Compose standalone

```text
Docker Compose
  DSpace
  application PostgreSQL
  Spring API
  Solr standalone
  OpenSearch single node
  Angular UI
```

This topology remains permanently supported because it is:

- fastest to start,
- easiest to demonstrate,
- simplest for debugging,
- cheapest in CPU/RAM,
- the reference baseline for clustered experiments,
- likely the better daily environment when one user is exploring a small corpus.

Kubernetes does not replace it.

### Topology B — local Kubernetes cluster

```text
kind Kubernetes
  SolrCloud
    Solr pods
    ZooKeeper
    sharded collection
  multi-node OpenSearch
    sharded index
  optional Spring API
  persistent volumes
  Services
  probes
  benchmark/evidence runner
```

This topology exists for:

- distributed search,
- concurrency,
- node-loss/recovery,
- shard/replica experiments,
- resource isolation,
- persistence/restart behavior,
- production-shaped operational rehearsal.

## PI dependency

PI-2 begins after PI-1 has produced at least stable 10K and 100K corpora and the 1M pipeline is either complete or far enough along to be repeatable.

```text
PI-1 federation
  -> corpus manifest + normalized source definition
  -> standalone Solr/OpenSearch baseline
  -> semantic query set

PI-2 cloud
  -> consume identical corpus/query definitions
  -> cluster topology experiments
```

PI-2 must not create a separate ad hoc data generator merely because Kubernetes is easier to test with synthetic documents.

## Documents

- [Local Kubernetes Search Cluster](local-kubernetes-search-cluster.md) — kind, SolrCloud, multi-node OpenSearch, topology variants, resilience tests and EKS portability.
- [Federated Metadata Expansion](../federation/README.md) — PI-1 corpus/source project.
- [Million-Record Federated Metadata Corpus](../federation/million-record-corpus.md) — corpus definitions consumed here.
- [Program Increment Plan](../../planning/PI_PLAN.md) — dependency, exit criteria and cross-PI invariants.
- [AWS Modernization](../aws-modernization.md) — later production-cloud direction.
- [Search Performance Evidence](../search-performance-evidence.md) — measurement discipline that PI-2 must preserve.

## Required comparison rule

A clustered result has no meaning without its standalone control.

For every significant topology experiment, keep constant where possible:

- corpus manifest/projection identity,
- normalized fields,
- query definitions,
- relevance semantics,
- analyzer/mapping/schema intent,
- warm-up/sample methodology.

Then vary topology explicitly:

- node count,
- shards,
- replicas,
- pod CPU/memory,
- JVM heap,
- storage,
- request concurrency.

## Evidence dimensions

PI-2 should record:

- API elapsed p50/p95/p99,
- Solr `QTime`,
- OpenSearch `took`,
- throughput,
- errors/timeouts,
- indexing duration,
- node/shard/replica state,
- host/Docker/kind resources,
- recovery times,
- projection parity after recovery.

Semantic correctness remains a gate: clustered results must not silently change search behavior just because deployment configuration changed.

## Why this remains useful with one user

With low concurrency, clustered search may be equal or slower because fan-out/coordination has overhead.

PI-2 is still valuable because it can answer questions that standalone cannot:

- Does throughput improve under concurrency?
- What happens when a node disappears?
- Do replicas preserve availability?
- How long does recovery take?
- How much memory/disk does resilience cost?
- At what corpus size does shard parallelism begin to help?
- Is the added complexity justified for this workload?

A valid conclusion may be that standalone remains best for the local demo while Kubernetes provides a useful resilience/scaling laboratory.

## Path to AWS

The local lab should use concepts that transfer to EKS—operators/Helm, Services, probes, persistent volumes, resource requests/limits and versioned configuration—without claiming kind performance predicts cloud performance.

AWS infrastructure remains a later project informed by the evidence produced here.

## Non-goals

PI-2 does not:

- own or redesign source adapters,
- redefine record provenance,
- make Kubernetes mandatory for ordinary development,
- delete the Compose topology,
- assume replicas reduce latency,
- assume more shards are always better,
- equate kind workers with separate physical hosts,
- claim local measurements are production capacity estimates.
