# Active Backlog

This file contains **open work only**. Delivered history belongs in [documentation/history/platform-evolution.md](../documentation/history/platform-evolution.md), generated repository facts belong in [documentation/platform-status.md](../documentation/platform-status.md), and the exact C2 million-record milestone is recorded in [documentation/federation/scale-evidence.md](../documentation/federation/scale-evidence.md).

The repository follows an evidence-first rule: define or extend unit/use-case/contract/browser/accessibility and real-stack evidence before broadening a feature surface.

## Active workstreams

- `codex/deep-pagination-runtime-hardening` — opaque cursor/search-after discovery, large-result keyboard behavior and WCAG 2.2 engineering uplift. See [documentation/workstreams/deep-pagination-runtime-hardening](../documentation/workstreams/deep-pagination-runtime-hardening/README.md).
- `codex/map-layer-categories` — group the growing Maps layer controls into expandable, accessible categories while every child layer remains independently renderable.
- `codex/research-spatial-coverage` — define authoritative spatial coverage for research objects without inferring research geography from publisher location.
- `codex/searchable-research-map-coverage` — connect filtered Discovery results to bounded map summaries/features and accessible result equivalents.

## PI-1 — Close reusable federation/search evidence

### Large-corpus search evidence follow-through

PRs #12-#14 delivered the named 1M scale checker, versioned semantic matrix, API/native p50/p95/p99 evidence, result/top-N overlap, rank movement, facet-bucket differences, execution-order evidence, exact local-ID/DOI probes and structured publisher/source-system filters.

Open follow-through:

- [ ] Verify accessibility and keyboard behavior with large facet/result counts.
- [ ] Keep the V2 semantic matrix stable while topology/runtime variables change.
- [ ] Add richer phrase/highlighting/geo/vector scenarios only after PI-1 handoff criteria are satisfied.

### Scale-sensitive runtime hardening

- [ ] Add opaque cursor/search-after pagination for deep discovery while retaining offset compatibility during migration.
- [ ] Bind cursors to query/filter/sort/projection identity and reject stale/tampered cursors safely.
- [ ] Record reusable projection elapsed time, documents/second and accepted/rejected/skipped/indexed counts for large projections.
- [ ] Capture host/container/JVM CPU and memory context with heavy evidence runs.
- [ ] Add configurable per-source request concurrency and explicit rate-limit policy.
- [ ] Define DOI/PMID/other durable-identifier reconciliation rules; never silently merge by title.
- [ ] Improve presentation of opaque publisher program values such as Data.gov codes without replacing raw metadata with a fixed UI allowlist.
- [ ] Clarify projection-level authority terminology where compatibility `REPOSITORY` is too coarse for mixed DSpace + federated search state.

### Maps and spatial research coverage

- [ ] Group current Maps controls into expandable categories without changing the independent layer/rendering contract.
- [ ] Add an engine-neutral research spatial-coverage model supporting authoritative admin areas, points, bounding boxes and later polygons.
- [ ] Preserve spatial provenance/derivation method and never infer research coverage from publisher/institution location.
- [ ] Add bounded spatial summary/feature APIs so million-record search results never become million browser features.
- [ ] Connect Discovery query/filter context to research coverage on Maps.
- [ ] Provide semantic list/table equivalents for every meaningful research-coverage map value.
- [ ] Keep category/layer controls keyboard operable and test WCAG 2.2 focus-not-obscured, target-size and non-drag alternatives.

### Federation portfolio

- [ ] Reconcile the NASA CMR planning wording with the existing collection harvester and tests; treat collection support as an existing foundation rather than a greenfield adapter.
- [ ] Add committed canonical NASA CMR collection fixtures/evidence where coverage is still missing.
- [ ] Add controlled CMR granule handling with spatial/temporal metadata as a distinct research-object semantic.
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

- [ ] Deep discovery no longer depends on unbounded offsets.
- [ ] Large-projection resource/progress evidence is captured consistently.
- [ ] Every planned source adapter has a reproducible bounded harvest path and fixture coverage.
- [ ] Stable corpus/query definitions are versioned for PI-2.
- [ ] Semantic Solr/OpenSearch difference evidence remains versioned alongside latency evidence.

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

The legal Section 508 baseline and the engineering target remain distinct. The engineering target is now WCAG 2.2 A/AA; manual evidence still determines usability beyond automated rules.

- [ ] Run the full application keyboard-only and record dated evidence.
- [ ] Run NVDA in Firefox and Chrome.
- [ ] Run JAWS, or record N/A with the licensing reason.
- [ ] Complete the trusted map-click/map-to-list focus-path review.
- [ ] Complete cognitive/workflow review.
- [ ] Run Search Lab comparison end to end with keyboard-only input.
- [ ] Review the MapLibre canvas tab stop with a screen reader and document the decision.
- [ ] Crosswalk the manual checklist against the current federal ICT Testing Baseline / Trusted Tester structure.
- [ ] Add explicit WCAG 2.2 manual checks for focus not obscured, dragging alternatives and minimum target size.
- [ ] Decide whether to add a `contentinfo` landmark.

## PI-5 — Browser Evidence Governance

- [ ] Decide which WCAG/Section 508-oriented jobs are required merge checks.
- [ ] Decide whether `main` receives branch protection.
- [ ] Preserve the prior known-good accessibility evidence baseline when a refresh fails.

## PI-6 — Solr/OpenSearch Comparison Hardening

Only after PI-1 handoff:

- [ ] Add phrase-search and highlighting scenarios.
- [ ] Evaluate geo comparison scenarios using the authoritative spatial-coverage model.
- [ ] Evaluate autocomplete/suggest and synonyms.
- [ ] Evaluate nested/object fields.
- [ ] Evaluate vector/hybrid scenarios without weakening the reproducible lexical baseline.

## Cross-cutting platform hardening

- [ ] Move NgRx dependencies from release candidates to stable versions after validation.
- [ ] Continue typed API error and contract/integration-test hardening.
- [ ] Keep catalog edits reviewable rather than automatically applying uncertain publisher changes.
- [ ] Keep NOAA Climate Data Online and NASA POWER as optional later sources after the PI-1 source portfolio is stable.
