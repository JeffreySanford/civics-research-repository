# Program Increment Plan

This plan reflects the repository's current state after the certified C2/C2.1 search-research program, frontend mission alignment, mobile-first frontend delivery and dependency-security cleanup.

```text
PI-1 Federated Metadata Expansion / Standalone Evidence   COMPLETE
C2.1 adversarial standalone validation                   COMPLETE (#47)
Frontend mission / portfolio alignment                   COMPLETE (#51)
Mobile-first search-to-research experience               COMPLETE through PR #95
Dependency security cleanup                              COMPLETE (#96)
Manual accessibility evidence                            NOT PLANNED (#49)

Current continuation:
#97 Shared result explainability
        |
        v
#98 Design lifecycle evidence
        |
        v
#99 Read-only steward/status workflow

Local Kubernetes / clustered topology                    DEFERRED (#48 closed not planned)
AWS / IaC                                                 OPTIONAL
```

Docker Compose remains the default fast development/demo path and the standalone control topology.

## Current position — September 12, 2026

The certified C2 control baseline remains:

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

The certified standalone baseline includes bounded/reproducible federated persistence and projection, restart-safe active corpus identity, exact source quota enforcement, Solr/OpenSearch parity, deep traversal, semantic comparison, raw paired timing samples, independently warmed batches, seeded balanced engine order, workload classes, concurrency 1/8/32, resource telemetry, automated statistical synthesis and Evidence UI productization.

C2.1 then completed the adversarial standalone validation under frozen controls. Its results remain separately versioned from C2 and do not overwrite the certified control baseline.

The search-engine claims remain scoped to the documented corpus, mappings, workloads, versions, resources and local/container topology. They are not universal rankings of Solr and OpenSearch.

## Product/UI increment delivered

The project now contains two Angular frontends over the same generated API boundary:

```text
apps/discovery-ui                 :4200
apps/census-mobile-frontend       :4300
            |
            v
     repository-api              :8080/api
```

The mobile-first increment delivered:

- module-based Angular composition;
- NgRx/RxJS ownership of shared asynchronous search/detail state;
- local Signals only for appropriate synchronous presentation state;
- shareable query/filter URL intent;
- cursor-based large-result traversal;
- server-owned global rank and query-relative relevance evidence;
- query-wide result-type summary from authoritative facets;
- typed field/term match evidence;
- accessible mobile filter dialog and active filters;
- authority-neutral research detail;
- typed research-package relationships and related-research navigation;
- responsive/axe/browser evidence at representative mobile/tablet widths;
- shared rank/relevance primitives consumed by both Angular frontends.

The browser remains isolated from DSpace, Solr, OpenSearch and publisher APIs behind the Spring/OpenAPI boundary.

## Current continuation — #97, #98, #99

### #97 — Shared result explainability

Turn existing backend-owned rank/relevance/match evidence into one consistent accessible explanation experience across both Angular frontends using the existing `shared-ui` library.

The frontend must not invent ranking formulas, probabilities or raw engine explain contracts.

### #98 — Design lifecycle evidence

Capture one representative UI slice from wireframe/intent through annotated specification, Storybook, implementation and automated evidence so the design/engineering decision path is reviewable.

### #99 — Read-only repository steward/status workflow

Expose a focused internal-facing status experience from existing authority, synchronization, corpus/projection and search-health data. Keep the first slice read-only and typed through the application API.

## Accessibility evidence boundary

Issue #49 is closed **not planned**.

Automated template checks, Storybook/axe, Playwright, responsive/reflow tests and forced-colors evidence remain part of normal engineering quality. They must not be represented as completed manual NVDA/JAWS/VoiceOver testing, Trusted Tester execution, Section 508 certification or complete conformance.

Existing manual-check protocols remain useful templates/reference material but are not an active completion gate.

## Local Kubernetes topology research — deferred

Issue #48 is closed **not planned** for the current path.

A local kind/SolrCloud/OpenSearch cluster would change topology and can change absolute or relative latency through networking, scheduling, cgroup, shard/replica and multi-JVM effects. On one physical workstation, that is a different research question rather than a cleaner fairness test of the standalone engines.

Reopen clustered topology only if a concrete need emerges for deployment, resilience, failover or cloud-migration research. Compose remains the controlled standalone baseline.

## Browser evidence governance

The dedicated browser-evidence architecture is delivered. Remaining governance decisions are optional product hardening:

- which automated browser/accessibility jobs become required merge checks;
- whether `main` receives branch protection;
- how prior known-good evidence is retained when a refresh fails.

## Optional infrastructure / AWS

AWS/IaC is not part of the current continuation path. If deployment becomes a real requirement later, choose Terraform or CDK from actual deployment needs and measured resource behavior rather than from a local Kubernetes prerequisite.

## Cross-program invariants

1. DSpace remains authoritative for curated repository objects.
2. External publishers remain authoritative for federated source records/resources.
3. Application PostgreSQL retains reproducible federated metadata/evidence.
4. Search engines remain derived state.
5. A corpus has deterministic provenance/identity before performance is interpreted.
6. Solr/OpenSearch comparisons require equivalent normalized input and semantic gates.
7. Topology changes must not silently change record meaning.
8. Compose remains the default fast development/demo baseline.
9. Performance, semantic quality and accessibility evidence remain separate evidence dimensions.
10. Automated accessibility evidence is never described as manual AT verification.
11. Failed evidence runs never overwrite a prior known-good baseline.
12. Certified C2 and C2.1 remain immutable historical/control evidence; new experiments are versioned separately.
13. Both Angular frontends consume typed application APIs rather than binding directly to repository/search internals.
