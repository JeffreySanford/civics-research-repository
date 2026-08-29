# Local Kubernetes Search Cluster

## Purpose

Create an optional local Kubernetes topology that turns the current standalone search services into a production-shaped search laboratory:

- standalone Solr -> **SolrCloud**,
- single-node OpenSearch -> **multi-node OpenSearch**,
- Docker Compose service wiring -> **Kubernetes Services, StatefulSets/operators, persistent volumes and probes**,
- one-shot latency observations -> **topology-aware latency, throughput and resilience evidence**.

The implementation should preserve Docker Compose as the normal development path.

## Why kind

Use **kind** for the first local cluster. kind runs Kubernetes nodes as Docker containers, which matches the repository's existing Docker-based workflow and makes complete test clusters cheap to create and destroy.

Reference: <https://kind.sigs.k8s.io/>

The repository should eventually expose reproducible commands such as:

```bash
pnpm k8s:create
pnpm k8s:build
pnpm k8s:deploy
pnpm k8s:reindex
pnpm k8s:benchmark
pnpm k8s:destroy
```

These are target commands, not current scripts.

## Proposed topology

### Kubernetes nodes

Start with one control-plane node and three worker nodes inside kind so pod placement and failure experiments are visible even though all nodes still share the same physical workstation.

```text
Windows / Docker host
  kind-control-plane
  kind-worker
  kind-worker2
  kind-worker3
```

This is useful for orchestration and scheduling experiments, but it must not be described as equivalent to four physical hosts.

### SolrCloud

Use the official Apache Solr Operator to manage SolrCloud. The operator manages SolrCloud rather than standalone Solr and supports scaling the Solr node count.

Reference: <https://apache.github.io/solr-operator/>

Initial target:

```text
SolrCloud: discovery
  Solr pods: 3
  ZooKeeper: managed/external operator dependency
  collection: discovery
  primary experiment: 2 shards, 1 replica each
```

Topology variants:

| Variant | Solr pods | Shards | Replicas per shard | Purpose |
| --- | ---: | ---: | ---: | --- |
| S0 | 1 | 1 | 1 | Kubernetes overhead baseline |
| S1 | 3 | 1 | 1 | node overhead without shard fan-out |
| S2 | 3 | 2 | 1 | distributed query baseline |
| S3 | 3 | 3 | 1 | more shard parallelism |
| S4 | 3+ | 2-3 | 2 | availability/replica experiment |

A collection layout should never be changed mid-measurement without recording a new topology identity.

### OpenSearch

Use either the official OpenSearch Kubernetes Operator or the official Helm chart. The operator is attractive for lifecycle/failure experiments; Helm is a simpler first deployment if operator complexity slows the initial lab.

References:

- <https://docs.opensearch.org/latest/install-and-configure/install-opensearch/operator/index/>
- <https://docs.opensearch.org/latest/install-and-configure/install-opensearch/helm/>

The official Helm chart defaults to a three-node cluster, and the operator's quickstart requires at least three cluster-manager/master-role nodes. The local lab should therefore budget memory explicitly rather than assume the current single-node settings can simply be tripled.

Initial target:

```text
OpenSearch cluster
  pods: 3
  index: discovery-comparison
  primary experiment: 2 primary shards, 0 replicas
```

Topology variants:

| Variant | Nodes | Primaries | Replicas | Purpose |
| --- | ---: | ---: | ---: | --- |
| O0 | 1* | 1 | 0 | conceptual current baseline; operator may require 3 nodes |
| O1 | 3 | 1 | 0 | cluster coordination overhead |
| O2 | 3 | 2 | 0 | distributed query baseline |
| O3 | 3 | 3 | 0 | more primary-shard parallelism |
| O4 | 3+ | 2-3 | 1 | availability/replica experiment |

`O0` should remain the Docker Compose baseline if the selected Kubernetes deployment mechanism does not support a single-node operator topology.

## Application deployment stages

Do not move the entire platform into Kubernetes on day one. Build confidence in layers.

### Stage K0 — Preserve Compose baseline

Keep the current verified Compose topology and performance artifact as the reference point.

### Stage K1 — Search services only

Run SolrCloud and OpenSearch in kind while Spring/Angular/DSpace/PostgreSQL remain in Compose or on the host.

Purpose:

- validate cluster addressing,
- validate indexing/reindexing,
- validate projection parity,
- compare search-service overhead with minimal unrelated change.

### Stage K2 — Spring API in Kubernetes

Move the repository API into kind and connect it to both clustered search engines.

Purpose:

- Kubernetes service discovery,
- readiness/liveness probes,
- resource limits,
- local network-path realism.

### Stage K3 — Full application laboratory

Move the production-shaped runtime into kind where practical:

- Spring API,
- SolrCloud,
- OpenSearch,
- PostgreSQL or an explicitly externalized database,
- optional DSpace deployment,
- persistent volumes,
- ingress/port-forwarding for the UI/API.

The Angular dev server does not need to be containerized merely to make the search benchmark valid; frontend deployment can be handled separately.

## Resource policy

The workstation can support a meaningful experiment, but six JVM-backed search pods plus ZooKeeper and application services can waste memory quickly. Start with explicit conservative requests/limits and increase them when measurement shows pressure.

Record for every run:

- CPU request and limit per pod,
- memory request and limit per pod,
- JVM heap per Solr/OpenSearch node,
- Kubernetes node count,
- Docker Desktop CPU/memory allocation,
- storage class and volume size,
- host free memory before the run.

Never compare two topologies if one is silently memory-throttled or swapping.

## Performance experiment design

### Measurement boundaries

Preserve the existing distinction:

- API elapsed = Spring-side HTTP request boundary,
- Solr engine reported = `responseHeader.QTime`,
- OpenSearch engine reported = top-level `took`.

Do not rename `QTime` and `took` into one supposedly identical "engine execution" metric.

### Sample discipline

Initial run protocol:

```text
warm-ups: 5 or more
measured requests: 100 or more
single-query concurrency: 1
load checkpoints: 8 and 32 concurrent requests
statistics: min / mean / p50 / p95 / p99 / max
```

At concurrency greater than one, add:

- completed requests/second,
- total requests,
- error count,
- timeout count,
- retry count,
- CPU/memory utilization where available.

### Engine order

The current comparison path runs Solr then OpenSearch. That is useful diagnostic evidence but not a fair basis for declaring a winner.

Before comparative performance conclusions, add a benchmark mode that can:

- alternate engine order,
- randomize engine order with a recorded seed, or
- benchmark engines in separate equivalent runs.

The application comparison workflow can remain deterministic; the dedicated benchmark harness can own balanced execution.

## Resilience experiments

Kubernetes becomes especially valuable because failure behavior can be tested deliberately.

### SolrCloud

Example failure experiment:

```bash
kubectl delete pod <solr-pod>
```

Record:

- whether search remains available,
- latency/error changes during loss,
- collection health,
- replica promotion/recovery behavior,
- pod recreation time,
- projection parity after recovery.

### OpenSearch

Repeat the equivalent node-loss experiment and record:

- cluster health transitions,
- search availability,
- shard relocation/recovery,
- latency/error changes,
- parity after recovery.

### Application evidence

Admin Sync and Evidence should eventually show degraded/recovering/healthy search topology state rather than only a binary reachable/unreachable result.

## Storage and restart experiments

For both engines:

1. index a known projection,
2. record projection ID and document count,
3. restart pods,
4. verify data survives,
5. delete/recreate one pod,
6. verify recovery from persistent storage/replicas,
7. rerun parity checks.

The point is to distinguish **pod lifecycle** from **data lifecycle**.

## Path toward EKS

The local laboratory should deliberately use concepts that transfer to the documented AWS target:

```text
kind                            EKS
Kubernetes Service      ->      Kubernetes Service / ALB/Ingress
PVC / local storage     ->      EBS/EFS or managed persistence decision
Secret                  ->      Kubernetes Secret + AWS secret-management decision
operator/Helm values    ->      versioned deployment configuration
resource limits         ->      node-group/pod sizing
health probes           ->      production health probes
benchmark artifact      ->      environment-bound performance evidence
```

Do not claim kind performance predicts EKS performance. The value is configuration portability and operational rehearsal.

## Acceptance criteria for the first Kubernetes slice

The first slice is complete when:

- a kind cluster is created from repository scripts/configuration,
- SolrCloud starts with at least three Solr pods,
- OpenSearch starts as a multi-node cluster,
- the same normalized projection reaches both engines,
- projection ID and expected document count match,
- Search Lab can query both clustered engines through Spring,
- current Docker Compose remains functional,
- a 181-record baseline and at least a 10K-record corpus are measured,
- benchmark output records topology/shard/replica/resource context,
- at least one deliberate node-loss/recovery test is automated or reproducibly documented,
- no result claims Kubernetes is faster merely because the deployment is distributed.
