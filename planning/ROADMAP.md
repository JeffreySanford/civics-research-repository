# Roadmap

This roadmap contains **future outcomes only**. Delivered phases belong in [documentation/history/platform-evolution.md](../documentation/history/platform-evolution.md), generated repository facts live in [documentation/platform-status.md](../documentation/platform-status.md), and the certified C2 standalone milestone is recorded in [documentation/federation/scale-evidence.md](../documentation/federation/scale-evidence.md).

The repository-wide rule remains: **testing and evidence precede feature expansion**.

## Certified control baseline

The standalone Compose research baseline is complete:

```text
DSpace curated authority: 181
        +
Application PostgreSQL federated retention: 1,000,000
  500K Data.gov + 500K DOE OSTI
        ↓
Solr:       1,000,181
OpenSearch: 1,000,181
```

The baseline includes deterministic composition/projection identity, Gold Master recovery, restart-safe activation, deep traversal, semantic comparison gates, paired timing evidence, randomized independent batches, concurrency 1/8/32, resource telemetry, automated statistical synthesis and an accessible Evidence UI.

The project does **not** need another million-record run merely to prove that the first million works.

## Near-term sequence

```text
#46  Close/freeze certified C2 documentation
        |
        +--> #47  C2.1 adversarial standalone validation
        |
        +--> #48  PI-2 Kubernetes topology research
        |
        +--> #49  Manual accessibility evidence
                    |
                    v
#51  Final frontend mission alignment / portfolio polish
```

## #47 — C2.1 adversarial validation

C2.1 is optional follow-up research designed to challenge the existing Solr-favoring observation.

The protocol is frozen in [C2_ADVERSARIAL_VALIDATION_PROTOCOL.md](C2_ADVERSARIAL_VALIDATION_PROTOCOL.md) before new C2.1 timing data are collected.

Future outcome:

- exact pinned engine versions;
- explicit/equalized resource controls;
- semantically validated OpenSearch optimizations;
- preregistered multi-query full-text matrix;
- broad/moderate/genuinely selective filter bands;
- p50/p90/p95/p99;
- more independently warmed batches;
- balanced randomized order;
- multiple clean engine/container restart blocks;
- reporting that retains every preregistered cell, including OpenSearch wins.

C2.1 succeeds if it is reproducible and capable of contradicting C2. Solr does not need to win for the experiment to succeed.

## #48 — PI-2 local Kubernetes search laboratory

PI-2 makes topology the experimental variable while preserving the frozen corpus/query contracts.

Future outcome:

- repository-owned kind lifecycle;
- SolrCloud through the official Solr Operator and ZooKeeper;
- supported multi-node OpenSearch deployment;
- explicit shards/replicas/heap/CPU/memory/storage metadata;
- unchanged Angular/Spring request semantics;
- identical 10K/100K/1M corpus/query definitions;
- 1/8/32 client comparisons;
- controlled node-loss/recovery per engine;
- post-recovery projection identity/parity evidence.

Compose remains the default fast development/demo path and standalone control topology. Kind results are local clustered evidence, never a proxy for physical/cloud-node performance.

## #49 — Manual accessibility evidence

The automated accessibility architecture is mature; remaining work is human verification.

Future outcome:

- dated/commit-bound keyboard-only evidence;
- NVDA in Firefox and Chrome/Chromium;
- JAWS or explicit N/A with licensing reason;
- Search Lab and Evidence focus/read-order review;
- Maps/MapLibre focus-path and visual/nonvisual equivalence review;
- cognitive/workflow review;
- WCAG 2.2 focus-not-obscured, dragging-alternative and target-size checks;
- current federal ICT Testing Baseline / Trusted Tester crosswalk.

Automated axe, Storybook and browser evidence never substitute for these manual checks.

## #51 — Final frontend mission alignment and portfolio polish

The intended final product-facing milestone is to make the repository present itself first as a government-grade Angular Open Science/data-discovery frontend.

Future outcome:

- frontend-first README hierarchy;
- Angular/NgRx/OpenAPI/accessibility case study;
- concise 5-8 minute UI-focused demo path;
- final polish audit of Discovery, research detail, Maps, Evidence and Search Lab;
- explicit browser ownership boundary;
- full-stack/search research retained as technical depth under the UI story;
- non-affiliation language preserved.

The backend/search work is not removed or minimized technically. It becomes evidence that the frontend is built against realistic authority, scale, latency and failure conditions.

## PI-3 — Infrastructure as Code / AWS

PI-3 is optional after PI-2.

Choose Terraform or CDK only after local clustered evidence provides defensible guidance for:

- node/pod sizing;
- shard/replica strategy;
- persistent storage;
- JVM/resource defaults;
- observability;
- backup/restore;
- readiness/liveness;
- deployment/rollback;
- whether both search engines are required outside the comparison laboratory.

## Optional federation/source expansion

Additional sources are no longer prerequisites for the certified standalone baseline.

Pursue them only when they answer a new research/product question:

1. NASA Earthdata CMR collection/granule spatial-temporal evidence;
2. PubMed bibliographic/abstract ingestion after DOI/PMID reconciliation is explicit;
3. OpenAlex scholarly/citation relationships after the federal-source identity model remains stable.

Prefer bounded/reproducible source paths and publisher bulk/snapshot mechanisms over millions of ordinary API requests.

## Optional Maps expansion

The existing category/accessibility architecture remains the pattern:

```text
Geography & Boundaries
Community & Economy
Environment & Hazards
Research Coverage
```

Potential future additions include Population Estimates, County Business Patterns, Business Dynamics Statistics, Building Permits, Economic Census, weighted PUMS aggregates and one configurable 3DEP terrain/reference layer.

Rules:

- reuse authoritative shared geometry keyed by stable identifiers;
- keep browser feature payloads bounded;
- keep Data.gov spatial enrichment in a versioned sidecar so C2 identity is unchanged;
- never infer research geography from publisher/institution location;
- preserve semantic list/table equivalents and keyboard operation for every visual layer.

## Optional search breadth

After C2.1/PI-2, richer scenarios may include:

- phrase search/highlighting;
- geo;
- autocomplete/suggest;
- synonyms;
- nested/object fields;
- vector/hybrid search.

These are breadth experiments, not missing requirements in the certified lexical baseline.

## Cross-cutting product/governance work

- Define DOI/PMID/other durable cross-source reconciliation rules before bibliographic expansion.
- Record publisher freshness where reliable dates exist.
- Expose projection/index timestamps consistently across user/admin evidence surfaces.
- Improve opaque publisher program labels without replacing raw metadata with a fixed allowlist.
- Replace remaining dataset-shaped copy where the object may be publication, software, methodology, project or granule.
- Decide which browser/accessibility jobs become required checks and whether `main` receives branch protection.
- Move NgRx release-candidate dependencies to stable versions after validation.

## Non-goals

The roadmap does not include replacing DSpace with a search engine, making search indexes authoritative, forcing federated records into DSpace, deleting Compose after Kubernetes, downloading millions of binaries merely to inflate scale, running million-record work in ordinary PR CI, inferring research geography from publisher location, rendering raw microdata people/households as map points, sending unbounded spatial data to MapLibre, or claiming complete Section 508 conformance from automated scans.
