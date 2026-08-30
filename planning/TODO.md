# Active Backlog

This file contains open work only, with completed checkboxes retained where they clarify the active PI boundary. Current status is generated in [documentation/platform-status.md](../documentation/platform-status.md); delivered history is in [documentation/history/platform-evolution.md](../documentation/history/platform-evolution.md). Program increments and their execution order are defined in [PI_PLAN.md](PI_PLAN.md).

The repository follows a **testing-first rule** for new work: define or extend unit, use-case, contract, browser, accessibility and real-stack evidence before expanding the feature surface. A feature is not considered complete merely because it works in the local UI.

The intended execution order is **PI-1 -> PI-2 -> PI-3 -> PI-4 -> PI-5 -> PI-6**. PI-1 is active now. The merged federation foundation is on `main`; the active scale branch is `codex/data-gov-10k-scale`.

## PI-1 — Federated Metadata Expansion

Design and evidence documents:

- [Federated Metadata Expansion](../documentation/federation/README.md)
- [Federated Metadata Architecture](../documentation/federation/federated-metadata-architecture.md)
- [Source Ingestion Plan](../documentation/federation/source-ingestion-plan.md)
- [Runtime and Ownership Boundaries](../documentation/federation/runtime-boundaries.md)
- [Million-Record Federated Metadata Corpus](../documentation/federation/million-record-corpus.md)
- [Data.gov Scale Evidence](PI1_DATA_GOV_SCALE_EVIDENCE.md)
- [Corpus Scale Admin and Evidence Plan](CORPUS_SCALE_ADMIN_PLAN.md)
- [Closed PI-1 F1 Merge Gate](PI1_F1_MERGE_GATE.md)

### PI-1.1 Foundation before source breadth

- [x] Finish public OpenAPI migration for data-driven program taxonomy while preserving the existing curated `ResearchProgram` compatibility field.
- [x] Add controlled `origin` / `sourceSystem` provenance to repository and fixture search/detail contracts and search projections.
- [x] Add canonical data-driven `programName` to the engine-neutral `DiscoveryDocument` so federated publisher programs do not expand/collapse into the legacy enum.
- [x] Replace fixed source-specific `ResearchProgram` assumptions in public filtering/results with data-driven program values.
- [x] Design and implement federated metadata persistence in the application data layer.
- [x] Add `harvest_runs`, resumable checkpoints, bounded error/quarantine state and source progress metrics.
- [x] Define namespaced source identity: `SOURCE_SYSTEM:source-id`.
- [ ] Define explicit DOI/PMID/other-identifier reconciliation rules without title-based silent merging.
- [x] Introduce a bounded combined discovery catalog over DSpace-backed and federated records.
- [x] Wire the combined discovery catalog into the projection lifecycle.
- [x] Replace whole-corpus `List<DiscoveryDocument>` projection with bounded streaming/batched projection before 100K+ runs.
- [x] Make deterministic projection hashing independent of database page size and search bulk size.
- [x] Add batch indexing to Solr and OpenSearch; do not create one giant million-document update body.
- [x] Use bounded JDBC prepared-statement batches for federated metadata persistence rather than one database interaction per record.
- [ ] Record accepted/rejected/skipped/indexed counts and progress for large projections; harvest counters exist, but projection progress/throughput evidence still needs scale hardening.
- [ ] Design opaque cursor pagination so million-record discovery does not depend on deep offsets.
- [ ] Keep the current offset contract working until the cursor path is tested and ready.

### PI-1.2 Shared harvester framework

- [x] Keep production-shaped federated harvesting in the Spring Boot Java runtime; do not introduce a NestJS/Node harvester service.
- [x] Define `FederatedSourceHarvester` / shared harvesting interfaces.
- [x] Add cursor/page checkpoint persistence.
- [x] Add bounded retry, exponential backoff/jitter and bounded `Retry-After` awareness with typed permanent/transient failures.
- [ ] Add configurable per-source request concurrency and explicit rate-limit policy.
- [x] Add run cancellation/restart/resume behavior.
- [x] Add malformed-record quarantine without aborting an entire run.
- [x] Record source update window/date, adapter version and run statistics in bounded snapshot/run evidence.
- [x] Generate deterministic corpus manifests from completed bounded runs and deterministic bounded-snapshot manifests for intentionally paused scale checkpoints.
- [x] Add guarded snapshot -> projection evidence with drift rejection and durable relationship history.
- [x] Add tiny committed source fixtures for normal CI rather than network-dependent tests.
- [ ] Add reusable progress/throughput and host/container/JVM context for 100K/1M-class evidence.

### PI-1.3 Data.gov adapter

- [x] Implement Data.gov source adapter.
- [x] Map dataset ID, title, description, agency/publisher, tags/themes, dates, distributions/resource links and landing page.
- [x] Add sparse/malformed/multiple-distribution fixture tests.
- [x] Prove the 1K live checkpoint end to end: 1,000 accepted / 0 rejected / 0 skipped, deterministic bounded snapshot, guarded projection linkage, 1,181-object mixed projection and public-search verification.
- [x] Prove the 10K harvest/resume path: same durable run resumed from 10 to 100 pages, 10,000 accepted / 0 rejected / 0 skipped, no failure.
- [ ] Complete the 10K scale evidence: snapshot/projection/search/detail/parity/storage are proven; remaining work is comparable PostgreSQL growth if historical evidence permits, host/container/JVM context, and reusable duration evidence.
- [ ] Prove the 100K resumable harvest and standalone evidence checkpoint only after 10K instrumentation closes.
- [x] Verify live Data.gov records appear automatically through discovery results and source/publisher/program facets without a UI rebuild.
- [x] Verify a live Data.gov record through `/research/:id` at the 10K checkpoint with federated provenance, authoritative source URL and no invented local files.
- [x] Prove explicit 10K standalone Solr/OpenSearch projection parity: `sameProjection: true`, both engines reachable, both at 10,181 documents on projection `b292f98bb8b141dd477cfbcdc9149e44bd53559c153c431f772809f41836742e`.
- [ ] Add a presentation strategy for opaque Data.gov program values such as `010:10`/`010:12` while preserving raw publisher metadata and avoiding fixed UI allowlists.
- [ ] Evaluate larger/full-catalog harvest only after the 100K path is stable.

### PI-1.4 DOE OSTI adapter and first million

- [ ] Implement OSTI adapter and normalization fixtures.
- [ ] Map title/abstract/authors/research organization/sponsor/subjects/resource type/date/DOI/source links.
- [ ] Prove 10K resumable harvest.
- [ ] Prove 100K resumable harvest and standalone projection parity.
- [ ] Produce the first deterministic 1M normalized corpus manifest.
- [ ] Index the 1M corpus into standalone Solr and OpenSearch with matching count/projection identity.
- [ ] Record indexing duration, accepted/rejected counts, disk growth and memory use.

### PI-1.5 NASA CMR adapter

- [ ] Implement CMR collection and granule metadata handling as distinct concepts.
- [ ] Add collection fixtures/tests.
- [ ] Add granule fixtures/tests including spatial/temporal metadata.
- [ ] Prove 10K and 100K controlled granule slices.
- [ ] Prove a 1M controlled granule slice only after the OSTI 1M path is stable.

### PI-1.6 PubMed adapter

- [ ] Implement PubMed adapter with PMID/title/abstract/authors/journal/date/type/identifier mapping.
- [ ] Use API access for fixtures/bounded development samples.
- [ ] Evaluate publisher bulk/baseline/update files for large reproducible ingestion instead of millions of individual API calls.
- [ ] Prove 10K and 100K bounded corpora.
- [ ] Prove a 1M bibliographic corpus after OSTI establishes the first million-record infrastructure.

### PI-1.7 OpenAlex adapter

- [ ] Implement OpenAlex adapter for works/authors/institutions/topics/funders/DOI/citation relationships.
- [ ] Keep it last in PI-1 execution priority so the federal-source story remains primary.
- [ ] Prove 10K and 100K controlled snapshots.
- [ ] Evaluate an optional 1M+ slice without attempting to retain the whole source corpus locally.

### PI-1.8 UI/search-scale completion

- [x] Add source-system facet to normal discovery.
- [x] Ensure publisher/program facet values are returned from index data rather than a fixed UI allowlist.
- [x] Clearly label `REPOSITORY` versus `FEDERATED` detail/provenance at the record level.
- [x] Keep authoritative source/resource links visible without claiming local file preservation.
- [ ] Consider renaming/expanding projection-level `resultSource` / `projectionSource` compatibility semantics so a mixed authority-backed projection is not misleadingly summarized only as `REPOSITORY`; per-record provenance remains correct today.
- [ ] Add stable large-corpus query set: identifier, rare phrase, common multi-term, author, publisher, source, type, date/year, high/low-cardinality facets, empty and broad queries.
- [ ] Add result-set/top-N/rank/facet-difference evidence at scale.
- [ ] Verify accessibility and keyboard behavior with large facet/result counts.

### PI-1.9 Corpus profiles, Admin activation and local-resource discipline

- [x] Keep large binaries/full text external by default.
- [x] Keep DSpace-owned PostgreSQL/Solr isolated from application-owned PostgreSQL/public Solr; use profiles and lifecycle rather than collapsing ownership boundaries.
- [x] Preserve named scale profiles for the curated demo, 10K, 100K, 1M and FULL/source-defined bound.
- [ ] Replace hard-coded `CURATED_DEMO` active-profile reporting with runtime-derived active profile/evidence state.
- [ ] Persist profile activation state separately from retained federated metadata and active projection state.
- [ ] Add guarded Admin `Activate profile` / `Resume activation` orchestration for named profiles; preview current/target state and warn clearly for 100K/1M/FULL heavy operations.
- [ ] Require snapshot capture, guarded projection and Solr/OpenSearch parity before marking a federated profile active.
- [ ] Preserve the prior known-good projection/evidence if a profile activation fails.
- [ ] Show per-profile historical storage metrics in Admin: PostgreSQL, DSpace, Solr, OpenSearch, known total, retained count and projection count.
- [ ] Show per-profile harvest/projection metrics in Admin: elapsed time, records/documents per second, accepted/rejected/skipped and projection identity.
- [ ] Show stable-query performance metrics in Admin/Evidence: API elapsed, Solr `QTime`, OpenSearch `took`, p50/p95/p99 and error counts tied to projection identity.
- [ ] Capture host/container/JVM CPU and memory context for meaningful 10K/100K/1M runs and display the evidence context where useful.
- [ ] Measure bytes/document in federated PostgreSQL, Solr and OpenSearch at 10K and 100K. The 10K incremental Solr/OpenSearch cost is measured at approximately 482.5 / 485.1 bytes per newly projected object; comparable PostgreSQL growth and all 100K measurements remain.
- [ ] Estimate 1M disk requirements with 30-50% operational headroom before creating the corpus.
- [x] Keep 1M corpora out of Git and ordinary PR CI.
- [ ] Make heavy snapshots regenerable so old corpora can be removed when disk pressure requires it.
- [x] Preserve the original small curated Compose demo profile.

### PI-1.10 Quality and scale evidence gates

- [x] Keep `quality:all` deterministic and appropriate for ordinary development/PRs.
- [x] Make `quality:all` build all buildable application/runtime targets rather than only the Angular UI.
- [ ] Add a separate live named-profile checker, conceptually `quality:scale` / `scale:evidence:check`.
- [ ] Make the scale checker validate expected retained count, deterministic snapshot, guarded snapshot/projection linkage, active projection identity/count, Solr/OpenSearch parity and normal public-search provenance.
- [ ] Make the scale checker require storage/resource/duration evidence when a checkpoint is being declared complete.
- [ ] Keep 1M/FULL scale checks explicit/manual or scheduled rather than ordinary PR checks.

### PI-1.11 PI-1 handoff

- [ ] All five source adapters implemented and fixture-tested.
- [ ] Every source supports a reproducible bounded harvest.
- [ ] Data.gov + OSTI + at least one additional source render together in the normal UI.
- [ ] Standalone Solr/OpenSearch parity proven for a deterministic 1M-class corpus.
- [ ] Versioned corpus manifest/query definitions are ready for PI-2 without changing record semantics.

## PI-1 supporting work — Provenance and identity

- [ ] Extend typed origin/provenance beyond repository/federated/fixture to stored sample, stale and unavailable data where those states apply.
- [x] Add controlled `sourceSystem` values for Census, USGS, Data.gov, OSTI, NASA CMR, PubMed and OpenAlex.
- [ ] Record publisher freshness per research object where a reliable source date exists.
- [ ] Record and expose discovery projection timestamps consistently across Admin Sync, Evidence and Search Lab.
- [ ] Add regression coverage for LODES fallback provenance.
- [ ] Review UUID/source-identifier route stability and relationship resolution.
- [ ] Define cross-source identity/equivalence rules based on durable identifiers; never silently merge by title.

## PI-1 supporting work — Research-object product language

- [x] Add `/research/:id` as the canonical detail route while preserving `/datasets/:id` compatibility.
- [x] Resolve detail from either DSpace or the federated metadata catalog.
- [ ] Replace remaining dataset-shaped copy where the object may be a publication, report, software item, methodology, project or scientific granule.
- [ ] Update examples and demo links to prefer research-object terminology where appropriate.
- [x] Add unit/browser/accessibility coverage for federated detail states and outbound authoritative-source links.

## PI-2 — Local Kubernetes Search Laboratory

- [ ] Preserve Docker Compose as the default fast development/demo path and standalone control topology.
- [ ] Add reproducible kind cluster configuration and repository-owned lifecycle commands.
- [ ] Deploy SolrCloud with the official Solr Operator and ZooKeeper.
- [ ] Deploy multi-node OpenSearch with aligned mappings/analyzers.
- [ ] Compare exact PI-1 10K/100K/1M corpora and concurrency 1/8/32.
- [ ] Record topology/resources/heap/storage and semantic parity with every benchmark.
- [ ] Reproduce node-loss/recovery for each engine and verify persistence/projection parity.

## PI-3 — Infrastructure as Code / AWS

- [ ] Choose Terraform or CDK after PI-2 provides topology/resource evidence.
- [ ] Implement the documented AWS target or alternate.
- [ ] Reuse local Kubernetes/operator/Helm lessons where they transfer to EKS.
- [ ] Add secrets, observability, backup/restore and persistent search storage.
- [ ] Document deployment and rollback from the local Compose/kind baselines.

## PI-4 — Manual Accessibility Evidence

- [ ] Run Checklist 1 end to end without a mouse and record the result.
- [ ] Run Checklist 2 with NVDA in Firefox and Chrome.
- [ ] Run Checklist 3 with JAWS, or record N/A with the licensing reason.
- [ ] Complete Checklist 4, starting with the trusted map-click/map-to-list focus path.
- [ ] Complete Checklist 5 cognitive/workflow review.
- [ ] Decide whether to add a `contentinfo` landmark.
- [ ] Review the MapLibre canvas tab stop with a screen reader and document the decision.
- [ ] Run the Search Lab comparison flow with keyboard-only input and record the result.

## PI-5 — Browser Evidence CI and Governance

- [x] Add a dedicated or scheduled full Playwright evidence workflow.
- [x] Upload Playwright HTML reports, traces and screenshots when the evidence workflow fails.
- [x] Run the Search Lab comparison scenarios and WCAG/Section 508 axe route in the dedicated workflow.
- [x] Add a real-stack browser -> Spring API -> Solr + OpenSearch smoke path.
- [ ] Decide whether WCAG/Section 508-oriented jobs are required merge checks.
- [ ] Decide whether `main` receives branch protection.
- [x] Ensure CI uses the same `evidence:check` and generated-document drift rules as local quality gates.

## PI-6 — Solr/OpenSearch Comparison Hardening

- [ ] Add rank/result-set/facet-difference summaries that explain _why_ engines differ rather than only showing two columns.
- [ ] Add phrase search and highlighting after the core test matrix is green.
- [ ] Add geo, autocomplete/suggest, synonyms, nested/object and vector/hybrid scenarios only after the basic comparison path is fully hardened.

## Cross-cutting — Publisher verification

- [ ] Add listing/vintage verification to remaining curated programs where publisher structure permits it.
- [ ] Keep catalog edits reviewable rather than automatically applying uncertain file-name changes.
- [ ] Keep NOAA Climate Data Online and NASA POWER as possible later adapters after the PI-1 source portfolio is stable.

## Cross-cutting — Platform hardening

- [ ] Move NgRx dependencies from release candidates to stable versions after validation.
- [x] Keep NgRx/RxJS for shared workflow state while allowing transient component state to remain local; do not migrate to Signals solely to reduce boilerplate.
- [ ] Revisit generated Spring controller interfaces when Spring 7 support is ready.
- [ ] Add Testcontainers coverage for `JdbcSyncJobStore` and critical repository paths.
- [ ] Add typed API error responses where generic failures remain.
- [ ] Review Nx/dependency upgrade warnings.
- [ ] Re-run bounded mirroring with a larger budget when storage permits.
