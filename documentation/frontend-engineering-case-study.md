# Frontend Engineering Case Study

## What this frontend is designed to prove

Civics Research Repository is an independent federal Open Science reference implementation. The browser application is deliberately built as a government-grade data-discovery frontend rather than as a thin view over one search engine or repository product.

The frontend owns the public research experience:

- discovery, facets, paging and shareable URL state;
- research-object detail and provenance presentation;
- map interaction and equivalent semantic data;
- accessibility, status and failure-state presentation;
- operator-facing repository/corpus workflows;
- reviewable evidence and search-comparison views.

It does **not** own DSpace, Solr or OpenSearch integration details. Those stay behind the generated REST boundary exposed by the Spring repository API.

```text
Angular 22 / NgRx / RxJS / MapLibre
        |
        | generated typed REST contract
        v
Spring repository API
        |
        +--> DSpace
        +--> application PostgreSQL
        +--> Solr / OpenSearch
```

This separation keeps interaction state and accessibility concerns in the browser while engine-specific queries, repository credentials, source synchronization and projection lifecycle remain server-side.

## Angular page and route architecture

The landing page is eager; the working application routes are lazy-loaded in [`app.routes.ts`](../apps/discovery-ui/src/app/app.routes.ts). That keeps the initial route from paying for administration, mapping and dense evidence components before a visitor needs them.

The primary portfolio routes are:

| Route           | Frontend responsibility                                                                  |
| --------------- | ---------------------------------------------------------------------------------------- |
| `/discovery`    | Search, facets, URL state, paging, provenance and research-to-map handoff                |
| `/research/:id` | Authority-neutral research-object detail with curated/federated distinctions             |
| `/maps`         | MapLibre visualization plus equivalent semantic data and shared selection state          |
| `/evidence`     | Accessibility, pipeline and search-research evidence with explicit claim boundaries      |
| `/search-lab`   | Diagnostic Solr/OpenSearch comparison without leaking engine integration into components |

The browser architecture favors page components that coordinate user intent with NgRx state, while API ownership lives in effects/services and wire shapes come from the generated OpenAPI client.

## Discovery: URL state, NgRx and bounded result rendering

[`discovery-page.ts`](../apps/discovery-ui/src/app/pages/discovery-page.ts) is the clearest example of the frontend boundary.

The page:

- reads search state from Angular Router query parameters;
- dispatches NgRx actions rather than calling Solr or the repository API directly;
- renders results, facets, pagination, loading/error state and corpus identity from selectors;
- preserves publisher/program/source values supplied by the active index instead of imposing a fixed UI taxonomy;
- resets paging when filters change but preserves deep-linked page state on initial load;
- writes effective search state back into the URL so a research view is shareable and reproducible;
- carries the same effective discovery criteria into the Maps route.

[`discovery-page.html`](../apps/discovery-ui/src/app/pages/discovery-page.html) keeps provenance and degradation visible. Curated and federated content use one result surface, while source system, origin, access level and authoritative links remain explicit. Fixture fallback is labelled rather than being silently presented as repository-backed content.

Paging is also treated as an interaction problem, not only a data problem. When the result list is replaced, focus is moved to the result heading and scrolled back into view. That prevents keyboard users from being stranded on a pager control whose surrounding content has just changed.

## NgRx ownership and observable async behavior

Primary asynchronous workflows use NgRx actions/effects/reducers/selectors rather than component-owned request state. Discovery, detail, Maps and Evidence pages select observable state and dispatch user intent.

That division provides several useful properties for a federal data application:

1. route/query state can be translated into deterministic actions;
2. loading, success, empty, stale, partial-service and failure states are first-class states rather than ad hoc booleans in templates;
3. MapLibre state and semantic list/table state can share one source of truth;
4. components remain testable against selectors/actions without knowing transport details;
5. backend replacement or search-engine experimentation does not require rewriting presentation components.

The search state implementation is under [`state/search`](../apps/discovery-ui/src/app/state/search/), with parallel feature state for maps, evidence and other workflows.

## Generated OpenAPI client: one browser/backend contract

The TypeScript client in [`libs/repository/api-client`](../libs/repository/api-client/) is generated from [`schemas/openapi/repository-api.yaml`](../schemas/openapi/repository-api.yaml).

Frontend components therefore do not maintain handwritten copies of backend DTOs. Contract changes such as the C2.1 adversarial evidence model update the schema first, regenerate TypeScript, and then flow through NgRx/component tests. CI rejects stale generated clients.

This is especially important for evidence and provenance surfaces, where a nullable/missing field can change the meaning of a claim. Keeping the OpenAPI schema as the source of truth prevents the browser and Java API from silently drifting into different interpretations.

## Research-object detail: presentation without repository coupling

The canonical browser route is `/research/:id`. A route token can resolve to either curated DSpace-backed content or retained federated publisher metadata, but the Angular route does not decide how that lookup happens.

The UI presents the authority model it receives:

- curated repository metadata can include repository relationships, versions and files;
- federated metadata identifies its external source/publisher and authoritative resource;
- restricted or external content remains discoverable without implying that a downloadable file is locally preserved.

That makes provenance a frontend behavior rather than a backend implementation detail hidden from the user.

## Maps: visual and nonvisual state are peers

The Maps route uses MapLibre for the visual workspace, but the canvas is not treated as the accessibility model.

Map controls, semantic tables/lists, selected geography, selected feature and announcements are driven from application state. Meaningful research values remain available outside WebGL, and route/search context is carried into the map rather than reconstructed independently.

That is an important design choice for Section 508/WCAG work: accessibility is not an overlay added to a visualization after the fact. The semantic representation and the rendered map consume the same application state.

See [`documentation/mapping-visualization.md`](mapping-visualization.md) and the map state/e2e tests for the detailed equivalence rules.

## Evidence UI: claims are part of the frontend contract

The Evidence route demonstrates a less common frontend responsibility: presenting engineering claims without broadening them.

The search-performance surface keeps historical C2 evidence separate from adversarial C2.1 validation. C2.1 exposes the retained workload cells, realized hit counts, paired batch-level API inference and scoped claim guardrail. The browser does not parse research artifacts directly; the repository API validates them and returns a stable evidence model.

The UI therefore has to communicate both data **and epistemic boundaries**:

- API elapsed and engine-native timing are distinct;
- descriptive request samples and batch-level inference are distinct;
- historical C2 and C2.1 are distinct evidence layers;
- local standalone Docker evidence is not a universal Solr/OpenSearch verdict;
- automated accessibility evidence is not manual assistive-technology certification.

This is why dense-table semantics, headings, explanatory copy and status language are treated as product behavior.

## Search Lab: diagnostics without engine coupling

Search Lab lets a reviewer run the same scenario against Solr and OpenSearch, inspect parity, facets/results and timing, and see partial-engine errors without hiding the surviving result.

The component consumes one typed comparison response. Solr query parameters, OpenSearch DSL, credentials, projection validation and engine availability stay in Spring. That means the frontend can compare engines without becoming coupled to either engine's HTTP API.

The UI also labels local timing as diagnostic. Production search-engine selection requires topology, cost, availability, storage, migration and operational evidence beyond a browser request timer.

## Accessibility and resilient UI states

Accessibility is developed through multiple evidence layers rather than one axe score:

- semantic Angular templates and linting;
- unit/component tests for loading, empty, restricted and failure states;
- Storybook interaction + axe evidence;
- Playwright real-browser checks for navigation, names, tables, live regions, reflow, zoom, contrast and forced colors;
- map-equivalence tests;
- explicit manual keyboard/NVDA/JAWS checklists that are not converted into automated passes.

The primary route templates use status/alert semantics and explanatory failure copy so service degradation remains understandable without requiring console access.

## Performance-aware rendering choices

The million-record corpus is deliberately **not** sent to Angular. Search and evidence APIs remain bounded, and Discovery renders one page of results at a time.

Important frontend choices include:

- route-level lazy loading;
- bounded result pages and server-provided facets;
- stable `track` identities in result/facet loops;
- no client-side million-record filtering or sorting;
- URL state that identifies a query rather than serializing results;
- evidence tables built from report summaries/cells rather than raw request-sample artifacts;
- map data requested by bounded geography/layer contracts instead of treating the browser as a GIS data warehouse.

The certified C2/C2.1 work validates that this frontend architecture is operating over a real 1,000,181-document projection. The scale research supports the product story; it is not the product itself.

## Testing strategy

The repository intentionally separates deterministic CI from heavyweight research evidence.

For the frontend, normal PR gates include unit tests, lint/build, generated-contract checks, Storybook/axe, deterministic Playwright scenarios and live Solr/OpenSearch browser smoke coverage. Heavy million-record measurement remains explicit research evidence rather than making every pull request reconstruct a 1M corpus.

This split provides fast regression feedback without pretending a small CI fixture is the same thing as a certified scale experiment.

## What the frontend intentionally does not know

The Angular application does not know:

- DSpace database or internal Solr schemas;
- Solr eDisMax syntax;
- OpenSearch Query DSL;
- search-engine credentials or node topology;
- federation harvester cursors/checkpoint implementation;
- projection rebuild implementation details;
- Java persistence entities.

It knows the generated application contract: research objects, discovery state, map/evidence models, operator actions and clearly typed provenance/status information.

That boundary is the central frontend architecture decision in this project.

## Portfolio interpretation

For a frontend-heavy federal engineering role, the strongest story is not “I benchmarked Solr against OpenSearch.” It is:

> I built an Angular/NgRx public research experience that keeps discovery state reproducible, provenance visible, maps accessible through equivalent semantic data, backend integration behind generated contracts, and engineering evidence reviewable. I then validated that architecture against a certified million-record search corpus and an adversarial Solr/OpenSearch experiment.

The research depth remains available for architecture discussion, but the browser application demonstrates the day-to-day frontend engineering ownership.
