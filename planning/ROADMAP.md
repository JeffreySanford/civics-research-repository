# Roadmap

This roadmap contains future work only. Delivered phases and major architectural decisions are summarized in [documentation/history/platform-evolution.md](../documentation/history/platform-evolution.md). Current verified facts live in the generated [documentation/platform-status.md](../documentation/platform-status.md). The executable checklist is [TODO.md](TODO.md).

A repository-wide rule now applies to new comparison work: **testing and evidence precede feature expansion**. A working local screen is a development milestone, not completion. New comparison behavior should have unit/use-case coverage, contract coverage, browser workflow coverage, accessibility evidence and—where the behavior depends on infrastructure—a real-stack smoke path before broader scenarios are added.

## 1. Complete manual accessibility evidence

The highest-priority gap is evidence quality, not UI breadth.

- Run the full keyboard-only checklist without a mouse.
- Record NVDA evidence with Firefox and Chrome.
- Record JAWS evidence where a license is available, or record an explicit N/A reason.
- Complete the trusted map-click to accessible-list focus check and the rest of the map-equivalence review.
- Record the cognitive/workflow review.
- Exercise Search Lab without a mouse, including scenario selection, filter entry, run action, live completion status, projection evidence and both result regions.
- Decide whether a `contentinfo` landmark improves the application shell.

Completion means dated, commit-bound artifacts exist under `documentation/accessibility-evidence/`; it does not mean changing a manually unverified status to pass.

## 2. Make browser evidence enforceable

The repository has a substantial browser evidence suite, but the normal CI workflow does not yet enforce the complete matrix.

- Add a dedicated accessibility/browser workflow or scheduled full-matrix run.
- Persist Playwright HTML reports, traces and screenshots on failure.
- Run Search Lab comparison and axe scenarios there, not merely as source files that CI never invokes.
- Add a real-stack smoke path that starts the application stack and proves browser -> Spring API -> live Solr + live OpenSearch.
- Keep mocked browser scenarios because they are deterministic and useful for UI behavior; label them separately from real-stack evidence.
- Decide which evidence jobs must block merges.
- Decide whether `main` receives branch protection and required checks.
- Keep the local `evidence:refresh` behavior: a failed run must never replace the prior known-good evidence.

## 3. Harden the Solr/OpenSearch comparison demo

The first side-by-side vertical slice now exists. DSpace remains the system of record; the Java layer normalizes repository objects once, computes a deterministic projection fingerprint and projects the same documents into Solr and OpenSearch. Solr remains the production-shaped public discovery implementation while OpenSearch is currently a parallel comparison target.

The next phase is therefore **hardening, observability and explanation**, not simply adding more query types.

### 3.1 Test the service boundaries first

- Add focused `SearchComparisonService` use-case tests for dual-engine success, request normalization, one-engine-down behavior, one-engine exception isolation, warnings, projection parity and projection mismatch.
- Add controller tests for scenario listing and comparison execution.
- Add Angular Search Lab component tests and comparison API-client tests.
- Keep HTTP-level OpenSearch request tests that inspect real JSON request semantics rather than only testing helper methods.
- Run Playwright Search Lab scenarios and the Search Lab axe route in dedicated browser CI.
- Add Search Lab to the demo storyboard.
- Add a live-stack smoke test for the actual Solr/OpenSearch services.

### 3.2 Make Admin Sync explain the projection model

Admin Sync currently explains DSpace and Solr well, but the comparison architecture adds a broader operational concept: one normalized discovery projection can be rebuilt into multiple disposable search targets.

The Admin Sync page should show:

- DSpace as the repository/system-of-record input,
- normalized `DiscoveryDocument` count,
- deterministic projection ID/fingerprint,
- Solr target status and document count,
- OpenSearch target status and document count,
- whether each target was rebuilt from the current projection,
- warnings/failures isolated per target,
- an explicit statement that target indexes are rebuildable projections rather than authoritative repository storage.

The reindex action should communicate **normalize once, project many**. It should no longer visually imply that reindexing terminates only at the Solr discovery core.

### 3.3 Make Evidence explain what is verified

The Evidence page should expose comparison evidence without overstating what automation proves.

Add a Search Engine Comparison evidence section that distinguishes:

- projection identity/parity evidence,
- unit/use-case coverage,
- mocked deterministic browser coverage,
- axe/WCAG automated coverage,
- real-stack smoke coverage,
- manual keyboard/screen-reader evidence,
- timing observations and their environment/measurement boundary.

A local API elapsed value such as 20 ms versus 46 ms is an observation from one run, not evidence that one engine is inherently faster. Evidence should show the projection ID and document count used for a comparison and should state whether the measurement is API elapsed time, engine-native time or a repeated benchmark distribution.

### 3.4 Improve diagnostics before broader search features

- Expose engine-native search timing separately from API elapsed time: Solr `responseHeader.QTime` and OpenSearch `took`.
- Add warm-up and repeated-run tooling and report distributions (p50/p95/p99) rather than a single request.
- Add result-set, rank-order and facet-bucket difference summaries so the UI explains semantic differences.
- Record environment details when timing is captured: document count, index/shard configuration, JVM/container context and concurrency.
- Keep the UI warning that local Docker timings are not production benchmarks.

### 3.5 Expand scenarios only after hardening

After the test/evidence matrix is green:

- phrase search,
- highlighting,
- geo search,
- autocomplete/suggest,
- synonyms,
- nested/object search,
- vector and hybrid lexical/semantic search.

The hybrid/vector work is strategically useful because OpenSearch can be evaluated for capabilities beyond ordinary lexical search. It should be framed as a capability comparison rather than an assumption that OpenSearch is automatically faster than Solr.

Completion means the demo can explain observable differences between two engines using the same source data, can prove the input projection is equivalent, and can separate functional, operational and performance evidence honestly.

## 4. Harden provenance and repository identity

Repository identity is recorded for publisher-backed objects; the next step is a more explicit chain from publisher state through DSpace and discovery.

- Record source freshness per research object.
- Record projection/index timestamps and make them visible consistently in Search Lab, Admin Sync and Evidence.
- Distinguish live aggregation, stored sample, fixture fallback, stale response, and unavailable source with a typed provenance model.
- Review route handling so UUID-backed and source-identifier-backed research links remain stable.
- Add regression tests for fallback provenance, especially LODES-derived map data.

## 5. Finish research-object language

The domain model is research-object-shaped, but several routes and labels retain dataset-era wording.

- Add `/research/:id` as an alias while preserving `/datasets/:id` compatibility.
- Replace remaining labels such as “Loading dataset detail,” “Dataset supporting information,” and “Open related dataset.”
- Update API/documentation examples to use “research object” where the type is not necessarily a dataset.
- Keep type-specific language where it improves clarity: dataset files, publication authors, methodology, project, restricted microdata.

## 6. Expand publisher verification and optional federation

The catalog should remain curated, but its claims should be increasingly verifiable.

- Add publisher listing/vintage checks for programs that do not yet have them.
- Keep vintage changes reviewable; do not automatically rewrite file templates into plausible 404s.
- Evaluate NOAA Climate Data Online and NASA POWER as federation examples after the Census/USGS path remains stable.
- Preserve the distinction between publisher-discovered facts and repository-curated relationships.

## 7. Implement the documented cloud target

The AWS architecture is documented but not provisioned.

- Choose Terraform or CDK.
- Implement a minimal environment matching the documented EKS recommendation or the ECS/Fargate alternate.
- Include RDS, persistent search storage, frontend delivery, secrets, logs, metrics, backup and restore.
- Treat Solr/OpenSearch deployment topology as an explicit architecture decision rather than assuming local single-node behavior predicts production behavior.
- Document local-to-cloud migration and operational cost boundaries.

## 8. Platform and test hardening

- Move NgRx to stable 22 when available and validated.
- Revisit generated Spring controller interfaces when tooling supports Spring 7 conventions.
- Add Testcontainers coverage for `JdbcSyncJobStore` and repository integration seams.
- Replace generic API failures with typed error responses where the contract is still vague.
- Review Nx upgrade warnings and dependency alignment without changing architectural patterns merely for novelty.
- Revisit the mirror budget when storage permits, while keeping preservation totals measured and dated.

## Non-goals

The roadmap does not include:

- replacing DSpace with either public discovery index,
- sharing DSpace's internal Solr as the application's public search API,
- claiming OpenSearch is inherently faster than Solr from a single local request,
- assuming horizontal scaling is unique to OpenSearch; SolrCloud also supports distributed search,
- treating additional nodes as a guarantee of lower single-query latency,
- adding a separate Node harvester runtime,
- replacing NgRx solely to reduce line count,
- turning the repository into a municipal dashboard at the expense of its federal Open Science model,
- claiming complete Section 508 conformance from automated scans.
