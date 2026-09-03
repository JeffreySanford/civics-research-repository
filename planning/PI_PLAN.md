# Program Increment Plan

This plan reflects the repository's current state after the certified C2 standalone milestone. Historical increment names remain useful context, but the active completion path is now intentionally narrow.

```text
PI-1 Federated Metadata Expansion / Standalone Evidence   COMPLETE
        |
        v
C2.1 adversarial standalone validation                   ACTIVE (#47)
        |
        +--> Manual accessibility evidence               ACTIVE (#49)
        |
        v
Final frontend mission alignment                         FINAL (#51)

Local Kubernetes / clustered topology                    DEFERRED (#48 closed not planned)
AWS / IaC                                                 OPTIONAL
```

Docker Compose remains the default fast development/demo path and the standalone control topology.

## Current position — September 3, 2026

The certified C2 control baseline is:

```text
DSpace curated authority                     181
Application PostgreSQL federated retention   1,000,000
  Data.gov                                    500,000
  DOE OSTI                                    500,000
                                              ---------
Solr normalized projection                    1,000,181
OpenSearch normalized projection              1,000,181
```

Identities:

- profile: `FEDERATED_1M`
- composition SHA-256: `e2c7cceb641589715a6390cb35846a67d7361fb15ec00fe3445a3e0036a5524b`
- projection ID: `3d461a9feb49f7239f3f6aaacb0c90f1ff43d0c683238acc2202c841154db44d`
- Gold Master archive ID: `federated-1m-1788269110268-985ce2bd`

The certified standalone baseline includes:

- bounded/reproducible federated persistence and projection;
- restart-safe active corpus identity;
- exact source quota enforcement;
- Solr/OpenSearch count and projection parity;
- deep cursor/search-after traversal with no gaps or duplicates;
- stable semantic comparison matrices;
- raw paired timing samples;
- independently warmed batches;
- balanced seeded randomized engine order;
- workload classes for full text, facets, broad filters and program filters;
- concurrency 1 / 8 / 32;
- CPU, memory, JVM/GC and container telemetry;
- automated statistical synthesis;
- certified performance evidence exposed through the repository API and Angular Evidence UI.

The C2 result is scoped to the documented corpus, mappings, workloads, versions and local/container topology. It is not a universal ranking of Solr and OpenSearch.

## PI-1 — Federated Metadata Expansion / Standalone Evidence

PI-1 established a reproducible Open Science/federal-repository control topology in which:

- DSpace remains authoritative for curated repository objects;
- external publishers remain authoritative for federated source records/resources;
- application PostgreSQL retains reproducible federated metadata/evidence;
- Solr and OpenSearch remain rebuildable derived projections;
- Angular consumes a typed Spring/OpenAPI boundary rather than engine-specific APIs.

For the standalone control baseline, PI-1 is complete because the exact C2 corpus/Gold Master, deterministic projection identity, semantic/projection parity gates, versioned workload definitions, standalone performance/resource evidence and ordinary small/demo Compose startup are all reproducible.

Optional source, map and search breadth remains future work only when it answers a new question.

## C2.1 — Adversarial standalone validation (#47)

C2.1 is the final planned search-research experiment, not unfinished C2 work.

Protocol: [C2 Adversarial Validation Protocol](C2_ADVERSARIAL_VALIDATION_PROTOCOL.md)

It intentionally attempts to falsify the current Solr-favoring C2 observation by strengthening controls in ways that may help OpenSearch:

- exact pinned engine versions/digests;
- explicit/equalized resource controls;
- semantically validated OpenSearch optimizations;
- a preregistered Q01-Q20 full-text matrix;
- broad/moderate/genuinely selective filter bands;
- p50/p90/p95/p99;
- independently warmed batches;
- balanced randomized order;
- multiple clean engine/container restart blocks.

Success means the protocol is reproducible, capable of contradicting C2 and reports whatever result occurs.

## Local Kubernetes topology research — deferred

Issue #48 is closed **not planned** for the current completion path.

A local kind/SolrCloud/OpenSearch cluster would change topology and could change absolute or relative latency through networking, scheduling, cgroup, shard/replica and multi-JVM effects. On one physical workstation, that is a different research question rather than a cleaner fairness test of the standalone engines.

Reopen clustered topology only if a concrete need emerges for deployment, resilience, failover or cloud-migration research. Compose remains the controlled standalone baseline.

## Manual Accessibility Evidence (#49)

Close the human-verification gap that lint, axe, Storybook and Playwright cannot prove.

Required evidence includes:

- full keyboard-only application review;
- Search Lab and Evidence keyboard/focus flows;
- Maps visual/nonvisual equivalence and MapLibre focus-path review;
- NVDA in Firefox and Chrome/Chromium;
- JAWS where available, otherwise explicit N/A with reason;
- cognitive/workflow review;
- WCAG 2.2 manual focus/dragging/target-size checks;
- federal ICT Testing Baseline / Trusted Tester crosswalk.

Every manual result must be dated and commit-bound. Automated evidence never substitutes for manual assistive-technology evidence.

## Browser Evidence Governance

The dedicated browser evidence architecture is delivered. Remaining governance decisions are optional product hardening:

- which WCAG/Section 508-oriented jobs become required merge checks;
- whether `main` receives branch protection;
- how prior known-good evidence is retained when a refresh fails.

## Final portfolio-facing slice — #51

After #47 and #49, the final product slice is frontend mission alignment and polish.

The repository should present itself first as a government-grade Angular Open Science/data-discovery frontend, with the full-stack and search-research work serving as technical evidence underneath it.

The final presentation should emphasize:

- Angular 22 + NgRx/RxJS architecture;
- generated OpenAPI TypeScript clients;
- search/facet URL state;
- loading/empty/error/partial-service states;
- research-object provenance;
- MapLibre with semantic list/table equivalence;
- Section 508/WCAG evidence;
- Storybook/Playwright/axe/manual verification;
- performance-aware behavior against a realistic million-record backend.

The independence/non-affiliation disclaimer remains mandatory.

## Optional infrastructure / AWS

AWS/IaC is not part of the completion path. If deployment becomes a real requirement later, choose Terraform or CDK from actual deployment needs and measured resource behavior rather than from a local Kubernetes prerequisite.

## Cross-program invariants

1. DSpace remains authoritative for curated repository objects.
2. External publishers remain authoritative for federated source records.
3. Search engines remain derived state.
4. A corpus has deterministic provenance/identity before performance is interpreted.
5. Solr/OpenSearch comparisons require equivalent normalized input and semantic gates.
6. Topology changes must not silently change record meaning.
7. Compose remains the default fast development/demo baseline.
8. Performance and semantic quality remain separate evidence dimensions.
9. Automated accessibility evidence never substitutes for required manual evidence.
10. Failed evidence runs never overwrite a prior known-good baseline.
11. Certified C2 remains immutable historical/control evidence; new experiments are versioned separately.
