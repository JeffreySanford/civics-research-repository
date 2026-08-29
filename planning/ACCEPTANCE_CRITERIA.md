# Acceptance Criteria

## First Vertical Slice

The first implementation milestone is complete when the demo can show one public research dataset flowing through the repository, API, Angular UI, map visualization, and accessibility evidence.

**Status: complete for the connected slice.** Discovery, facets, dataset detail, and related research read from DSpace; the generated fixture catalog is a labelled fallback only when the repository is unavailable. Open items below are follow-on breadth, contract polish, or demo artifacts — not a broken integration.

Checking a box here means the behavior is implemented and covered by a test, not that every adjacent seam is closed. **Testing first is the acceptance rule**: adding a test file is not enough when the relevant CI/browser/real-stack workflow has not actually executed it.

## Data and Repository

- [x] One visual geospatial North Dakota dataset from TIGER/Line or LODES is represented as a repository item.
- [x] ACS PUMS remains documented as a follow-on metadata-rich repository dataset.
- [x] Item metadata includes title, abstract, publisher, program, geography, vintage year, source URL, documentation URL, file list, and citation.
- [x] Large source files are represented by file manifests and source URLs unless intentionally mirrored.
- [x] Mirrored publisher artifacts persist in Docker storage when useful for local demo reliability.
- [x] Sync state records source identifier, source URL, DSpace item ID, last sync status, and source freshness.
- [x] Startup sync creates or updates required seed repository objects after Docker startup.
- [x] DSpace community and collection exist for Census public research data.
- [x] The item is available through DSpace REST.
- [x] The item is discoverable through Solr-backed search.
- [x] No large public-use dataset files are checked into git.

## API Contract

- [x] Search, dataset detail, versions, map layers, USGS earthquake overlay, and accessibility evidence endpoints are described in OpenAPI.
- [x] Frontend TypeScript DTOs are generated from OpenAPI.
- [x] Java DTOs are generated from OpenAPI on every build.
- [x] `pnpm run openapi:check` fails when generated frontend types drift.
- [x] API errors use typed error responses on the implemented core routes.

## Backend

- [x] `apps/repository-api` runs locally through an Nx target.
- [x] Java API targets Java 21.
- [x] API endpoints return typed responses for the first dataset.
- [x] Request validation rejects invalid pagination, IDs, date ranges, enum values, and URL inputs.
- [x] Unit tests cover controller validation and service mapping.
- [x] Backend configuration separates local DSpace, Solr, and USGS endpoints from code.

## Frontend

- [x] Search page supports keyword search, facets, loading, empty, and error states.
- [x] Search state is represented in URL parameters where practical.
- [x] Dataset detail page shows metadata, files, versions, citation, and map tab when geospatial metadata exists.
- [x] Admin workflow exposes manual sync controls and sync status.
- [x] Accessibility evidence view summarizes automated and manual evidence.
- [x] Angular API imports use generated OpenAPI types.
- [x] NgRx effects own API calls and cancellation for search, dataset detail, map overlays, and evidence.
- [x] Components do not hand-author duplicate DTOs.

## Mapping

- [x] Map tab renders a MapLibre GL Census geography or sample layer for the selected dataset.
- [x] USGS earthquake overlay can be toggled.
- [x] Map includes legend, attribution, visible update timestamp, and clear error/stale states.
- [x] Mapped information is also available as an accessible table or feature list.
- [x] Layer controls are keyboard reachable and have accessible names.

## Search Comparison

### Architecture and contract

- [x] `pnpm run start:all` includes OpenSearch as a default local service with persistent Docker storage.
- [x] DSpace remains the system of record for curated repository objects; neither Solr nor OpenSearch is authoritative repository storage.
- [x] Solr and OpenSearch receive the same normalized `DiscoveryDocument` projection rather than independently assembling source data.
- [x] The normalized projection has a deterministic SHA-256 identity so parity is stronger than document-count equality.
- [x] Per-engine projection state records whether the current projection succeeded, its projection ID, engine-reported document count, and warnings.
- [x] Search comparison endpoints are described in OpenAPI and frontend TypeScript types are generated from the contract.
- [x] The standard admin reindex contract exposes deterministic projection identity consistently.

### Search Lab behavior

- [x] `/search-lab` runs the same normalized request against Solr and OpenSearch in one comparison workflow.
- [x] The page supports facets/aggregations, full-text relevance, and filtering scenarios.
- [x] The page exposes source, expected object count, projection ID, engine index names, engine document counts, API elapsed time, engine-reported timing, facets and ranked results.
- [x] Projection parity is explicitly verified before engine differences are interpreted.
- [x] One engine can fail or be unreachable without hiding evidence returned by the other engine.
- [x] Local timing is labelled as a measurement of that run rather than a production benchmark claim.
- [x] OpenSearch preserves the implemented Solr comparison semantics for current facets/filtering.

### Testing and evidence gate

- [x] Java comparison service/use-case tests execute successfully for dual-engine success, one-engine-down behavior, failure isolation, normalization, and projection mismatch.
- [x] Comparison controller tests execute successfully.
- [x] Angular Search Lab component and typed API-client unit tests execute successfully.
- [x] Deterministic Playwright comparison scenarios execute successfully.
- [x] Search Lab axe/WCAG/Section 508-oriented route evidence executes successfully.
- [x] Search Lab is included in the executable demo storyboard.
- [x] A real-stack browser smoke test proves Angular -> Spring API -> live Solr + live OpenSearch without API route mocks.
- [x] Dedicated browser CI retains an HTML report and failure traces/screenshots and distinguishes deterministic mocked evidence from real-stack evidence.
- [x] The final PR head was green across normal workspace/API CI and dedicated browser evidence before merge.

### Operational/evidence follow-on

- [x] Admin Sync shows the normalized projection, current projection ID, and per-engine Solr/OpenSearch projection health.
- [x] Evidence contains a Search Engine Comparison section that distinguishes unit/use-case evidence, deterministic mocked browser evidence, live-stack evidence, automated accessibility evidence, and manual evidence.
- [x] Engine-native timing (`Solr QTime`, `OpenSearch took`) is exposed separately from API elapsed time.
- [x] Repeated measurement uses warm-up and p50/p95/p99 distributions before comparative performance claims.
- [x] Broader phrase/highlight/geo/suggest/synonym/vector/hybrid scenarios wait until the current comparison test matrix is green.

## PI-1 Federated Metadata Expansion

Detailed designs:

- [Federated Metadata Expansion](../documentation/federation/README.md)
- [Federated Metadata Architecture](../documentation/federation/federated-metadata-architecture.md)
- [Source Ingestion Plan](../documentation/federation/source-ingestion-plan.md)
- [Million-Record Federated Metadata Corpus](../documentation/federation/million-record-corpus.md)

### Authority, provenance and identity

- [ ] DSpace remains authoritative for curated repository objects.
- [ ] Federated records identify their authoritative external publisher/source and are persisted locally as reproducible metadata, not as fake DSpace objects.
- [ ] Solr and OpenSearch remain derived state for repository and federated origins.
- [ ] Search/detail contracts distinguish `REPOSITORY`, `FEDERATED` and fixture/fallback origins.
- [ ] A controlled `sourceSystem` identifies the adapter/source independently of free-form publisher/program values.
- [ ] Source records use namespaced stable identity such as `DOE_OSTI:<id>` or `PUBMED:<pmid>`.
- [ ] Cross-source reconciliation uses durable identifiers/explicit relationships rather than silent title matching.

### Scalable metadata model and projection

- [ ] Publisher/program/subject facets can represent source data without collapsing unknown values into a single `OTHER` bucket.
- [ ] Federated metadata persistence records normalized fields, provenance, source URLs, harvest state and bounded source-specific metadata.
- [ ] `/research/:id` resolves DSpace-backed and federated detail while `/datasets/:id` remains compatible during transition.
- [ ] Federated detail clearly links to authoritative external resources without claiming local file preservation.
- [ ] Discovery projection can process 100K/1M records in bounded batches rather than materializing the whole corpus in memory.
- [ ] Solr/OpenSearch indexing uses bounded bulk updates rather than one giant whole-corpus request body.
- [ ] Deterministic projection identity is stable across different page/batch sizes.
- [ ] Search pagination has a tested path away from expensive deep offsets, using opaque cursor semantics where needed.

### Harvester framework

- [ ] A common adapter/harvester framework owns retries, rate limits, paging, checkpoints, resume, cancellation, progress and error quarantine.
- [ ] Harvest runs record source, requested limit, accepted/rejected/skipped counts, retrieval window and adapter version.
- [ ] Tiny deterministic source fixtures cover adapters in normal CI without public-network dependency.
- [ ] Heavy 100K/1M harvest/index evidence is manual/scheduled and does not run on every pull request.

### PI-1 source portfolio

- [ ] Data.gov adapter supports reproducible bounded harvest and renders through the normal discovery/detail UI.
- [ ] DOE OSTI adapter supports reproducible bounded harvest and supplies the preferred first 1M federal research corpus.
- [ ] NASA CMR adapter distinguishes collection and granule metadata and supports controlled large slices.
- [ ] PubMed adapter supports reproducible bibliographic harvesting and a large-corpus path appropriate to publisher bulk/update mechanisms.
- [ ] OpenAlex adapter supports controlled scholarly/citation snapshots without requiring the entire source corpus locally.
- [ ] All five adapters have normalization/identity/malformed-record fixture coverage.

### PI-1 corpus evidence

- [ ] Deterministic 10K and 100K corpora can be regenerated with source/date/count/version/hash manifests.
- [ ] A deterministic 1M normalized metadata corpus can be generated without committing it to Git.
- [ ] Underlying publisher binaries/full text remain external by default.
- [ ] Standalone Solr and standalone OpenSearch receive the same 1M normalized corpus with matching count/projection identity.
- [ ] Indexing duration, accepted/rejected counts, failures, memory and disk growth are recorded.
- [ ] Stable large-corpus query definitions cover identifiers, rare/common terms, authors, publishers, sources, types, dates and high/low-cardinality facets.
- [ ] Result-set/top-N/rank/facet differences are recorded so faster-but-wrong behavior cannot pass.
- [ ] The original small curated Compose demo remains functional and easy to start.
- [ ] PI-1 exports/version-controls corpus manifests/query definitions that PI-2 can consume without changing record semantics.

## PI-2 Local Kubernetes Search Laboratory

Detailed designs:

- [Local Cloud Search Laboratory](../documentation/cloud/README.md)
- [Local Kubernetes Search Cluster](../documentation/cloud/local-kubernetes-search-cluster.md)

### Supported topology model

- [ ] Docker Compose remains functional as the default fast development/demo/reference path after Kubernetes is introduced.
- [ ] Kubernetes uses the same normalized PI-1 corpus/query definitions rather than a separate synthetic data model.
- [ ] A reproducible kind cluster can be created and destroyed from repository-owned configuration/scripts.

### Clustered search

- [ ] Solr runs as SolrCloud through the official Solr Operator with at least three Solr pods.
- [ ] OpenSearch runs as a multi-node Kubernetes cluster through the official operator or Helm chart.
- [ ] Persistent storage, readiness/liveness probes and explicit CPU/memory/JVM settings are defined for both search engines.
- [ ] Standalone and clustered Solr schema/config semantics are verified equivalent before performance interpretation.
- [ ] Standalone and clustered OpenSearch mappings/analyzers are verified equivalent before performance interpretation.
- [ ] The same normalized corpus reaches clustered Solr and OpenSearch with matching deterministic identity and expected count.
- [ ] Search Lab can execute the live comparison through Spring against both clustered engines.

### Cluster evidence

- [ ] 10K and 100K PI-1 corpora are measured in standalone and clustered topologies.
- [ ] The PI-1 1M corpus is measured where workstation resources remain stable.
- [ ] Concurrency 1/8/32 is measured with identical stable query definitions.
- [ ] Benchmark artifacts record node/shard/replica/resource/heap/storage/concurrency context.
- [ ] Engine order is balanced/randomized/separated before comparative speed conclusions.
- [ ] Semantic result/facet behavior is verified before performance differences are accepted.
- [ ] A deliberate Solr node-loss/recovery experiment records availability, recovery and parity.
- [ ] A deliberate OpenSearch node-loss/recovery experiment records availability, recovery and parity.
- [ ] Kubernetes results are described as local clustered evidence, never as proof that kind workers equal physical/cloud nodes.

## Accessibility Evidence

- [x] `pnpm run wcag:report` produces a console report.
- [x] `pnpm run section508:report` produces a console report.
- [x] Angular evidence view displays the latest accessibility evidence status.
- [x] Automated scans cover search, dataset detail, and map workflows.
- [x] Keyboard tests cover search filters, result navigation, dataset tabs, and map layer controls.
- [x] Manual checklists exist for keyboard, NVDA, JAWS where available, and map equivalence.
- [x] Known accessibility limitations are documented.
- [ ] Manual Search Lab keyboard and screen-reader evidence is recorded before a manual conformance claim is made for that workflow.
- [ ] PI-1 federated discovery/detail changes preserve keyboard, reflow, focus and accessible-name evidence as source/facet counts grow.

## Demo Readiness

- [x] `pnpm run start:all` starts the full development and demonstration experience, including DSpace, seed, reindex, and the OpenSearch comparison service.
- [x] Docker Compose starts persistent local services and the app can be demoed after restart.
- [x] Continuous integration runs the normal quality gates on pull requests.
- [x] Dedicated browser evidence passed the current comparison workflow before merge.
- [ ] PI-1 retains an explicit small/demo profile so a million-record corpus is never required for a normal demonstration.
- [ ] PI-2 retains the same small/demo Compose path after kind/Kubernetes scripts are added.
- [ ] `main` is protected with required status checks if/when repository governance chooses that policy.
- [x] Demo script explains the current architecture, dataset flow, map overlay, and accessibility evidence.
