# Mobile Search Design Lifecycle Case Study

Status: implemented design/engineering evidence

Date: 2026-09-12

Tracking: issue #98

## Purpose

This case study records one representative mobile-first discovery slice from design intent through production implementation and automated evidence. The goal is to make the design/engineering reasoning reviewable rather than presenting only finished code or screenshots.

The representative journey is:

```text
Search intent
    |
    v
Search results + query-wide summary
    |
    +--> Filters --> shareable URL/search state
    |
    +--> Rank + match-strength evidence
    |       |
    |       v
    |   Why this matched
    |
    v
Research object detail
```

This is a design-lifecycle record, not a human usability-study result and not manual assistive-technology evidence. Issue #49 is closed **not planned**. Automated Storybook, Playwright and axe evidence must not be described as completed NVDA/JAWS/VoiceOver, Trusted Tester or complete Section 508 verification.

## Design question

How can a research repository expose powerful search and evidence on a 320px-first surface without turning the mobile experience into a compressed desktop page or hiding the context needed to understand a result?

The solution prioritizes:

1. the query and current search scope;
2. result count and query-wide context;
3. ordinal rank and query-relative match strength as distinct concepts;
4. the research title and essential metadata;
5. an explicit path to deeper match evidence;
6. an explicit path to the authoritative research-object detail;
7. filters that do not permanently consume narrow-screen space;
8. shareable URL state so a refined search is reproducible.

## Low-fidelity wireframes

The wireframes capture hierarchy and interaction intent. They are deliberately low fidelity; production styling belongs to the Angular implementation and design tokens.

### 320px search/results baseline

```text
+----------------------------------+
| CR  Census Research              |
+----------------------------------+
| Mobile-first discovery           |
| Find Census research without     |
| fighting the interface.          |
|                                  |
| Search the repository            |
| [ North Dakota migration       ] |
| [ Search                       ] |
|                                  |
| [ Filters (1) ]        12 results|
| [ Dataset  x ]                   |
+----------------------------------+
| RESULTS                          |
| 12 matching records              |
| Results for "North Dakota ..."  |
| Showing 1-10 | Page 1 of 2       |
|                                  |
| Result type mix                  |
| Dataset ............... 8        |
| Publication ........... 4        |
+----------------------------------+
| [Top ranked] [Strong match]      |
| Migration Flows for North Dakota |
| DATASET | Census Bureau          |
| Summary text wraps naturally...  |
|                                  |
| [ Why this matched ]             |
| [ View research object ]         |
+----------------------------------+
| [Previous]  Page 1  [Next]       |
+----------------------------------+
```

### Modal filter drawer

```text
+----------------------------------+
| page under modal backdrop        |
|      +---------------------------+
|      | Refine              [x]   |
|      | Filter results             |
|      |                            |
|      | TYPE                       |
|      | [ Dataset            8 ]   |
|      | [ Publication        4 ]   |
|      |                            |
|      | GEOGRAPHY                  |
|      | [ North Dakota      12 ]   |
|      |                            |
|      | [ Clear all filters ]      |
|      +---------------------------+
+----------------------------------+
```

The drawer becomes the full available width on narrow screens and is capped at `30rem` on wider mobile/tablet surfaces. It remains a modal workflow instead of turning into a persistent desktop-style sidebar because the mobile shell optimizes vertical reading and result inspection.

### Result explanation dialog

```text
+----------------------------------+
| Why this matched          [Close]|
| Migration Flows for North Dakota |
|                                  |
| Query                            |
| North Dakota migration           |
|                                  |
| Active filters                   |
| - Dataset                        |
|                                  |
| Result position                  |
| Rank 1 -- ordering, not %        |
|                                  |
| Match strength                   |
| Strong -- query-relative evidence|
|                                  |
| Search model                     |
| SOLR / normalization / caveat    |
|                                  |
| Matched fields                   |
| Title       migration            |
| Geography   North Dakota         |
+----------------------------------+
```

The explanation is a dialog rather than a tooltip because the content has multiple evidence sections and caveats. Both frontends use the same semantic explanation component while retaining their own search-state/routing orchestration.

## Information hierarchy

The mobile result page deliberately separates four kinds of information that are easy to conflate:

- **Search intent** — the submitted query and active filters.
- **Set context** — result count, page/range and query-wide result-type summary.
- **Ordering evidence** — ordinal rank in the returned result set.
- **Match evidence** — query-relative relevance band/model metadata and matched fields/terms.

A research object's title, metadata, summary and detail link remain the primary content. Search evidence explains why the object appears; it does not replace the research object or claim scientific relevance.

## Annotated component and interaction map

| Design responsibility | Production boundary | Why it lives there | Primary evidence |
| --- | --- | --- | --- |
| Mobile search shell, result ordering, result-card hierarchy and local presentation state | `apps/census-mobile-frontend/src/app/app.*` | Mobile-specific composition should not force the desktop application into the same visual shell | `app.spec.ts`; mobile E2E suites |
| Shareable query/filter intent | mobile NgRx search flow + `SearchRouteQueryAdapter` | Search state is asynchronous/shared and the URL is an externalized reproducibility boundary | URL/filter unit and browser tests |
| Modal filter workflow | `MobileSearchFiltersComponent` | Drawer interaction is mobile-shell behavior; server facet values remain authoritative | filter component tests; mobile Playwright focus/Escape checks |
| Query-wide result-type context | `SearchSummaryComponent` | Summary is reusable inside the mobile experience but derives from authoritative response facets | Storybook `QueryWideTypeMix`, `Mobile320`, `SingleType` |
| Ordinal rank semantics | `shared-ui/SearchRankBadgeComponent` | Both frontends need the same wording and non-color semantics | shared component tests; desktop/mobile browser tests |
| Query-relative match-strength semantics | `shared-ui/SearchRelevanceBadgeComponent` | Both frontends must avoid divergent percentage/confidence language | Strong/Good/Moderate/Weak/Low Storybook states; browser tests |
| Result explanation | `shared-ui/SearchExplainabilityDialogComponent` | The evidence contract is shared while app-specific query/filter adaptation stays outside `shared-ui` | Storybook strong/filtered/no-field-evidence/mobile states; component + browser/axe tests |
| Research-object detail | `MobileResearchDetailComponent` | Object navigation is part of the mobile journey but consumes the shared typed API | detail unit/E2E coverage |
| Search/relevance facts | `repository-api-client` generated types + Spring API | Rank/relevance/matched terms must remain server-owned rather than reconstructed in Angular | OpenAPI/generated-type checks + API tests |

## Responsive decisions

### Supported evidence matrix

The mobile browser evidence exercises:

- `320 x 800` — narrow supported baseline;
- `390 x 844` — common phone width;
- `430 x 932` — larger phone width;
- `768 x 1024` — tablet / expanded mobile layout.

At each width the Playwright suite verifies the assembled search/detail journey, no horizontal document overflow and axe results.

### Content-driven breakpoints

The mobile stylesheet uses two content-driven expansion points rather than device-name breakpoints:

- `40rem`: search controls can share a row; result heading and pagination gain horizontal composition; the filter drawer receives more padding.
- `48rem`: the page gets larger vertical spacing and the footer can use two columns.

Below `40rem`, controls stack by default. The design therefore starts from the narrow composition and adds layout only when content has room.

## Touch-target and spacing decision

Primary search, filter and pagination controls use `min-height: 3rem`. At a standard 16px root size that is approximately 48px. The research-detail link uses `min-height: 2.75rem`, approximately 44px at the same root size.

These dimensions are deliberate interaction affordances; they are not a claim that every possible rendered control/environment has been manually measured for conformance. Automated tests verify assembled behavior and reflow, while the manual protocol remains available only if future human verification is requested.

## Filter drawer decision

On the mobile frontend, filters are a modal task rather than a persistent column.

The implementation provides:

- `role="dialog"` and `aria-modal="true"`;
- a visible labelled heading and explanatory text;
- CDK focus trapping with auto-capture;
- Escape and explicit Close behavior;
- focus restoration to the invoking Filters button;
- immediate filter application through the real search flow;
- selected-state semantics through `aria-pressed`;
- active-filter chips outside the dialog;
- shareable URL synchronization;
- full-width behavior on narrow screens and a `30rem` cap at larger widths;
- contained scrolling/overscroll rather than document-level horizontal movement.

This differs appropriately from `discovery-ui`, where a persistent facet sidebar fits the larger-screen information architecture. The products share search semantics, not an artificially identical shell.

## Rank, match strength and explainability decision

The interface does not convert engine evidence into a probability.

- **Rank** is the ordinal server-returned position in the current result set.
- **Match strength** is bounded, query-relative search evidence exposed by the API.
- **Calibration metadata** tells the explanation surface whether the current model is calibrated.
- **Matched fields/terms** show where query evidence occurred but do not claim exact numerical contribution to final scoring.

The shared `Why this matched` dialog makes these distinctions inspectable without exposing raw Solr/OpenSearch explain trees as a browser contract.

This separation is also why the interface keeps explicit text such as `Rank 1`, `Strong match`, and the statement that match labels are not percentages. Color is supplementary.

## Forced-colors and non-color semantics

Forced-colors support is designed around preserving boundaries and words rather than preserving brand colors.

The mobile stylesheet adds explicit `CanvasText` borders for key controls/status surfaces in forced-colors mode. Selected filter options retain a thicker boundary. Browser evidence separately verifies that rank, match label and explanatory text remain available when custom colors collapse.

The design rule is:

> If removing color would remove the meaning, the state is not finished.

## Focus and keyboard decision

Keyboard/focus evidence is treated as part of interaction design, not a late accessibility overlay.

The automated journey covers:

- Skip-to-main as the first keyboard path;
- keyboard search submission;
- filter-dialog focus containment;
- Escape close and trigger-focus restoration;
- result-to-detail focus movement;
- explanation-dialog focus entry, explicit close, Escape/native modal behavior and trigger-focus restoration.

Automated focus behavior is engineering evidence only. It does not substitute for a manual screen-reader session.

## Storybook design states

Storybook is the durable isolated-state review surface.

### Result-type summary

Source: `apps/census-mobile-frontend/src/app/components/search-summary/search-summary.component.stories.ts`

- `QueryWideTypeMix`
- `Mobile320`
- `SingleType`

### Match strength

Source: `apps/census-mobile-frontend/src/app/components/search-relevance-badge/search-relevance-badge.component.stories.ts`

- `Strong`
- `Good`
- `Moderate`
- `Weak`
- `Low`
- `Mobile320Scale`

### Result explainability

Source: `apps/census-mobile-frontend/src/app/components/search-explainability-dialog.component.stories.ts`

- `StrongUncalibrated`
- `WithActiveFilters`
- `WeakWithoutFieldEvidence`
- `Mobile320`

These states make semantic edge cases reviewable independently from network/data setup while the assembled Playwright suites verify the real application composition.

## Evidence traceability

| Decision | Implementation | Automated evidence |
| --- | --- | --- |
| 320px-first/no horizontal overflow | mobile app SCSS + stacked default layout | `apps/census-mobile-frontend-e2e/src/mobile-evidence.spec.ts` viewport matrix |
| Search/filter state is shareable | route-query adapter + NgRx search state | mobile URL/filter unit tests and `search-relevance.spec.ts` |
| Filter drawer is modal and reversible | `MobileSearchFiltersComponent` | filter component tests + Escape/focus-return Playwright checks |
| Rank is ordinal | shared rank badge | shared unit tests + mobile/desktop ranking E2E |
| Match strength is not probability | shared relevance badge + API relevance model | Storybook scale + unit/browser assertions excluding percentage language |
| Explanation is inspectable and truthful | shared explainability dialog | component tests + open-dialog axe/focus assertions in both frontends |
| Color is not sole meaning | textual labels + forced-colors borders | forced-colors Playwright evidence |
| Search-to-detail remains usable across sizes | mobile app/detail components | 320/390/430/768 search/detail matrix |
| Shared semantics do not become shared app state | `shared-ui` presentation + app-specific orchestration | Angular architecture and tests in both apps |

## Shared maintenance boundary

Cross-frontend reuse is intentionally narrow.

`shared-ui` owns presentational semantics only when both applications have demonstrated the same need. It now owns rank, match-strength and explainability presentation. It does **not** own:

- NgRx search state;
- routing;
- query-parameter synchronization;
- mobile filter state;
- desktop facet layout;
- API calls;
- application-specific workflow orchestration.

This prevents a shared component library from becoming a second application framework while still eliminating duplicated search-language rules.

## Async-state decision

Search loading, errors and completed results are rendered as explicit states. The mobile shell keeps the submitted question visible while loading and uses status/alert semantics where appropriate.

The interface avoids treating a transient blank list as a valid empty result set. Pagination/filter actions flow through the existing search state/effects rather than mutating a locally owned copy of server results.

## Figma boundary

Figma can be used later as an optional collaboration/review surface when editable visual composition materially improves a design discussion. It is not required to understand, build, test or run this feature.

The durable source of truth remains:

1. repository decision/design documentation;
2. Storybook isolated states;
3. production Angular components;
4. automated browser/accessibility evidence.

No Figma SDK, generated artifact or design-tool package is a production/runtime dependency.

## Evidence boundary

This case study supports claims about documented design intent, implementation decisions and automated engineering evidence.

It does **not** establish:

- participant-tested usability findings;
- manual screen-reader verification;
- Trusted Tester completion;
- Section 508 certification;
- complete WCAG conformance;
- a claim that the mobile shell is universally preferable to the desktop shell.

The manual accessibility protocol remains available as a future test template. Issue #49 remains closed **not planned**, so manual execution is not part of the current backlog.

## Lifecycle summary

```text
Design question
    |
    v
Low-fidelity hierarchy/wireframe
    |
    v
Interaction/component decisions
    |
    +--> responsive/touch/focus/forced-colors rules
    +--> server-owned ranking evidence boundary
    +--> shared-vs-app-specific maintenance boundary
    |
    v
Storybook isolated states
    |
    v
Angular implementation
    |
    v
Unit + Playwright + axe + responsive/media evidence
    |
    v
Reviewable repository case study
```

This is the intended lifecycle for future frontend work: document the question and evidence boundary, make the interaction decision explicit, implement it through the correct ownership seam, and prove the assembled behavior before broadening the feature surface.
