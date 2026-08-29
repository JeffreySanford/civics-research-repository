# Active Backlog

This file contains open work only. Current status is generated in [documentation/platform-status.md](../documentation/platform-status.md); delivered history is in [documentation/history/platform-evolution.md](../documentation/history/platform-evolution.md).

The repository follows a **testing-first rule** for new comparison work: define or extend unit, use-case, contract, browser, accessibility and real-stack evidence before expanding the feature surface. A feature is not considered complete merely because it works in the local UI.

## P1 — Manual accessibility evidence

- [ ] Run Checklist 1 end to end without a mouse and record the result.
- [ ] Run Checklist 2 with NVDA in Firefox and Chrome.
- [ ] Run Checklist 3 with JAWS, or record N/A with the licensing reason.
- [ ] Complete Checklist 4, starting with the trusted map-click/map-to-list focus path.
- [ ] Complete Checklist 5 cognitive/workflow review.
- [ ] Decide whether to add a `contentinfo` landmark.
- [ ] Review the MapLibre canvas tab stop with a screen reader and document the decision.
- [ ] Run the Search Lab comparison flow with keyboard-only input and record scenario selection, filter entry, run action, live completion announcement, projection evidence and both engine result regions.

## P2 — Browser evidence CI and governance

- [x] Add a dedicated or scheduled full Playwright evidence workflow.
- [x] Upload Playwright HTML reports, traces and screenshots when the evidence workflow fails.
- [x] Run the Search Lab comparison scenarios in the dedicated browser workflow.
- [x] Run the Search Lab WCAG/Section 508 axe route in the dedicated browser workflow.
- [x] Add a real-stack smoke path that exercises browser -> Spring API -> Solr + OpenSearch instead of only mocked API routes.
- [ ] Decide whether WCAG/Section 508-oriented jobs are required merge checks.
- [ ] Decide whether `main` receives branch protection.
- [x] Ensure CI uses the same `evidence:check` and generated-document drift rules as local quality gates.

## P3 — Solr/OpenSearch comparison hardening

The first vertical slice is implemented: OpenSearch runs beside Solr, both receive the same normalized discovery projection, the projection has a deterministic SHA-256 identity, the API exposes typed comparison scenarios, and `/search-lab` renders side-by-side results with explicit projection-parity evidence. Remaining work is semantic-difference explanation and future scenario breadth, not a rewrite of repository ownership.

### Testing first

- [x] Add `SearchComparisonServiceTest` covering successful dual-engine execution, one-engine-down behavior, one-engine exception isolation, request normalization, engine warnings, current-projection parity and projection mismatch.
- [x] Add `SearchComparisonController` tests for scenario listing and comparison-run delegation/serialization.
- [x] Add Angular Search Lab unit tests for initial state, scenario loading, request construction, successful comparison rendering, partial engine failure and API error handling.
- [x] Add `RepositorySearchComparisonApi` unit tests for scenario and comparison endpoints.
- [x] Add HTTP-level OpenSearch request semantics coverage for self-excluding aggregations, keyword geography and descending vintage-year buckets.
- [x] Add Playwright comparison scenarios for faceting/aggregations, full-text relevance and filtering.
- [x] Add Search Lab to the automated axe WCAG/Section 508 route matrix.
- [x] Add Search Lab to the end-to-end demo storyboard.
- [x] Add a real-stack smoke test that proves the same request reaches live Solr and live OpenSearch through the Spring API.
- [x] Get the final branch head clean across format, OpenAPI drift, fixture/evidence/document drift, lint, unit tests, UI build, Java tests, runtime image and browser evidence.

### Admin Sync operational visibility

- [x] Extend Admin Sync from a Solr-only discovery projection view to a **search projection** view that explains DSpace -> normalized `DiscoveryDocument` -> deterministic projection ID -> Solr + OpenSearch.
- [x] Show the current projection ID and expected object count.
- [x] Show per-engine enabled/reachable/projected state, index name, indexed document count, projection ID, parity status and last warning.
- [x] Make the reindex action describe that one normalized document set is projected to every configured target; do not imply that Solr is the only public projection target.
- [x] Preserve the distinction that Solr remains the browser-facing discovery implementation while OpenSearch is currently the comparison target.
- [x] Add unit/accessibility coverage for the new Admin Sync search-projection state.

### Evidence-page visibility

- [x] Add a Search Engine Comparison evidence section to `/evidence`.
- [x] Surface the deterministic projection ID, normalized object count and whether Solr/OpenSearch parity is verified.
- [x] Surface automated evidence for Search Lab unit/use-case tests, Playwright scenarios, axe coverage and real-stack smoke coverage once each is actually executed.
- [x] Clearly distinguish **automated pass**, **manual pending**, **fixture/mocked browser evidence**, and **real-stack evidence**.
- [x] Do not convert API elapsed time into a production benchmark claim; timing evidence must state the environment and measurement boundary.
- [x] Add evidence-page unit/accessibility coverage for the comparison evidence presentation.

### Comparison behavior and documentation

- [x] Add OpenSearch to the default `start:all` Docker stack with persistent storage.
- [x] Implement OpenSearch indexing from the same normalized DSpace research object projection used by Solr.
- [x] Split projection targets from the browser-facing `DiscoveryIndex` contract.
- [x] Add deterministic projection fingerprinting and per-engine projection target state.
- [x] Add OpenAPI schemas and generated frontend types for comparison scenarios and responses.
- [x] Add Java comparison services behind explicit Solr/OpenSearch boundaries.
- [x] Add `/search-lab` with side-by-side engine results, facets/aggregations, object counts, local elapsed timing and projection parity.
- [x] Implement initial scenarios for faceting/aggregations, weighted full-text relevance and filtering.
- [x] Update generated/admin projection state so the standard reindex response exposes the projection ID consistently.
- [x] Add engine-native timing diagnostics (`responseHeader.QTime` for Solr and `took` for OpenSearch) separately from API elapsed time.
- [x] Add warm-up and repeated-run measurements before making any performance comparison; report distributions such as p50/p95/p99 rather than a single request.
- [ ] Add rank/result-set/facet-difference summaries that explain _why_ engines differ rather than only showing two columns.
- [ ] Add phrase search and highlighting after the current test matrix is green.
- [ ] Add geo, autocomplete/suggest, synonyms, nested/object and vector/hybrid scenarios only after the basic comparison path is fully hardened.

## P4 — Provenance and identity

- [ ] Add typed provenance values for live aggregation, stored sample, fixture, stale and unavailable data.
- [ ] Record publisher freshness per research object where a reliable source date exists.
- [ ] Record and expose discovery projection timestamps consistently across Admin Sync, Evidence and Search Lab.
- [ ] Add regression coverage for LODES fallback provenance.
- [ ] Review UUID/source-identifier route stability and relationship resolution.

## P5 — Research-object product language

- [ ] Add `/research/:id` as an alias for the existing detail route.
- [ ] Replace remaining dataset-shaped copy where the object may be a publication, methodology or project.
- [ ] Update examples and demo links to prefer research-object terminology.

## P6 — Publisher verification and federation

- [ ] Add listing/vintage verification to remaining programs where publisher structure permits it.
- [ ] Keep catalog edits reviewable rather than automatically applying uncertain file-name changes.
- [ ] Evaluate NOAA Climate Data Online as a federation candidate.
- [ ] Evaluate NASA POWER as a federation candidate.

## P7 — Local Kubernetes and million-record scale laboratory

Design documents:

- [Local Kubernetes Search Cluster](../documentation/cloud/local-kubernetes-search-cluster.md)
- [Million-Record Open Science Corpus](../documentation/cloud/million-record-corpus.md)

### Kubernetes search topology

- [ ] Add reproducible kind cluster configuration.
- [ ] Add `k8s:create`, `k8s:build`, `k8s:deploy`, `k8s:reindex`, `k8s:benchmark` and `k8s:destroy` repository scripts or equivalent documented commands.
- [ ] Keep Docker Compose as the default fast development path.
- [ ] Deploy SolrCloud with the official Solr Operator and at least three Solr pods.
- [ ] Deploy ZooKeeper required by the selected SolrCloud operator configuration.
- [ ] Deploy a three-node OpenSearch cluster through the official operator or Helm chart.
- [ ] Configure persistent storage and explicit pod CPU/memory/JVM limits for both engines.
- [ ] Prove the same normalized projection ID and expected count reach clustered Solr and OpenSearch.
- [ ] Run Search Lab against both clustered engines through Spring.
- [ ] Record topology metadata with every benchmark: nodes, shards, replicas, resources, heap, storage and concurrency.
- [ ] Compare standalone/clustered topology at the 181-record baseline without claiming distributed search must be faster.
- [ ] Add a benchmark mode with alternating/randomized/separate engine order before comparative speed conclusions.
- [ ] Automate or document a Solr pod-loss/recovery experiment.
- [ ] Automate or document an OpenSearch pod-loss/recovery experiment.
- [ ] Verify projection parity and persistent data after recovery/restart.

### Large-corpus harvesting

- [ ] Define a generic resumable scale-harvest interface with cursor/page checkpoints, bounded retry/backoff, rate-limit handling and progress metrics.
- [ ] Implement DOE OSTI as the first 1M+ metadata source.
- [ ] Add source-adapter tests and deterministic normalized fixtures for OSTI.
- [ ] Produce a 10K OSTI normalized snapshot with source/date/count/hash manifest.
- [ ] Produce a 100K OSTI normalized snapshot and validate projection parity.
- [ ] Produce the first 1M normalized OSTI snapshot without committing the corpus to Git.
- [ ] Keep full-text/binary downloads out of the first million-record experiment.
- [ ] Add a benchmark-only search-scale snapshot mode that is explicitly distinguished from DSpace-backed evidence.
- [ ] Evaluate DSpace-backed 10K and 100K ingestion before deciding whether 1M DSpace records is useful locally.
- [ ] Add Data.gov as a federal hundreds-of-thousands breadth corpus.
- [ ] Add NASA CMR as a controlled 1M+ geospatial/granule stress corpus after OSTI is stable.
- [ ] Add PubMed as a second 1M+ bibliographic corpus so benchmark behavior is not overfit to OSTI metadata.
- [ ] Keep OpenAlex optional until the federal-source scale path is established.

### Scale benchmark matrix

- [ ] Run 181/10K/100K/1M corpus checkpoints.
- [ ] At 1M, measure concurrency 1/8/32 where the workstation remains stable.
- [ ] Record indexing duration, accepted/rejected documents and errors.
- [ ] Record API elapsed, Solr QTime, OpenSearch took and throughput/error distributions.
- [ ] Add stable query classes for exact ID, rare phrase, common multi-term, publisher, type, year, high-cardinality facet, low-cardinality facet, empty and broad-result searches.
- [ ] Add result-set/rank/facet-difference evidence at scale so faster-but-wrong behavior cannot pass as a successful benchmark.
- [ ] Evaluate an optional 5M+ tier only after 1M is reproducible.

## P8 — Infrastructure as code

- [ ] Choose Terraform or CDK.
- [ ] Implement the documented AWS target or alternate.
- [ ] Reuse local Kubernetes/operator/Helm lessons where they transfer to EKS.
- [ ] Add secrets, observability, backup/restore and persistent search storage.
- [ ] Document deployment and rollback from the local Compose/kind baselines.

## P9 — Platform hardening

- [ ] Move NgRx dependencies from release candidates to stable versions after validation.
- [ ] Revisit generated Spring controller interfaces when Spring 7 support is ready.
- [ ] Add Testcontainers coverage for `JdbcSyncJobStore` and critical repository paths.
- [ ] Add typed API error responses where generic failures remain.
- [ ] Review Nx/dependency upgrade warnings.
- [ ] Re-run bounded mirroring with a larger budget when storage permits.
