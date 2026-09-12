# ADR-002: Mobile Search Interaction and Shared Evidence Model

Status: accepted

Date: 2026-09-12

## Context

The repository now has two Angular frontends over the same typed Spring/OpenAPI boundary:

- `apps/discovery-ui` — broader desktop-oriented discovery/research experience;
- `apps/census-mobile-frontend` — focused mobile-first Census/Civics discovery experience.

Both applications must communicate the same search facts without being forced into the same page composition.

The mobile experience has several design constraints that differ from the desktop shell:

- the supported baseline begins at 320px;
- a persistent facet sidebar consumes too much narrow-screen space;
- touch/keyboard controls need generous interaction areas;
- refined searches should remain shareable/reproducible in the URL;
- rank, match strength and field-match evidence need enough explanation to avoid being mistaken for probabilities;
- forced-colors and keyboard operation must preserve meaning without relying on custom color or pointer interaction;
- genuine cross-frontend semantics should be shared without moving application state/routing into a component library.

## Decision

### Keep application composition distinct

The two frontends may use different layouts when their information architecture requires it.

- `discovery-ui` may keep a persistent larger-screen facet layout.
- `census-mobile-frontend` uses a modal filter drawer so results remain the primary narrow-screen reading surface.

Shared semantics do not require identical shells.

### Treat the URL as part of mobile search state

Meaningful search intent and supported filters are reflected in query parameters so a refined result set can be refreshed, bookmarked or shared.

The URL is an external reproducibility boundary, not an alternate owner of search results. NgRx/RxJS remains responsible for asynchronous/shared search workflow state.

### Keep ranking evidence server-owned

Angular does not invent or recalculate result relevance.

The API owns:

- returned result order;
- relevance band/normalized evidence;
- relevance-model metadata/calibration state;
- typed matched-field/term evidence.

The browser presents those facts with caveats appropriate to their meaning.

### Separate ordinal rank from match strength

`Rank 1` means first in the current server-returned ordering.

`Strong match` means strong query-relative search evidence under the current API model.

Neither means `100% relevant`, confidence, probability or scientific importance.

### Use a dialog for verbose result explanation

`Why this matched` is a modal dialog rather than a tooltip or permanently expanded result-card block.

The explanation can include:

- query;
- active filters;
- ordinal rank;
- query-relative match strength;
- engine/normalization/calibration metadata;
- matched fields and terms;
- explicit caveats about what the evidence does not prove.

A dialog provides a stable reading/focus surface for content that is too substantial for a tooltip.

### Share semantics through `shared-ui`

Cross-frontend presentational rules are promoted to the existing `shared-ui` library only after actual reuse is demonstrated.

Shared components currently own:

- rank presentation;
- relevance/match-strength presentation;
- result explainability presentation.

They do not own NgRx state, routing, HTTP calls, URL adaptation, mobile filtering or desktop facet composition.

### Use content-driven responsive expansion

The mobile shell starts from the narrow stacked layout and expands at content-driven breakpoints:

- `40rem` for horizontal search/result/pagination composition and more drawer spacing;
- `48rem` for expanded page/footer composition.

Automated browser evidence covers 320, 390, 430 and 768px viewport widths.

### Preserve meaning in forced colors

Text carries rank and relevance semantics. Explicit forced-colors borders preserve control/state boundaries when custom colors are replaced by the operating system.

Selected/important state must not depend on hue alone.

### Keep design evidence in the repository

The durable design lifecycle is:

```text
intent/wireframe -> annotated decision -> Storybook states -> Angular implementation -> automated evidence
```

Figma may be used as an optional collaboration tool, but no design-tool SDK/artifact is required by production or CI.

## Consequences

Positive:

- mobile layout can optimize for narrow-screen reading without weakening desktop discovery;
- both frontends use consistent search-evidence language;
- ranking meaning stays aligned with the backend contract;
- shareable searches are reproducible without duplicating server result ownership;
- accessibility-related interaction behavior is designed into the workflow rather than patched onto final visuals;
- `shared-ui` remains a small semantic/presentational boundary instead of becoming an application framework;
- design intent and production evidence remain reviewable together in Git.

Tradeoffs:

- two frontend shells intentionally retain some different composition code;
- app adapters must translate their own filter/search context into the shared explanation component;
- modal filters add focus-management responsibilities on mobile;
- Storybook and E2E evidence must be maintained when shared search semantics change;
- keeping evidence language precise may be more verbose than a simple numeric relevance score.

## Alternatives considered

### Make both frontends use one identical search page

Rejected. Shared search meaning does not justify forcing a narrow-screen drawer or a desktop facet sidebar into the wrong context.

### Put all search-result UI into one large shared component

Rejected. That would couple routing, state and application-specific composition across two products. Only demonstrated semantic/presentational reuse belongs in `shared-ui`.

### Show normalized relevance as a percentage

Rejected. The current model is query-relative search evidence and is not a calibrated probability. Percentage styling would invite an unsupported interpretation.

### Use raw Solr/OpenSearch explain output in the dialog

Rejected. Engine-specific diagnostic trees are unstable implementation details and are not a suitable general-user browser contract. If richer ranking factors are needed, the application API should expose a stable typed model.

### Keep filters inline on mobile

Rejected for the current hierarchy. A persistent facet area would push result content below the fold and turn the focused mobile journey into a compressed desktop layout.

### Make Figma the authoritative specification

Rejected. Figma can improve collaborative visual review but must not be required to build, test or understand the repository. Source-controlled documentation, Storybook and production tests remain durable evidence.

## Evidence

Design case study:

- `mobile-first/documentation/design/mobile-search-design-lifecycle.md`

Production evidence includes:

- `apps/census-mobile-frontend/src/app/app.*`;
- `apps/census-mobile-frontend/src/app/components/mobile-search-filters/*`;
- `apps/census-mobile-frontend/src/app/components/search-summary/*`;
- `libs/shared/ui/src/lib/search-rank-badge/*`;
- `libs/shared/ui/src/lib/search-relevance-badge/*`;
- `libs/shared/ui/src/lib/search-explainability-dialog/*`.

Automated assembled evidence includes:

- `apps/census-mobile-frontend-e2e/src/mobile-evidence.spec.ts`;
- `apps/census-mobile-frontend-e2e/src/search-relevance.spec.ts`;
- `apps/discovery-ui-e2e/src/discovery-search-ranking.spec.ts`;
- Storybook interaction/axe CI;
- repository formatting/lint/unit/build gates.

## Accessibility evidence boundary

This ADR describes interaction design and automated engineering evidence only.

Issue #49 is closed **not planned**. No decision in this ADR should be read as completed manual screen-reader testing, Trusted Tester execution, Section 508 certification or complete conformance.

## Revisit conditions

Revisit this decision if:

- a mature shared design system makes more shell-level cross-app reuse genuinely cheaper;
- user research demonstrates that the modal filter workflow is ineffective;
- the search API adopts a calibrated relevance/probability model with different product-language requirements;
- a future ranking-factor contract can expose more detailed stable evidence;
- the mobile frontend and desktop frontend converge into one product shell for a concrete maintenance reason rather than aesthetic uniformity.
