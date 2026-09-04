# Acceptance Criteria

This file records the current acceptance boundary for the mature standalone reference implementation. A checked item means the behavior is implemented and supported by repository evidence/tests; it does **not** imply that every adjacent future enhancement is complete.

The repository rule remains: **testing/evidence precedes feature expansion**.

## Core Open Science vertical slice

- [x] DSpace remains the system of record for curated repository objects.
- [x] Curated research objects include datasets, publications, methodology and projects.
- [x] Metadata supports title, summary/abstract, publisher/program, geography, vintage year, source/documentation URLs, files/manifests and citations where applicable.
- [x] Large public-use source artifacts are linked/manifested or intentionally mirrored rather than checked into Git merely for scale.
- [x] DSpace REST is part of the live application path.
- [x] Public discovery is served through the application-owned search projection.
- [x] Fixture/fallback content is labelled rather than silently substituted for live repository content.

## API and application architecture

- [x] Browser-facing routes are described through OpenAPI contracts.
- [x] Frontend TypeScript DTOs/clients are generated from OpenAPI.
- [x] Java DTOs are generated from OpenAPI/build tooling.
- [x] Generated-contract drift is a repository quality concern rather than hand-maintained duplication.
- [x] Spring/Java API remains the browser boundary; Angular does not call DSpace, Solr or OpenSearch directly.
- [x] Validation rejects invalid IDs/pagination/filter/enum inputs on implemented routes.
- [x] Typed API/use-case/component tests cover the primary product paths.

## Angular frontend

- [x] Discovery supports keyword search and facets.
- [x] Search state is represented in URL parameters where practical.
- [x] Loading, empty and error states are explicit.
- [x] Research detail supports repository-backed and federated records through authority-neutral routing.
- [x] Provenance/authority messaging distinguishes curated repository content from federated external-source metadata.
- [x] Admin surfaces synchronization/corpus/projection state.
- [x] Evidence surfaces automated/manual evidence boundaries and certified search-research evidence.
- [x] Angular API usage relies on generated contracts rather than duplicate handwritten DTOs.
- [x] NgRx/effects own asynchronous application workflows for primary search/detail/maps/evidence paths.
- [x] Observable-driven shared state remains the primary application pattern.

## Maps and data visualization

- [x] MapLibre renders implemented Census/USGS/research-coverage visual layers.
- [x] Mapped information has semantic list/table equivalents rather than canvas-only meaning.
- [x] Layer controls are keyboard reachable and labelled.
- [x] Map state includes provenance/attribution and explicit loading/error/stale/unsupported conditions where applicable.
- [x] Shared authoritative geography/value patterns prevent every thematic layer from inventing independent geometry semantics.
- [x] Browser feature payloads for research coverage are bounded rather than attempting to render the million-record corpus as million map features.
- [x] Research geography is not inferred merely from publisher/institution location.

## Federated authority and provenance

- [x] DSpace remains authoritative for curated repository objects.
- [x] External publishers remain authoritative for federated source records/resources.
- [x] Application PostgreSQL retains reproducible federated metadata/harvest/evidence state without pretending those records are DSpace items.
- [x] Solr and OpenSearch remain derived state for curated + federated origins.
- [x] Search/detail contracts distinguish repository/federated provenance.
- [x] Controlled `sourceSystem` identifies source adapters independently of free-form publisher/program values.
- [x] Federated records use namespaced source identity.
- [ ] Cross-source DOI/PMID/other durable intellectual-work reconciliation rules are fully explicit for future bibliographic federation.

## Scalable metadata and projection

- [x] Federated metadata persistence is bounded/batch-oriented.
- [x] Discovery projection processes large corpora in bounded streaming/batch form rather than requiring a whole-corpus in-memory list.
- [x] Solr/OpenSearch receive the same normalized projection input.
- [x] Deterministic projection identity is used in addition to document counts.
- [x] Projection identity remains stable enough to support restart-safe active corpus state and evidence comparison.
- [x] Deep discovery has an opaque cursor/search-after path rather than relying only on expensive deep offsets.
- [x] Complete C2 traversal has been certified without gaps or duplicates.
- [x] Heavy million-record work remains explicit/manual research work rather than ordinary PR CI.

## Certified C2 corpus

- [x] Exact retained federated corpus contains **500,000 Data.gov + 500,000 DOE OSTI = 1,000,000 records**.
- [x] Curated DSpace adds **181** objects for a **1,000,181-document** normalized search projection.
- [x] Composition SHA is `e2c7cceb641589715a6390cb35846a67d7361fb15ec00fe3445a3e0036a5524b`.
- [x] Projection ID is `3d461a9feb49f7239f3f6aaacb0c90f1ff43d0c683238acc2202c841154db44d`.
- [x] Solr and OpenSearch both hold **1,000,181** documents for the certified projection.
- [x] Exact source quotas are enforced; an arbitrary million-row mix is not accepted as equivalent C2.
- [x] The retained corpus has a verified Gold Master archive/restore path.
- [x] Restart-safe activation preserves a valid `FEDERATED_1M` projection across ordinary API restart/rebuild.
- [x] Read-only live scale certification validates retained count, source recipe, activation identity, projection parity and public provenance.

## Search comparison architecture

- [x] OpenSearch is a comparison projection target rather than a second source of repository authority.
- [x] `/search-lab` runs the same normalized application request against Solr and OpenSearch.
- [x] Projection parity is verified before engine differences are interpreted.
- [x] One engine can fail without hiding evidence from the other engine.
- [x] API elapsed and engine-native timing are retained separately.
- [x] Solr `QTime` and OpenSearch `took` are not mislabeled as semantically identical vendor metrics.
- [x] Current facet/filter semantics have explicit equivalence checks before performance evidence is admitted.
- [x] Search comparison evidence distinguishes deterministic mocked browser evidence from live real-stack evidence.

## Scientific C2 performance evidence

- [x] Repeated measurements discard warmups before measured samples.
- [x] Raw paired request samples are retained.
- [x] Bootstrap confidence evidence is generated from retained paired observations.
- [x] Independently warmed benchmark batches are retained as a stronger repeated experimental unit.
- [x] Fixed, alternating and seeded randomized engine-order strategies are supported.
- [x] Certified C2 uses a retained randomized seed/order plan.
- [x] Workload classes cover full text, facets, broad filter and program filter.
- [x] Both `SOLR_FIRST` and `OPENSEARCH_FIRST` workload evidence are retained.
- [x] Concurrency **1 / 8 / 32** is measured.
- [x] CPU, memory, JVM/GC and container telemetry is captured with counter/gauge distinction and reset detection.
- [x] Automated statistical research synthesis is generated from retained artifacts.
- [x] Certified C2 evidence is exposed through a stable repository API/OpenAPI/generated-client path to Angular.
- [x] Evidence UI exposes corpus identity, order robustness, batch inference, paired workload latency, concurrency, telemetry and claim boundary.
- [x] Scientific interpretation is scoped to the documented corpus/mappings/workloads/versions/local topology.
- [x] The repository does not claim that either search engine is universally faster or more resource-efficient.
- [x] Per-cell confidence intervals are not presented as a multiplicity-adjusted family-wide significance test.

## Search comparison testing/evidence gate

- [x] Java service/use-case/controller tests cover dual-engine success, partial failure and projection mismatch behavior.
- [x] Angular comparison/component/client tests execute as repository quality evidence.
- [x] Deterministic Playwright comparison scenarios exist.
- [x] Search Lab axe/WCAG/Section 508-oriented automated evidence exists.
- [x] Real-stack browser smoke proves Angular -> Spring -> live Solr + live OpenSearch without substituting API route mocks for engine traffic.
- [x] Browser evidence retains reports/traces/screenshots for failure diagnosis.
- [x] Cross-browser Chromium/Firefox/WebKit evidence passed the certified C2 Evidence UI head before merge.

## Automated accessibility evidence

- [x] Angular/template prevention rules cover common accessibility regressions.
- [x] Component-state accessibility evidence exists.
- [x] Browser axe/structural evidence exists for primary workflows.
- [x] Reflow/zoom/contrast/forced-colors/dark-mode conditions are part of the evidence architecture.
- [x] Map-equivalence automation checks visual/nonvisual state relationships.
- [x] Automated evidence is explicitly distinguished from manual assistive-technology review.

## Manual accessibility evidence — #49

- [ ] Full-application keyboard-only run is recorded with date/commit context.
- [ ] Search Lab keyboard-only comparison flow is recorded.
- [ ] Evidence page focus/read-order review is recorded.
- [ ] Maps/MapLibre keyboard and visual/nonvisual equivalence review is recorded.
- [ ] NVDA + Firefox evidence is recorded.
- [ ] NVDA + Chrome/Chromium evidence is recorded.
- [ ] JAWS is recorded or explicitly marked N/A with licensing reason.
- [ ] Cognitive/workflow review is recorded.
- [ ] WCAG 2.2 focus-not-obscured/dragging-alternative/target-size manual checks are recorded.
- [ ] Current federal ICT Testing Baseline / Trusted Tester crosswalk is recorded.

## C2.1 adversarial validation — #47

Certified C2 remains historical/control evidence. C2.1 is a separately versioned attempt to falsify the observed Solr advantage.

- [x] C2.1 protocol is preregistered before timing evidence collection.
- [ ] Exact Solr/OpenSearch versions are pinned for C2.1.
- [ ] Explicit/equalized resource controls are retained with C2.1 artifacts.
- [ ] Semantically equivalent OpenSearch-friendly optimizations are admitted as treatments.
- [ ] Preregistered multi-query full-text matrix is executed.
- [ ] Broad/moderate/genuinely selective filter bands are executed.
- [ ] p90 is added while retaining p50/p95/p99.
- [ ] Multiple independent clean restart blocks are completed.
- [ ] Every preregistered cell is reported, including OpenSearch wins.
- [ ] C2.1 Evidence/reporting remains visibly distinct from certified C2.

## Deferred topology research

Issue #48, the local Kubernetes search laboratory, is closed **not planned** for the current acceptance boundary. Docker Compose remains the default development/demo and standalone research topology. Clustered/Kubernetes acceptance criteria may be introduced later only if deployment/resilience becomes an explicit project requirement.

## Final frontend mission alignment — #51

- [ ] README presents the Angular government/Open Science data-discovery frontend before deep federation/search-research detail.
- [ ] Frontend engineering case study documents Angular/NgRx/RxJS/OpenAPI/accessibility decisions with implementation/evidence references.
- [ ] Demo package contains a concise frontend-first 5-8 minute walkthrough.
- [ ] `/discovery`, research detail, `/maps`, `/evidence` and `/search-lab` receive final UX/accessibility presentation audit.
- [ ] Browser ownership boundary is explicit: Angular owns interaction/presentation/accessibility; Spring owns application use cases; DSpace/search engines remain behind typed APIs.
- [ ] Existing independence/non-affiliation disclaimer is preserved.

## Demo readiness

- [x] `pnpm run start:all` starts the complete local development/demo stack.
- [x] Persistent volumes preserve the mature local corpus/evidence across ordinary restart/rebuild operations.
- [x] Small/demo Compose remains a supported product path independent of the million-record research corpus.
- [x] Continuous integration runs deterministic repository quality gates.
- [x] Dedicated browser evidence covers the current comparison/frontend workflows.
- [ ] Final #51 demo narrative is frontend-first and aligned with the mature product presentation.

## Governance / optional future breadth

- [ ] Decide whether `main` receives required-check branch protection.
- [ ] Decide which browser/accessibility jobs become required merge checks.
- [ ] Preserve prior known-good accessibility evidence if refresh fails.
- [ ] Cross-source DOI/PMID reconciliation is explicit before large bibliographic-source expansion.
- [ ] Additional NASA/PubMed/OpenAlex work remains bounded/evidence-first rather than a prerequisite for the certified standalone baseline.
- [ ] Additional Maps thematic layers reuse shared authoritative geometry/value contracts and semantic equivalents.
- [ ] Phrase/highlight/geo/suggest/synonym/nested/vector/hybrid search breadth remains evidence-gated.
