# Active Backlog

This file contains **open work only**. Delivered history belongs in [documentation/history/platform-evolution.md](../documentation/history/platform-evolution.md), generated repository facts belong in [documentation/platform-status.md](../documentation/platform-status.md), and the exact C2 million-record milestone is recorded in [documentation/federation/scale-evidence.md](../documentation/federation/scale-evidence.md).

The repository follows an evidence-first rule: define or extend unit/use-case/contract/browser/accessibility and real-stack evidence before broadening a feature surface.

## PI-1 — Close reusable federation/search evidence

### Live scale validation

- [ ] Add a non-mutating named-profile checker, conceptually `quality:scale` / `scale:evidence:check`.
- [ ] For `FEDERATED_1M`, verify exact 500K Data.gov + 500K DOE OSTI composition, retained count, composition -> projection linkage, active projection identity/count, Solr/OpenSearch parity, storage evidence and public-search provenance.
- [ ] Verify restart-safe persisted activation as part of the live scale check.
- [ ] Keep 1M/FULL checks explicit/manual or scheduled rather than ordinary PR CI.

### Stable large-corpus query evidence

- [ ] Version a stable query set covering exact identifier, rare phrase, common multi-term, author, publisher, source, type, date/year, high/low-cardinality facets and empty/broad queries.
- [ ] Record API and engine-native p50/p95/p99 distributions tied to projection identity.
- [ ] Add result-set overlap and top-N overlap summaries.
- [ ] Add rank-movement summaries for shared results.
- [ ] Add facet-bucket difference summaries.
- [ ] Preserve execution-order metadata so first-run bias remains visible.
- [ ] Verify accessibility and keyboard behavior with large facet/result counts.

### Scale-sensitive runtime hardening

- [ ] Record reusable projection elapsed time, documents/second and accepted/rejected/skipped/indexed counts for large projections.
- [ ] Capture host/container/JVM CPU and memory context with heavy evidence runs.
- [ ] Add opaque cursor/search-after pagination for deep discovery while retaining offset compatibility during migration.
- [ ] Add configurable per-source request concurrency and explicit rate-limit policy.
- [ ] Define DOI/PMID/other durable-identifier reconciliation rules; never silently merge by title.
- [ ] Improve presentation of opaque publisher program values such as Data.gov codes without replacing raw metadata with a fixed UI allowlist.
- [ ] Clarify projection-level authority terminology where compatibility `REPOSITORY` is too coarse for mixed DSpace + federated search state.

### Federation portfolio

- [ ] Implement NASA Earthdata CMR collections with committed fixtures.
- [ ] Add controlled CMR granule handling with spatial/temporal metadata.
- [ ] Prove bounded 10K/100K CMR slices before considering a larger granule corpus.
- [ ] Implement PubMed fixture/bounded API ingestion with PMID/title/abstract/authors/journal/date/type/identifier mapping.
- [ ] Evaluate PubMed bulk/baseline/update files for large reproducible ingestion rather than millions of individual API calls.
- [ ] Implement OpenAlex bounded ingestion for works/authors/institutions/topics/funders/DOI/citation relationships after the federal-source path remains stable.
- [ ] Render Data.gov + DOE OSTI + at least one additional source together in normal Discovery with unchanged provenance rules.

### Provenance and research-object language

- [ ] Record publisher freshness per research object where a reliable source date exists.
- [ ] Expose projection/index timestamps consistently across Admin, Evidence, Discovery and Search Lab.
- [ ] Extend typed provenance to stored sample, stale and unavailable states where those states apply.
- [ ] Add regression coverage for LODES fallback provenance.
- [ ] Review UUID/source-identifier route stability and relationship resolution.
- [ ] Replace remaining dataset-shaped copy where an object may be a publication, report, software item, methodology, project or scientific granule.
- [ ] Update examples/demo links to prefer research-object terminology where appropriate.

### PI-1 handoff

- [ ] Every planned source adapter has a reproducible bounded harvest path and fixture coverage.
- [ ] Stable corpus/query definitions are versioned for PI-2.
- [ ] Live scale validation is repeatable from one command rather than a manual curl sequence.
- [ ] Semantic Solr/OpenSearch difference evidence is versioned alongside latency evidence.

## PI-2 — Local Kubernetes Search Laboratory

- [ ] Preserve Docker Compose as the default fast development/demo path and standalone control topology.
- [ ] Add reproducible kind cluster lifecycle commands.
- [ ] Deploy SolrCloud with the official Solr Operator and ZooKeeper.
- [ ] Deploy multi-node OpenSearch with aligned mappings/analyzers.
- [ ] Compare identical PI-1 10K/100K/1M corpora and stable query definitions at concurrency 1/8/32.
- [ ] Record topology, shard/replica layout, resources, heap and storage with every benchmark.
- [ ] Reproduce node-loss/recovery for each engine and verify persistence/projection parity.

## PI-3 — Infrastructure as Code / AWS

- [ ] Choose Terraform or CDK after PI-2 provides topology/resource evidence.
- [ ] Implement the documented AWS target or justified alternative.
- [ ] Add secrets/identity, observability, backup/restore and persistent search storage.
- [ ] Document deployment and rollback from the Compose/kind baselines.
- [ ] Decide whether both search engines are justified outside the comparison laboratory.

## PI-4 — Manual Accessibility Evidence

- [ ] Run the full application keyboard-only and record dated evidence.
- [ ] Run NVDA in Firefox and Chrome.
- [ ] Run JAWS, or record N/A with the licensing reason.
- [ ] Complete the trusted map-click/map-to-list focus-path review.
- [ ] Complete cognitive/workflow review.
- [ ] Run Search Lab comparison end to end with keyboard-only input.
- [ ] Review the MapLibre canvas tab stop with a screen reader and document the decision.
- [ ] Decide whether to add a `contentinfo` landmark.

## PI-5 — Browser Evidence Governance

- [ ] Decide which WCAG/Section 508-oriented jobs are required merge checks.
- [ ] Decide whether `main` receives branch protection.
- [ ] Preserve the prior known-good accessibility evidence baseline when a refresh fails.

## PI-6 — Solr/OpenSearch Comparison Hardening

Only after the stable-query semantic matrix is green:

- [ ] Add phrase-search and highlighting scenarios.
- [ ] Evaluate geo comparison scenarios.
- [ ] Evaluate autocomplete/suggest and synonyms.
- [ ] Evaluate nested/object fields.
- [ ] Evaluate vector/hybrid scenarios without weakening the reproducible lexical baseline.

## Cross-cutting platform hardening

- [ ] Move NgRx dependencies from release candidates to stable versions after validation.
- [ ] Continue typed API error and contract/integration-test hardening.
- [ ] Keep catalog edits reviewable rather than automatically applying uncertain publisher changes.
- [ ] Keep NOAA Climate Data Online and NASA POWER as optional later sources after the PI-1 source portfolio is stable.
