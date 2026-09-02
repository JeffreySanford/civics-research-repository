# Active Backlog

This file contains **open work only**. Delivered history belongs in [documentation/history/platform-evolution.md](../documentation/history/platform-evolution.md), generated repository facts belong in [documentation/platform-status.md](../documentation/platform-status.md), and the exact C2 million-record milestone is recorded in [documentation/federation/scale-evidence.md](../documentation/federation/scale-evidence.md).

The repository follows an evidence-first rule: define or extend unit/use-case/contract/browser/accessibility and real-stack evidence before broadening a feature surface.

## Active workstreams

The merged cursor, map-category, authoritative-county-geometry, capability-aware SAIPE and first Research Coverage slices are no longer active backlog items. Current PI-1 work is concentrated in:

- **projection/resource evidence** — reusable elapsed-time, throughput and host/container/JVM resource evidence tied to corpus/projection identity;
- **durable identity reconciliation** — DOI/PMID/other identifier rules and explicit source-record/work/version relationships;
- **research spatial enrichment** — measure the retained Data.gov corpus, then add explicit authoritative spatial sidecar data without mutating the C2 Gold Master;
- **federation portfolio** — build on NASA CMR, then add PubMed/OpenAlex only after the identity and bounded-harvest contracts are ready.

## PI-1 — Close reusable federation/search evidence

### Large-corpus search evidence follow-through

PRs #12-#14 delivered the named 1M scale checker, versioned semantic matrix, API/native p50/p95/p99 evidence, result/top-N overlap, rank movement, facet-bucket differences, execution-order evidence, exact local-ID/DOI probes and structured publisher/source-system filters. PRs #16 and #19 then made cursor traversal the deep-discovery path and certified deterministic C2 traversal without gaps or duplicates.

Open follow-through:

- [ ] Verify accessibility and keyboard behavior with large facet/result counts where manual evidence is still required.
- [ ] Keep the V2 semantic matrix stable while topology/runtime variables change.
- [ ] Add richer phrase/highlighting/geo/vector scenarios only after PI-1 handoff criteria are satisfied.

### Scale-sensitive runtime hardening

- [ ] Record reusable projection elapsed time, documents/second and accepted/rejected/skipped/indexed counts for large projections.
- [ ] Capture host/container/JVM CPU and memory context with heavy evidence runs.
- [ ] Add configurable per-source request concurrency and explicit rate-limit policy.
- [ ] Define DOI/PMID/other durable-identifier reconciliation rules; never silently merge by title.
- [ ] Improve presentation of opaque publisher program values such as Data.gov codes without replacing raw metadata with a fixed UI allowlist.
- [ ] Clarify projection-level authority terminology where compatibility `REPOSITORY` is too coarse for mixed DSpace + federated search state.

### Maps and spatial research coverage

The delivered control taxonomy is:

```text
Geography & Boundaries
Community & Economy
Environment & Hazards
Research Coverage
```

Categories own presentation only; child layers remain independently checkable/renderable. The current foundation includes capability-aware controls, authoritative county geometry, SAIPE joined by GEOID, and **Repository research by area** driven by bounded Discovery criteria.

Open follow-through:

- [ ] Extend the shared administrative-geometry foundation beyond the current county implementation to the state/territory and later PUMA/tract joins that need authoritative stable identifiers.
- [ ] Generalize the thematic-area value contract so additional measures join values to shared geometry instead of embedding polygons in each service.
- [ ] Add **Population Estimates** county population/change as the first new Community & Economy measure.
- [ ] Add **County Business Patterns** with a single checkable layer and measure/industry configuration for employment, establishments and payroll rather than separate permanent checkboxes.
- [ ] Add **Business Dynamics Statistics** county/state measures such as job creation/destruction and establishment births/deaths after the common county layer contract is proven.
- [ ] Add **Building Permits** county totals, with place-level symbols only after place geometry/coordinates have an authoritative shared representation.
- [ ] Evaluate **Economic Census** county/industry measures after CBP/BDS prove the economic-layer configuration model.
- [ ] Treat **ACS PUMS** only as weighted aggregate state/PUMA measures; never render raw person/household points.
- [ ] Evaluate one configurable **USGS 3DEP terrain** layer (hillshade/tinted hillshade/slope mode) rather than multiple permanent terrain checkboxes.
- [ ] Run the deterministic **Data.gov spatial-availability probe** against the certified 500K retained Data.gov corpus and capture the measured evidence artifact.
- [ ] Use the measured probe result to scope a versioned, engine-neutral research spatial sidecar supporting authoritative admin areas, points, bounding boxes and later polygons.
- [ ] Preserve spatial provenance/derivation method and never infer research coverage from publisher/institution location.
- [ ] Use retained Data.gov `harvestRecordRaw` metadata for targeted explicit-DCAT-spatial enrichment where practical; keep enrichment sidecar/versioned so C2 Gold Master identity is unchanged.
- [ ] Add bounded dedicated spatial summary/feature APIs before explicit sidecar footprints can grow beyond the current bounded geography-facet summary; million-record search results must never become million browser features.
- [ ] Extend NASA CMR collection mapping with explicit spatial extent using a pinned/documented publisher representation, then add granule coverage as a distinct bounded semantic.
- [ ] Preserve semantic list/table equivalents, keyboard operation and WCAG 2.2 evidence as each new research-coverage child is added.

### Federation portfolio

- [ ] Reconcile the NASA CMR planning wording with the existing collection harvester and tests; treat collection support as an existing foundation rather than a greenfield adapter.
- [ ] Add committed canonical NASA CMR collection fixtures/evidence where coverage is still missing.
- [ ] Add controlled CMR granule handling with spatial/temporal metadata as a distinct research-object semantic.
- [ ] Prove bounded 10K/100K CMR slices before considering a larger granule corpus.
- [ ] Implement PubMed fixture/bounded API ingestion with PMID/title/abstract/authors/journal/date/type/identifier mapping.
- [ ] Evaluate PubMed bulk/baseline/update files for large reproducible ingestion rather than millions of individual API calls.
- [ ] Implement OpenAlex bounded ingestion for works/authors/institutions/topics/funders/DOI/citation relationships after the federal-source path remains stable.
- [ ] If institution/affiliation geography is later exposed from PubMed/OpenAlex, name it as a separate relationship/location analytic concept rather than research coverage.
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

- [ ] Large-projection resource/progress evidence is captured consistently and tied to corpus/projection identity.
- [ ] Durable identifier reconciliation rules are explicit.
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
