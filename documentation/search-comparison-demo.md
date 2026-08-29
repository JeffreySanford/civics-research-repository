# Solr and OpenSearch Comparison Demo

## Purpose

The comparison demo makes differences between Solr and OpenSearch observable without changing repository ownership. **DSpace remains the system of record.** The Spring API reads or receives normalized repository metadata, produces one application-owned `DiscoveryDocument` projection, computes a deterministic SHA-256 projection identity, and rebuilds configured search targets from that same normalized document set.

The current application has two search targets:

- **Solr** — the production-shaped browser-facing public discovery implementation.
- **OpenSearch** — a parallel application-owned comparison target used by Search Lab.

Neither search engine is authoritative storage. Both indexes are disposable projections that must be recoverable from the repository/catalog path.

OpenSearch is part of `pnpm run start:all` so the comparison works from the same local Docker baseline as the rest of the platform.

## Implemented Architecture

The central design rule is **normalize once, project many**.

```text
Publisher metadata / DSpace
          |
          v
DiscoveryProjectionService
          |
          +--> normalized List<DiscoveryDocument>
          |
          +--> deterministic SHA-256 projection ID
          |
          +----------------------+----------------------+
          |                                             |
          v                                             v
   Solr projection                              OpenSearch projection
   discovery core                               discovery-comparison
          |                                             |
          +----------------------+----------------------+
                                 |
                                 v
                         SearchComparisonService
                                 |
                                 v
                             /search-lab
```

`DiscoveryProjectionTarget` represents a rebuildable search target. `DiscoveryIndex` extends that projection contract with the browser-facing public discovery query operations. This split prevents adding OpenSearch from creating a second ambiguous `DiscoveryIndex` bean and, more importantly, preserves a clear architectural statement: Solr remains the normal discovery path while OpenSearch is measured beside it.

A projection rebuild creates one normalized document list and supplies exactly that list to every configured projection target. Target failures are isolated. A Solr failure does not prevent the API from attempting OpenSearch, and an OpenSearch failure does not make the normalized in-memory/repository state disappear.

## Projection Identity and Parity

Document counts alone are not sufficient proof that two indexes contain the same logical projection. Two different 181-document sets could have the same count.

The repository therefore computes a deterministic projection fingerprint:

1. Normalize the `DiscoveryDocument` objects.
2. Sort them deterministically by research-object ID.
3. Serialize using stable property/map ordering.
4. Compute SHA-256 over the canonical JSON representation.
5. Expose the resulting lowercase 64-character hexadecimal projection ID.

The comparison service records per-target projection state including:

- target/index name,
- enabled state,
- whether the current rebuild succeeded,
- projection ID used by that target,
- engine-reported indexed document count,
- warning text where appropriate.

`sameProjection` is true only when all of the following are true:

- the current normalized projection has a projection ID,
- Solr reports a successful current projection,
- OpenSearch reports a successful current projection,
- each target's projection ID matches the current projection ID,
- each target's indexed document count equals the expected normalized object count.

This is deliberately stronger than comparing counts.

## Search Lab User Experience

The implemented comparison experience lives at `/search-lab` and presents the same normalized request to both engines.

The current page provides:

- scenario selection,
- search terms,
- geography,
- program,
- research-object type,
- vintage year,
- one **Run both engines** action,
- live loading/completion status,
- projection source and object count,
- rebuilt timestamp when available,
- projection ID,
- explicit projection-parity status,
- Solr enabled/reachable/index/document-count/timing information,
- OpenSearch enabled/reachable/index/document-count/timing information,
- Solr facets and OpenSearch aggregations,
- ranked results for both engines,
- engine warnings without hiding the other engine's result,
- a prominent statement that timing is local demo evidence rather than a production benchmark.

The earlier design proposed `Run Solr`, `Run OpenSearch`, and `Run Both`. The first implemented vertical slice intentionally uses **Run both engines** because the primary purpose is direct comparison. Single-engine controls can be added later if they serve a demonstrated use case, but they are not required to prove the current architecture.

## Implemented Scenarios

### 1. Facets vs aggregations

Solr field facets are compared with OpenSearch filtered terms aggregations for:

- program,
- geography,
- research-object type,
- vintage year.

The OpenSearch implementation deliberately preserves **self-excluding facet semantics**. For example, when `program=LODES` is selected, the program aggregation excludes the program filter while retaining geography/type/year filters. This keeps the available program buckets useful and comparable with Solr tagged-facet behavior instead of collapsing the aggregation to the already-selected program.

Geography aggregation uses the keyword subfield rather than analyzed text, and vintage-year buckets are explicitly ordered by descending key to match the user-facing Solr presentation.

### 2. Full-text relevance

The current OpenSearch relevance query uses weighted `multi_match` fields:

- title `^5`,
- geography `^4`,
- subjects `^3`,
- program `^3`,
- authors `^3`,
- summary `^2`,
- citation `^1`,
- publisher `^0.5`.

It also applies phrase boosts for title, geography and summary. This is not intended to prove that one relevance model is objectively superior. The scenario exists to make ranking differences visible and explainable.

### 3. Filtering

The comparison applies equivalent normalized filters for:

- program,
- geography,
- research-object type,
- vintage year.

Filters are applied independently of the query text so the lab can distinguish lexical relevance from filter semantics.

## Planned Scenarios After Test Hardening

The next scenarios should not be added until the current comparison path is fully covered by unit/use-case, browser, accessibility and real-stack tests.

Planned additions:

- phrase search,
- highlighting,
- geo search: bounding box, distance, intersects and geography filters,
- autocomplete/suggest,
- synonyms,
- nested/object search for files, evidence, authors and relationships,
- vector search,
- hybrid lexical + semantic search.

Hybrid/vector comparison is strategically useful because it evaluates a capability dimension rather than assuming OpenSearch should simply be a faster Solr replacement.

## OpenSearch Mapping

The OpenSearch comparison index intentionally uses engine-neutral conceptual field names rather than copying Solr schema suffix conventions.

Current fields include:

- `id` — keyword,
- `title` — text with keyword subfield,
- `contentType` — keyword,
- `program` — keyword,
- `publisher` — text with keyword subfield,
- `summary` — text,
- `geography` — text with keyword subfield,
- `vintageYear` — integer,
- `accessLevel` — keyword,
- `sourceUrl` — keyword,
- `subjects` — text,
- `authors` — text,
- `citation` — text,
- `doi` — keyword.

The mapping is recreated with the comparison index during projection rebuild. This is appropriate for the current disposable demo projection; production migration planning would require alias/version/reindex strategy rather than destructive recreation.

## API Contract

The comparison is OpenAPI-first.

Implemented endpoints:

- `GET /api/search/comparison/scenarios`
- `POST /api/search/comparison/run`

The generated contract includes:

- `SearchComparisonScenarioId`,
- `SearchComparisonScenario`,
- `SearchComparisonRequest`,
- `SearchComparisonProjection`,
- `SearchComparisonEngine`,
- `SearchEngineComparison`,
- `SearchComparisonResponse`.

The response includes both engine blocks so one engine's failure does not mask useful evidence from the other.

`DiscoveryProjectionState` also includes an optional projection ID in the canonical contract. The standard admin reindex controller should return that generated DTO consistently so Admin Sync and Search Lab can use the same projection identity vocabulary.

## Admin Sync Operational Evidence

Admin Sync now presents search projection operations rather than a Solr-only terminal view.
It shows DSpace as the system-of-record input, normalized object count, deterministic
projection identity, Solr public-discovery target state, OpenSearch comparison-target state,
document counts, parity, warnings and the multi-target rebuild model: **normalize once,
project many**.

The operational probe intentionally omits request timing. Search Lab and the benchmark
harness own query/performance diagnostics.

## Evidence Page Integration

`/evidence` now contains a **Search comparison** tab. It combines live projection/parity
state with an explicit evidence-classification table covering:

- service/contract/component CI gates,
- deterministic mocked browser evidence,
- automated WCAG/Section 508-oriented evidence,
- live Solr/OpenSearch smoke evidence,
- repeated performance diagnostics,
- manual keyboard/screen-reader evidence that remains pending.

The runtime page does not infer that the current commit is green. Exact pass/fail state is
retained by CI and Browser Evidence.

## Testing-First Completion Rule

Search comparison changes should satisfy the following layers before broader capability work proceeds:

1. **Unit tests** — focused logic and transformation behavior.
2. **Use-case/service tests** — dual-engine success, partial failure and parity decisions.
3. **Controller/contract tests** — endpoints and generated DTO behavior.
4. **Angular component/client tests** — request construction, state and partial-failure rendering.
5. **Lint/format/generated drift gates** — no contract or generated artifact divergence.
6. **Mocked browser E2E** — deterministic scenario behavior.
7. **Automated accessibility** — Search Lab route included in axe WCAG/Section 508-oriented scans.
8. **Storyboard** — the demo navigation/story includes the comparison capability.
9. **Real-stack smoke** — browser/API request reaches live Solr and OpenSearch.
10. **Manual evidence** where required — keyboard and screen-reader workflows.

The repository should not use the existence of a test file as evidence that the test is enforced. Dedicated browser CI must actually execute the Playwright/axe suites and retain useful failure artifacts.

## Measurement: API and Engine-Reported Boundaries

Search comparison now exposes two different timing boundaries from the same execution:

```text
Solr
API elapsed:       N ms
Solr QTime:        N ms

OpenSearch
API elapsed:       N ms
OpenSearch took:   N ms
```

API elapsed measures the Spring-side round trip to the engine. `QTime` and `took` are parsed
from the same engine response that supplied the results, so no second timing-only request is
issued. The vendor metrics are labelled **engine reported** because their definitions are
not identical.

Browser Evidence also runs a repeated benchmark with 5 discarded warm-ups and 100 measured
requests, reporting min/mean/p50/p95/p99/max for API elapsed and engine-reported series.
Projection identity must remain stable and both engines must remain reachable for a run to
be accepted. Fixed Solr-then-OpenSearch execution order is recorded, so the artifact does
not make a comparative winner claim.

Detailed protocol and baseline numbers are documented in
[Search Performance Evidence](search-performance-evidence.md).

## Scaling and Nodes

OpenSearch's value is **not limited to adding nodes**, and adding nodes does not automatically reduce the latency of one query. Distributed search can introduce coordination and result-reduction overhead. Additional nodes are primarily useful for larger datasets, throughput, replicas/high availability, workload isolation and operational scale.

The same caution applies when comparing architecture claims: horizontal/distributed search is not unique to OpenSearch. SolrCloud also provides sharding, replicas and distributed query execution.

Therefore the comparison should evaluate multiple dimensions:

- query/relevance semantics,
- facet/aggregation behavior,
- operational fit,
- deployment model,
- observability,
- high availability,
- scaling behavior,
- analytics ecosystem,
- vector/semantic/hybrid capabilities,
- AWS integration where relevant,
- cost/complexity.

"OpenSearch is faster" is not an architectural requirement and should not be treated as the expected outcome.

## Remaining Timing Improvements

The next performance work is about scale and experimental design rather than adding more
stopwatch fields:

1. record shard/replica/node topology and concurrency with benchmark artifacts,
2. balance or randomize engine execution order for comparative experiments,
3. repeat at materially larger index sizes such as 10,000, 100,000 and 1,000,000 documents,
4. add result/rank/facet difference summaries alongside timing,
5. avoid production-speed claims until topology, data volume and concurrency are realistic.

## Why OpenSearch Can Still Be Strategically Interesting

The strongest comparison is broader than latency. OpenSearch can be evaluated for modern search and analytics capabilities, especially vector and hybrid retrieval.

A future hybrid scenario could combine:

```text
lexical/BM25 relevance
        +
semantic vector similarity
        +
repository metadata filters
        +
program/geography/access constraints
        =
combined discovery ranking
```

That is particularly useful for research/patent-style discovery where semantically related material may use different terminology. The lab should compare capability and explain tradeoffs instead of presupposing a winner.

## Accessibility Requirements

The comparison view follows the same evidence standard as the rest of Discovery.

Required behaviors include:

- keyboard access to scenario and filter controls,
- keyboard access to the run action,
- announced loading and completion states,
- meaningful headings for projection, Solr and OpenSearch regions,
- lists/tables for facets and ranked results,
- no color-only parity or failure indicators,
- readable warnings when one engine fails,
- stable focus behavior after execution,
- automated axe coverage,
- storyboard coverage,
- manual keyboard and screen-reader evidence before claiming manual conformance.

## Non-Goals

The comparison demo does not:

- replace DSpace,
- expose DSpace's internal Solr as the public app search core,
- make OpenSearch the default browser discovery engine merely because it is present,
- claim local Docker timing is a production benchmark,
- claim automated axe scanning proves full Section 508 conformance,
- assume OpenSearch is inherently faster than Solr,
- assume adding nodes guarantees lower single-query latency,
- assume distributed scaling is unique to OpenSearch.
