# Active Backlog

This file contains open work only. Current status is generated in [documentation/platform-status.md](../documentation/platform-status.md); delivered history is in [documentation/history/platform-evolution.md](../documentation/history/platform-evolution.md). Program increments and their execution order are defined in [PI_PLAN.md](PI_PLAN.md).

The repository follows a **testing-first rule** for new work: define or extend unit, use-case, contract, browser, accessibility and real-stack evidence before expanding the feature surface. A feature is not considered complete merely because it works in the local UI.

The intended execution order is **PI-1 -> PI-2 -> PI-3 -> PI-4 -> PI-5 -> PI-6**. PI-1 is active now.

## PI-1 — Federated Metadata Expansion

Design documents:

- [Federated Metadata Expansion](../documentation/federation/README.md)
- [Federated Metadata Architecture](../documentation/federation/federated-metadata-architecture.md)
- [Source Ingestion Plan](../documentation/federation/source-ingestion-plan.md)
- [Million-Record Federated Metadata Corpus](../documentation/federation/million-record-corpus.md)

### PI-1.1 Foundation before source breadth

- [ ] Define OpenAPI/domain contract for `origin` and `sourceSystem`.
- [ ] Replace fixed source-specific `ResearchProgram` assumptions with controlled source/content type plus data-driven publisher/program/subject facets.
- [x] Design and implement federated metadata persistence in the application data layer.
- [ ] Add `harvest_runs`, resumable checkpoints, bounded error/quarantine state and source progress metrics.
- [x] Define namespaced source identity: `SOURCE_SYSTEM:source-id`.
- [ ] Define explicit DOI/PMID/other-identifier reconciliation rules without title-based silent merging.
- [ ] Introduce a combined discovery catalog over DSpace-backed and federated records.
- [ ] Replace whole-corpus `List<DiscoveryDocument>` projection with bounded streaming/batched projection before 100K+ runs.
- [ ] Make deterministic projection hashing independent of database page size and search bulk size.
- [ ] Add batch indexing to Solr and OpenSearch; do not create one giant million-document update body.
- [x] Use bounded JDBC prepared-statement batches for federated metadata persistence rather than one database interaction per record.
- [ ] Record accepted/rejected/skipped/indexed counts and progress for large projections.
- [ ] Design opaque cursor pagination so million-record discovery does not depend on deep offsets.
- [ ] Keep the current offset contract working until the cursor path is tested and ready.

### PI-1.2 Shared harvester framework

- [x] Define `FederatedSourceHarvester` / shared harvesting interfaces.
- [x] Add cursor/page checkpoint persistence.
- [ ] Add bounded retry, backoff/jitter and `Retry-After` awareness.
- [ ] Add configurable per-source request concurrency and rate limits.
- [ ] Add run cancellation/restart/resume behavior.
- [ ] Add malformed-record quarantine without aborting an entire run.
- [ ] Record source retrieval window/date, adapter version and run statistics.
- [ ] Generate deterministic corpus manifests from completed bounded runs.
- [ ] Add tiny committed source fixtures for normal CI rather than network-dependent tests.

### PI-1.3 Data.gov adapter

- [ ] Implement Data.gov source adapter.
- [ ] Map dataset ID, title, description, agency/publisher, tags/themes, dates, distributions/resource links and landing page.
- [ ] Add sparse/malformed/multiple-distribution fixture tests.
- [ ] Prove 1K, then 10K, then 100K resumable harvests.
- [ ] Verify new records appear automatically through discovery results, source/publisher/program facets and `/research/:id`.
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

- [ ] Add source-system facet to normal discovery.
- [ ] Ensure publisher/program facet values are returned from index data rather than a fixed UI allowlist.
- [ ] Clearly label `REPOSITORY` versus `FEDERATED` detail/provenance.
- [ ] Keep authoritative source/resource links visible without claiming local file preservation.
- [ ] Add stable large-corpus query set: identifier, rare phrase, common multi-term, author, publisher, source, type, date/year, high/low-cardinality facets, empty and broad queries.
- [ ] Add result-set/top-N/rank/facet-difference evidence at scale.
- [ ] Verify accessibility and keyboard behavior with large facet/result counts.

### PI-1.9 Corpus and disk discipline

- [x] Keep large binaries/full text external by default.
- [ ] Measure bytes/document in federated PostgreSQL, Solr and OpenSearch at 10K and 100K.
- [ ] Estimate 1M disk requirements with 30-50% operational headroom before creating the corpus.
- [x] Keep 1M corpora out of Git and ordinary PR CI.
- [ ] Make heavy snapshots regenerable so old corpora can be removed when disk pressure requires it.
- [x] Preserve the original small curated Compose demo profile.

### PI-1.10 PI-1 handoff

- [ ] All five source adapters implemented and fixture-tested.
- [ ] Every source supports a reproducible bounded harvest.
- [ ] Data.gov + OSTI + at least one additional source render together in the normal UI.
- [ ] Standalone Solr/OpenSearch parity proven for a deterministic 1M-class corpus.
- [ ] Versioned corpus manifest/query definitions are ready for PI-2 without changing record semantics.

## PI-1 supporting work — Provenance and identity

- [ ] Add typed origin/provenance values for repository, federated, fixture, stored sample, stale and unavailable data.
- [ ] Add controlled `sourceSystem` values for Census, USGS, Data.gov, OSTI, NASA CMR, PubMed and OpenAlex.
- [ ] Record publisher freshness per research object where a reliable source date exists.
- [ ] Record and expose discovery projection timestamps consistently across Admin Sync, Evidence and Search Lab.
- [ ] Add regression coverage for LODES fallback provenance.
- [ ] Review UUID/source-identifier route stability and relationship resolution.
- [ ] Define cross-source identity/equivalence rules based on durable identifiers; never silently merge by title.

## PI-1 supporting work — Research-object product language

- [ ] Add `/research/:id` as the canonical detail route while preserving `/datasets/:id` compatibility.
- [ ] Resolve detail from either DSpace or the federated metadata catalog.
- [ ] Replace remaining dataset-shaped copy where the object may be a publication, report, software item, methodology, project or scientific granule.
- [ ] Update examples and demo links to prefer research-object terminology.
- [ ] Add unit/browser/accessibility coverage for federated detail states and outbound authoritative-source links.

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
- [ ] Revisit generated Spring controller interfaces when Spring 7 support is ready.
- [ ] Add Testcontainers coverage for `JdbcSyncJobStore` and critical repository paths.
- [ ] Add typed API error responses where generic failures remain.
- [ ] Review Nx/dependency upgrade warnings.
- [ ] Re-run bounded mirroring with a larger budget when storage permits.
