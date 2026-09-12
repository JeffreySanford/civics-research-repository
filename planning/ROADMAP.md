# Roadmap

This roadmap contains **future outcomes only**. Delivered phases belong in [documentation/history/platform-evolution.md](../documentation/history/platform-evolution.md), generated repository facts live in [documentation/platform-status.md](../documentation/platform-status.md), and the certified C2/C2.1 research record is retained in the federation/evidence documentation.

The repository-wide rule remains: **testing and evidence precede feature expansion**.

## Current completed baseline

The major research and portfolio milestones are complete:

- certified standalone C2 corpus and Gold Master recovery;
- exact 500K Data.gov + 500K DOE OSTI federated composition;
- 1,000,181-document Solr/OpenSearch projection parity including 181 curated DSpace records;
- adversarial C2.1 Solr/OpenSearch validation under frozen controls (#47 complete);
- frontend-first portfolio/mission alignment (#51 complete);
- second Angular mobile-first discovery frontend (`apps/census-mobile-frontend`);
- shareable search/filter state, scalable cursor traversal, server-owned rank/relevance, typed match evidence and query-wide search summary;
- authority-neutral mobile research detail, typed research-package navigation and related-research traversal;
- shared rank, relevance and `Why this matched` explainability semantics across both Angular frontends (#97 / PR #103);
- one complete mobile search design lifecycle from wireframe through Storybook, production implementation and automated evidence (#98 / PR #104);
- automated responsive/accessibility evidence across representative mobile/tablet widths;
- current actionable Dependabot alert set reduced to zero; accepted no-fix build-chain advisories remain documented in `RISKS.md`.

The project does **not** need another million-record run merely to prove that the first million works, and C2/C2.1 must remain immutable historical/control evidence.

## Active sequence

```text
#99  Read-only repository steward/status surface
```

### #99 — Read-only repository steward/status surface

Add a small internal-facing status workflow using existing authority, synchronization, corpus/projection and search-health data.

Outcome target:

- current corpus/profile and projection identity;
- search-engine count/parity and active-status context;
- repository/application authority boundaries;
- existing synchronization/adapter and automated-evidence status where available;
- explicit degraded/fallback states;
- typed API boundary, responsive behavior and browser/axe evidence;
- read-only behavior first, with no secrets or privileged mutation surface.

The first slice intentionally reuses existing generated API/client contracts and the existing non-mutating Solr/OpenSearch projection-parity presentation. Backend schema expansion is not required unless an actual missing fact is identified.

## Accessibility scope boundary

Issue #49 is closed **not planned**. The repository continues to distinguish automated accessibility evidence from human assistive-technology verification.

Automated lint, Storybook, Playwright and axe results must **not** be described as completed manual Section 508 testing, Trusted Tester certification, NVDA/JAWS/VoiceOver validation or complete conformance.

The existing manual-testing protocols remain useful documentation/templates but are not an active completion gate.

## Deferred topology / infrastructure work

Local Kubernetes, SolrCloud/OpenSearch clustering and AWS/IaC are **not prerequisites** for the current product path.

Reopen topology work only if the project gains a concrete need to study clustered resilience/failover, production/cloud deployment, shard/replica behavior across nodes, or physical/cloud capacity planning.

A one-workstation kind cluster should not be treated as cleaner standalone engine evidence or as a proxy for cloud performance.

## Optional federation/source expansion

Additional sources are not prerequisites for the certified baseline. Pursue them only when they answer a new research/product question:

1. NASA Earthdata CMR collection/granule spatial-temporal evidence;
2. PubMed bibliographic/abstract ingestion after DOI/PMID reconciliation is explicit;
3. OpenAlex scholarly/citation relationships after the federal-source identity model remains stable.

Prefer bounded/reproducible source paths and publisher bulk/snapshot mechanisms over millions of ordinary API requests.

## Optional Maps expansion

Issue #69 remains the parking lot for deferred thematic/federated map layers. County Business Patterns, Population Estimates and USGS 3DEP work already promoted from earlier planning must not be listed as future work.

Remaining candidates include Business Dynamics Statistics, repository research-by-area summaries, bounded NASA CMR coverage, Building Permits, Economic Census and weighted PUMS aggregates.

Rules:

- reuse authoritative shared geometry keyed by stable identifiers;
- keep browser feature payloads bounded;
- keep spatial enrichment outside the certified C2/C2.1 corpus identity unless explicitly versioned as a new research experiment;
- never infer research geography from publisher/institution location;
- preserve semantic list/table equivalents and keyboard operation for meaningful visual layers.

## Optional search breadth

Richer scenarios may include phrase/highlighting improvements, geo, autocomplete/suggest, synonyms, nested/object fields and vector/hybrid search. These are breadth experiments, not missing requirements in the certified lexical baseline.

## Cross-cutting product/governance work

- Define DOI/PMID/other durable cross-source reconciliation rules before bibliographic expansion.
- Record publisher freshness where reliable dates exist.
- Expose projection/index timestamps consistently across user/admin evidence surfaces.
- Improve opaque publisher program labels without replacing raw metadata with a fixed allowlist.
- Replace remaining dataset-shaped copy where the object may be publication, software, methodology, project or granule.
- Decide which browser/accessibility jobs become required checks and whether `main` receives branch protection.
- Continue typed API error and contract/integration-test hardening.

## Non-goals

The roadmap does not include replacing DSpace with a search engine, making search indexes authoritative, forcing federated records into DSpace, downloading millions of binaries merely to inflate scale, running million-record work in ordinary PR CI, inferring research geography from publisher location, rendering raw microdata people/households as map points, sending unbounded spatial data to MapLibre, exposing raw search-engine diagnostics as a public contract, or claiming complete Section 508 conformance from automated scans.
