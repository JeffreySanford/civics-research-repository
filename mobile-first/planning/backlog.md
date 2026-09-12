# Mobile-First Census Frontend Backlog

Status: implemented mobile geospatial baseline; Open Science alignment continuation active

## Delivered baseline

The original PR1–PR7 planning sequence is complete and has been superseded by the implemented stack on `main`.

Delivered capabilities now include:

- `apps/census-mobile-frontend` on port `4300` beside `apps/discovery-ui` on `4200`;
- generated repository API client reuse with no duplicate backend/search contract;
- NgRx/RxJS search and research-detail state;
- local Signals for appropriate synchronous presentation state;
- shareable query/filter URL intent and accessible mobile filtering;
- scalable cursor traversal, global rank and server-owned relevance evidence;
- query-wide result-type summary and typed field/term match evidence;
- mobile research detail with return-to-search/focus behavior;
- typed research-package relationships and related-research traversal;
- shared rank/relevance presentation across both Angular frontends;
- shared `Why this matched` explainability across both Angular frontends (#97 / PR #103);
- one documented mobile search design lifecycle from wireframe through Storybook, production implementation and automated evidence (#98 / PR #104);
- read-only repository steward/status surface (#99 / PR #105);
- compact mobile Research Coverage preview plus lazy interactive `/research-map` route over the bounded spatial sidecar (#106 / PR #107);
- mobile Census-area context/presets using truthful orientation extents rather than claiming exact TIGER/Line geometry (#108 / PR #109);
- synchronized MapLibre research selection, keyboard-operable semantic-list selection, and selected-research detail over one local selected-source state (#110 / PR #111);
- the first real data-bearing `Community · Population growth` context using Census Population Estimates plus authoritative county geometry, provenance, semantic county values, and non-WebGL equivalents (#112 / PR #113);
- Storybook/component evidence and Playwright/axe responsive coverage across representative phone/tablet widths;
- full-stack startup integration.

Historical PR1/scaffold documents remain implementation history, not open tasks.

## #108 — Mobile Census area context and map presets — delivered

Delivered in PR #109:

- [x] Keep the compact search-result preview free of extra Census-area requests and controls.
- [x] Add a compact expanded-map preset control with `Research` as the default.
- [x] Load existing `GET /maps/census-areas` summaries only for the expanded map.
- [x] Allow explicit Census area selection independently of repository search filters.
- [x] Use an exact search-geography match as initial map context when one exists, without weakening or rewriting the search query.
- [x] Render the selected area as a dashed orientation extent and fit the map to it.
- [x] State explicitly that the rectangle is not exact TIGER/Line administrative geometry.
- [x] Keep Research Coverage visible and preserve bounded viewport refresh/semantic evidence.
- [x] Add unit and focused 320px Playwright/axe coverage for preset selection, query preservation, reflow and forced-colors behavior.
- [x] Complete repository validation and merge the #108 implementation PR.

## #110 — Synchronize mobile map feature selection with research list — delivered

Delivered in PR #111:

- [x] Own selection with one local `selectedSourceIdentifier` Signal.
- [x] Let pointer clicks on mapped research polygons/points select the corresponding publisher-supplied record.
- [x] Let keyboard-operable semantic-list buttons select the same record with explicit `aria-pressed` state.
- [x] Render the selected record in a compact labelled detail region below the map.
- [x] Provide the authoritative-source link when the selected feature supplies one.
- [x] Use MapLibre feature-state to emphasize selected polygons/points with size/weight/opacity changes rather than color alone.
- [x] Preserve search/filter URL intent; map selection is local presentation state, not a repository search filter.
- [x] Reconcile bounded viewport refreshes by retaining selection only while the selected source identifier remains in the returned feature set.
- [x] Keep the semantic list/detail path usable when WebGL is unavailable.
- [x] Add unit coverage for list/detail synchronization and clear-on-refresh behavior.
- [x] Add focused 320px Playwright evidence proving semantic-list selection, real MapLibre pointer selection, query preservation, reflow and axe checks.
- [x] Complete repository-wide validation, including the stabilized cross-browser accessible-name harness and required MapLibre regression, and merge PR #111.

The PR exposed an existing desktop E2E reliability problem: the accessible-name loop recomputed the complete interactive-control locator count for every iteration. The fix computed that stable count once while preserving the assertion, application behavior, and timeouts. That is the preferred CI-reliability pattern: remove redundant harness work rather than weakening evidence.

## #112 — Community population context — delivered

Delivered in PR #113:

- [x] Add `Community · Population growth` to the expanded mobile research map.
- [x] Reuse the existing Population Estimates contract rather than add a duplicate client-side data path.
- [x] Default to annual population growth 2024–2025 from Vintage 2025 source data.
- [x] Use authoritative Census county geometry and join values by stable geography identity.
- [x] Keep Research Coverage above the contextual layer.
- [x] Keep the explicit Census-area selector and repository search URL intent independent.
- [x] Provide textual county values and scale meaning so the layer remains useful without color/WebGL.
- [x] Surface source/vintage and geometry provenance.
- [x] Preserve selected-research map/list/detail synchronization.
- [x] Complete focused mobile evidence and full repository gates.

This is the point where the mobile map has demonstrated the intended federal geospatial skill. More thematic presets are now secondary to the Open Science alignment work below.

## Active continuation — Open Science interoperability and reproducibility

The canonical plan is [Open Census Alignment Roadmap](../../documentation/open-census-alignment-roadmap.md).

The ordered implementation sequence is:

1. **#114 — Make artifact version identity and provenance authoritative — current**
   - remove synthetic prior-version generation from `vintageYear`;
   - represent observed version/release/PID/source/fixity/capture facts;
   - preserve unknown history as unknown;
   - carry the model through repository/API/UI boundaries without turning the search index into the authority.

2. **#115 — Define Open Census metadata profile and structured exports — next**
   - keep the `crr.*` authority model;
   - document a DSpace/Dublin Core + DataCite 4.7 + Schema.org JSON-LD + dataset-scoped DCAT-US 3.0 crosswalk;
   - add Cite/Export behavior from normalized metadata;
   - structure legitimate restricted-use access guidance without simulating authorization.

3. **#116 — Expose a reproducibility trail across related research artifacts**
   - build on asserted Research Package edges;
   - keep heuristic `relatedResearch` separate;
   - expose publication/data/methodology/code/supporting-material lineage with PID/version/access/provenance semantics;
   - keep semantic HTML authoritative rather than requiring a graph database or canvas visualization.

4. **#117 — Add Open Science metadata-quality findings to Steward**
   - deterministic rule IDs, severity, evidence, and remediation;
   - missing/malformed identity/citation/access/version/relation checks;
   - no opaque quality percentage and no browser-side auto-repair.

5. **#118 — Integrate a real Census CODE object and replication package**
   - use a real Census public research-code source rather than fabricate one;
   - selected candidate: `uscensusbureau/recon_replication`;
   - prove CODE through source → sync/DSpace → API → search → Angular;
   - preserve public/restricted dependency semantics and do not invent license/DOI/authorship facts.

6. **#119 — Make analytical and map context shareably reproducible**
   - promote PR #113 provenance into typed, reconstructable analytical state;
   - preserve research query separately from geography/measure/data vintage/geometry vintage/source evidence;
   - no new thematic layer is required.

## Why the map roadmap is no longer primary

The previously listed map sequence—more Community layers, Workforce layers, Environment layers—is still technically viable, but it is no longer the strongest alignment path.

The current mobile map already demonstrates:

- MapLibre integration;
- responsive map UX;
- authoritative geometry;
- a real Census contextual measure;
- provenance and vintage labeling;
- semantic/non-WebGL equivalents;
- keyboard-accessible research selection;
- search/map state separation;
- cross-browser regression evidence.

Adding five more visual layers mostly proves the same capability again. The larger repository gap is now metadata → identity → versioning → provenance → reproducibility → stewardship.

## Deferred / optional work

The following remain optional and should be promoted only when a concrete product/role question justifies them:

- additional map layers from repository issue #69, including SAIPE/CBP/LODES/USGS context;
- NASA CMR/PubMed/OpenAlex federation breadth after durable identity rules;
- vector/hybrid search experiments;
- local Kubernetes/search clustering;
- AWS/IaC deployment work;
- graph-database experiments;
- generative-AI features;
- another frontend;
- another scale milestone.

The existence of a technology is not a reason to add it.

## Two frontend roles

The two Angular frontends should increasingly demonstrate progressive disclosure for different users rather than feature duplication:

- `discovery-ui`: denser research/power-user evidence, stewardship, structured metadata, richer provenance;
- `census-mobile-frontend`: concise search/research flow, explainability, progressive disclosure, and small-screen reproducibility/access context.

They remain two experiences over one typed application and repository authority model.

## Accessibility boundary

Issue #49 is closed **not planned**. Existing manual accessibility/usability protocols remain reference templates only.

Continue automated keyboard/focus/reflow/forced-colors/axe evidence where it directly supports implementation quality, but do not label it as completed manual Section 508, Trusted Tester, NVDA, JAWS or VoiceOver validation.

The same truth boundary applies to future Open Science work: machine-readable metadata does not replace a human-readable accessible experience, and a visual reproducibility diagram must never be the only representation of research relationships.