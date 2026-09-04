# Final Frontend Polish Audit

Issue: #51 — Final frontend mission alignment and portfolio polish

This audit reviews the portfolio-critical browser routes after the C2/C2.1 research work. The goal is not to redesign a mature application for cosmetic churn. Changes are justified only when they improve frontend ownership, user comprehension, accessibility, provenance, or demo quality.

## Audit principles

The final product story should make these boundaries obvious:

```text
Angular / NgRx / RxJS / MapLibre
        |
        | generated typed REST contract
        v
Spring repository API
        |
        +--> DSpace
        +--> application PostgreSQL
        +--> Solr / OpenSearch
```

The browser owns interaction state, workflows, presentation, accessibility and visualization. Search/repository implementation details remain server-side.

The certified million-record and C2.1 work validates this experience at meaningful scale; it should not dominate the first impression of the product.

## `/` landing page

### Findings

The landing page already had a strong product hierarchy and three clear public paths, but the hero capability strip emphasized repository/search infrastructure (`DSpace authority`, `Federated metadata`, `Solr + OpenSearch`) before it named the Angular engineering that owns the browser experience.

The C2 scale card was valuable, but its wording made the corpus sound like the product rather than validation underneath the product.

### Change

Updated in #51:

- hero introduction now names Angular 22 + NgRx/RxJS, accessible MapLibre and the generated API contract;
- capability strip now leads with Angular/NgRx, generated OpenAPI, accessible MapLibre and WCAG/Section 508 evidence;
- C2 card is explicitly labelled **Scale validation**;
- architecture copy states that the browser owns the experience while integrations remain behind Spring;
- technology strip now includes NgRx + RxJS.

### Status

**Polished.** No layout redesign required.

## `/discovery`

### Findings

Discovery already demonstrates the frontend architecture well:

- query/filter/page state round-trips through Angular Router parameters;
- NgRx selectors own results, facets, loading/error state, pagination and corpus identity;
- publisher/program/source facets are data-driven rather than hard-coded to one repository taxonomy;
- filter changes reset paging while initial deep links preserve the requested page;
- paging restores focus to the replaced results heading;
- result provenance, source system, access level and authoritative source remain visible;
- fixture fallback is explicitly labelled;
- the effective search criteria can be carried into Maps.

The page renders bounded result pages and server-provided facets rather than attempting client-side million-record processing.

### Status

**No code change required.** A redesign would add risk without improving the portfolio story.

## `/research/:id`

### Findings

The detail route already presents authority correctly:

- federated records state that publisher metadata remains authoritative;
- authoritative-source links are available near the object context;
- curated records can expose repository files, relationships and versions;
- federated records do not fabricate locally preserved files/versions;
- access/reuse/citation/DOI/provenance are visible as user-facing metadata;
- loading, fixture and error states are explicit.

The Angular route consumes one authority-neutral detail contract rather than containing DSpace-specific lookup logic.

### Status

**No code change required.** Current behavior supports the frontend-first case study directly.

## `/maps`

### Findings

Maps is already organized around a research question rather than around the mapping library when the user arrives through the workforce workflow. Layer controls are grouped by understandable categories, methodology is available on demand, and the semantic table/list remains the accessibility path for meaningful values.

The route uses shared application state for geography, layers, selection and nonvisual equivalents rather than treating the MapLibre canvas as a separate application.

One small presentation seam remains in the generic/non-workforce heading: `MapLibre geospatial workspace` names the implementation library rather than the user's task.

### Recommended narrow change

Use a product-facing generic heading such as **Geospatial research explorer** while retaining MapLibre attribution/implementation detail elsewhere.

### Status

**Implemented in #51; no layout redesign required.**

## `/evidence`

### Findings

Evidence has matured into a real product surface:

- automated accessibility and manual AT status are separated;
- dense tables have captions/headers and explanatory copy;
- pipeline metrics distinguish subscribed, mirrored, curated and indexed concepts;
- Search comparison keeps live operational parity, historical C2 and adversarial C2.1 evidence distinct;
- C2.1 exposes scoped batch-level evidence instead of only a winner headline;
- scientific claim boundaries remain visible.

Two data-pipeline sentences still describe the discovery projection as Solr-only and DSpace-only. That wording predates the mixed curated + federated projection and dual-engine research work.

### Recommended narrow change

Update pipeline copy to describe a rebuildable **mixed-origin discovery projection** built from curated DSpace content plus retained federated metadata. Do not imply that the primary pipeline metric is a live C2 benchmark.

### Status

**Implemented in #51; otherwise polished.**

## `/search-lab`

### Findings

Search Lab already does several important things correctly:

- parity evidence appears before engine differences;
- API elapsed and engine-native timing are explicitly distinguished;
- vendor timing definitions are not treated as directly interchangeable;
- partial-engine states remain present rather than hiding the surviving result;
- scenario/search/filter controls use one typed application comparison contract.

The introductory sentence says both projections are “built from DSpace.” That is stale for the current mixed C2/C2.1 corpus, which includes retained Data.gov and DOE OSTI metadata alongside curated DSpace objects.

### Recommended narrow change

Say that the same normalized request is run against two **application-owned mixed-origin discovery projections**, and make the frontend boundary explicit: Angular consumes one comparison contract while engine-specific queries remain behind Spring.

### Status

**Implemented in #51; no structural change required.**

## Responsive, reflow and dense-data assessment

Existing Browser Evidence covers the machine-checkable side of responsive/reflow behavior, and the final UI keeps large datasets server-bounded rather than pushing corpus-scale work into the browser.

The portfolio-critical dense surfaces are Evidence and Search Lab. Their current hierarchy uses:

- headings before dense data;
- explanatory text before timing/statistical interpretation;
- semantic tables/lists rather than visual-only comparison;
- explicit status/error messaging;
- bounded workload/result blocks.

No virtualized mega-table or client-side data-grid rewrite is justified for the current use cases.

## Accessibility assessment

Automated accessibility evidence remains separate from manual keyboard/NVDA/JAWS verification. #51 does not convert the unperformed #49 human evidence into a pass.

The final frontend story should therefore say **WCAG/Section 508-oriented engineering evidence**, not “Section 508 certified.”

## Changes justified by this audit

1. Frontend-first landing copy — implemented.
2. Product-facing generic Maps heading — implemented.
3. Mixed-origin Evidence pipeline wording — implemented.
4. Mixed-origin/frontend-boundary Search Lab introduction — implemented.
5. Frontend-first README/case study/demo narrative — implemented in this slice.

Everything else should remain stable unless tests or Browser Evidence reveal an actual regression.

## Exit interpretation

The three narrow copy corrections are applied, and the primary routes meet the #51 presentation goal without an unnecessary redesign. Normal quality and Browser Evidence remain the merge gates. The remaining manual AT work belongs to #49 and does not block the repository from accurately presenting the automated accessibility engineering already completed.
