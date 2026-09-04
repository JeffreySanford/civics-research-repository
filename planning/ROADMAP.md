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

## Near-term completion sequence

```text
#46  Close/freeze certified C2 documentation
        |
        +--> #47  C2.1 adversarial standalone validation
        |
        +--> #49  Manual accessibility evidence
                    |
                    v
#51  Final frontend mission alignment / portfolio polish
```

Issue #48, the local Kubernetes topology laboratory, is closed as not planned for this completion path. A clustered topology remains a legitimate future experiment only if deployment/resilience becomes a real requirement.

## #47 — C2.1 adversarial validation

C2.1 is the final planned search-research experiment. It is designed to challenge the existing Solr-favoring observation, not reinforce it by construction.

The protocol is frozen in [C2_ADVERSARIAL_VALIDATION_PROTOCOL.md](C2_ADVERSARIAL_VALIDATION_PROTOCOL.md) before new C2.1 timing data are collected.

Outcome target:

- exact pinned engine versions;
- explicit/equalized resource controls;
- semantically validated OpenSearch optimizations;
- preregistered Q01-Q20 full-text matrix;
- broad/moderate/genuinely selective filter bands;
- p50/p90/p95/p99;
- independently warmed batches;
- balanced randomized order;
- multiple clean engine/container restart blocks;
- reporting that retains every preregistered cell, including OpenSearch wins or inconclusive cells.

C2.1 succeeds if it is reproducible and capable of contradicting C2. Solr does not need to win for the experiment to succeed.

## #49 — Manual accessibility evidence

The automated accessibility architecture is mature; remaining work is human verification.

Outcome target:

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

Outcome target:

- frontend-first README hierarchy;
- Angular/NgRx/OpenAPI/accessibility case study;
- concise 5-8 minute UI-focused demo path;
- final polish audit of Discovery, research detail, Maps, Evidence and Search Lab;
- explicit browser ownership boundary;
- full-stack/search research retained as technical depth under the UI story;
- non-affiliation language preserved.

## Deferred topology / infrastructure work

Local Kubernetes, SolrCloud/OpenSearch clustering and AWS/IaC are **not prerequisites** for completing the current repository.

They may be reopened later if the project gains a concrete need to study:

- clustered resilience or failover;
- production/cloud deployment;
- shard/replica behavior across nodes;
- physical/cloud capacity planning.

A one-workstation kind cluster should not be treated as cleaner standalone engine evidence or as a proxy for cloud performance.

## Optional federation/source expansion

Additional sources are not prerequisites for the certified standalone baseline. Pursue them only when they answer a new research/product question:

1. NASA Earthdata CMR collection/granule spatial-temporal evidence;
2. PubMed bibliographic/abstract ingestion after DOI/PMID reconciliation is explicit;
3. OpenAlex scholarly/citation relationships after the federal-source identity model remains stable.

Prefer bounded/reproducible source paths and publisher bulk/snapshot mechanisms over millions of ordinary API requests.

## Optional Maps expansion

Potential future additions include Population Estimates, County Business Patterns, Business Dynamics Statistics, Building Permits, Economic Census, weighted PUMS aggregates and one configurable 3DEP terrain/reference layer.

Rules:

- reuse authoritative shared geometry keyed by stable identifiers;
- keep browser feature payloads bounded;
- keep Data.gov spatial enrichment in a versioned sidecar so C2 identity is unchanged;
- never infer research geography from publisher/institution location;
- preserve semantic list/table equivalents and keyboard operation for every visual layer.

## Optional search breadth

After C2.1, richer scenarios may include phrase search/highlighting, geo, autocomplete/suggest, synonyms, nested/object fields and vector/hybrid search. These are breadth experiments, not missing requirements in the certified lexical baseline.

## Cross-cutting product/governance work

- Define DOI/PMID/other durable cross-source reconciliation rules before bibliographic expansion.
- Record publisher freshness where reliable dates exist.
- Expose projection/index timestamps consistently across user/admin evidence surfaces.
- Improve opaque publisher program labels without replacing raw metadata with a fixed allowlist.
- Replace remaining dataset-shaped copy where the object may be publication, software, methodology, project or granule.
- Decide which browser/accessibility jobs become required checks and whether `main` receives branch protection.
- Move NgRx release-candidate dependencies to stable versions after validation.

## Non-goals

The roadmap does not include replacing DSpace with a search engine, making search indexes authoritative, forcing federated records into DSpace, downloading millions of binaries merely to inflate scale, running million-record work in ordinary PR CI, inferring research geography from publisher location, rendering raw microdata people/households as map points, sending unbounded spatial data to MapLibre, or claiming complete Section 508 conformance from automated scans.
