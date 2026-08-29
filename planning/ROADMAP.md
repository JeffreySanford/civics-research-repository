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

## 2. Govern browser evidence as a merge policy

Dedicated Browser Evidence is implemented and scheduled. It runs deterministic
Chromium/Firefox/WebKit comparison and accessibility evidence, preserves HTML reports and
failure traces/screenshots, and includes a live Angular -> Spring -> Solr + OpenSearch
smoke path. Mocked deterministic evidence and real-stack evidence are labelled separately.

Remaining governance decisions:

- Decide which evidence jobs must block merges.
- Decide whether `main` receives branch protection and required checks.
- Keep the local `evidence:refresh` behavior: a failed run must never replace the prior
  known-good evidence.

## 3. Harden the Solr/OpenSearch comparison demo

The first side-by-side vertical slice now exists. DSpace remains the system of record; the Java layer normalizes repository objects once, computes a deterministic projection fingerprint and projects the same documents into Solr and OpenSearch. Solr remains the production-shaped public discovery implementation while OpenSearch is currently a parallel comparison target.

The next phase is therefore **hardening, observability and explanation**, not simply adding more query types.

### 3.1 Keep the implemented test matrix as the expansion gate

The comparison service/controller, Angular component/client, OpenSearch request semantics,
deterministic Playwright scenarios, axe route, storyboard, and live-stack smoke are all
implemented. Future comparison behavior must extend those layers rather than bypassing
them.

### 3.2 Keep Admin Sync as the operational projection view

Admin Sync now explains DSpace -> normalized `DiscoveryDocument` -> deterministic
projection ID -> Solr + OpenSearch, including per-target liveness/parity and the distinction
between public Solr discovery and the OpenSearch comparison target. Future work should
extend this operational vocabulary rather than return to Solr-only language.

### 3.3 Keep Evidence explicit about verification boundaries

Evidence now includes live projection/parity state plus a Search Engine Comparison section
that separates unit/use-case gates, deterministic mocked browser evidence, automated
WCAG/Section 508-oriented evidence, real-stack smoke evidence, repeated performance
diagnostics, and manual keyboard/screen-reader work that remains pending.

The runtime page does not synthesize current CI success. Exact commit validation remains a
CI/PR artifact.

### 3.4 Improve explanatory diagnostics before broader search features

Engine-native Solr `QTime` / OpenSearch `took` and repeated warm-up/p50/p95/p99 tooling are
implemented separately from API elapsed timing. Remaining diagnostic work:

- Add result-set, rank-order and facet-bucket difference summaries so the UI explains
  semantic differences.
- Record richer environment details for scale testing: index/shard/replica configuration,
  JVM/container context and concurrency.
- Repeat at materially larger index sizes before drawing scaling conclusions.
- Keep the UI warning that local/container timings are diagnostic evidence, not production
  benchmarks.

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
