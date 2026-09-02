# Repository test strategy

This repository treats test coverage as **layered behavioral evidence**, not as a single line-coverage percentage. A change is adequately covered when its important success, failure, accessibility, integration, and operator paths are exercised at the cheapest deterministic layer that can prove them.

A high line percentage does not replace browser, database, search-engine, accessibility, or operator-workflow evidence. Conversely, E2E tests should not carry deterministic logic that can be proved faster and more precisely in unit tests.

## Required layers

### 1. Unit and pure-contract tests

Use unit tests for deterministic logic, parsers, reducers, selectors, adapters, serializers, validators, request builders, CLI argument handling, and error semantics.

Requirements:

- every new branch or failure mode in a pure function has a focused test;
- filesystem or JSON-loading helpers are tested through real temporary files when file I/O is part of the operator contract;
- NgRx reducers/selectors/effects cover success, failure, cancellation/stale-response, and state-reconciliation behavior where applicable;
- API client adapters verify request and response semantics without requiring a browser;
- Java services/controllers use JUnit for deterministic service and HTTP-contract behavior;
- a regression discovered locally or in review should become a permanent automated test when it can recur.

The research/performance Node harness is part of this layer. It must remain deterministic and must not mutate certified corpus/search state unless a command explicitly documents mutation.

### 2. Angular component tests

Angular component tests prove rendered states, component inputs/outputs, focus/status behavior, and accessibility semantics that do not require a full routed browser workflow.

Requirements:

- reusable or stateful components receive component tests for meaningful states;
- accessibility-sensitive components include axe or equivalent component-level checks when practical;
- loading, empty, success, error, unsupported-capability, and stale states are covered when the component exposes them;
- large page components should move reusable presentation behavior into smaller components rather than relying exclusively on E2E tests.

### 3. Storybook accessibility and component isolation

Storybook is a **required WCAG/Section 508 test layer**, not merely a visual component catalog. It is also distinct from the existing Playwright `@storyboard` tag.

Every accessibility-relevant reusable component or bounded page fragment should have stories that represent the states a user can actually encounter. Those stories become executable accessibility fixtures: they expose deterministic rendered DOM for axe/WCAG checks, interaction tests, keyboard/focus verification, visual inspection, and manual assistive-technology review without depending on a live backend.

Storybook must use the official accessibility addon and fail CI on automated accessibility violations for covered stories. Configure the project to test against the repository's target WCAG ruleset, including WCAG 2.2 AA where supported. Automated axe checks remain a first-line test and do not replace manual screen-reader, zoom/reflow, keyboard, reduced-motion, forced-colors, or browser evidence.

Required story states should include, as applicable:

- normal/default and realistic populated content;
- loading, empty, no-results, and error states;
- boundary/extreme values and long-text/reflow cases;
- supported vs unsupported capability states;
- expanded/collapsed and enabled/disabled controls;
- focus-visible and keyboard-operable states;
- validation, status, warning, and error announcements;
- high-contrast/forced-colors and reduced-motion behavior where the component owns those semantics;
- semantic alternatives for visual data, including legends, summaries, tables, and map-equivalent content.

Stories that contain interaction behavior should use Storybook interaction tests. Accessibility checks should run against the post-interaction state where that state changes labels, focus, expanded/collapsed semantics, validation, or live-region output.

For Maps, Storybook coverage is **not optional** just because MapLibre itself remains an integration concern. Extract and story the accessibility-critical presentation surfaces: layer-category disclosures, layer toggles and info affordances, capability-dependent counts, legends, loading/error/status messaging, Research Coverage summaries, and the semantic table/list equivalent of mapped values. MapLibre style registration, geography synchronization, API/NgRx wiring, viewport behavior, and map-versus-semantic equivalence remain Playwright/integration responsibilities.

For administrative visualizations, story the charts/counters/pipeline components together with their textual/semantic equivalents, not only the SVG or animated presentation.

### 4. Playwright E2E and accessibility evidence

Use Playwright for behavior that crosses routing, URL state, API requests, NgRx, browser semantics, MapLibre, focus management, or multiple components.

The required pull-request browser evidence includes:

- `@comparison` search-engine comparison behavior;
- `@wcag` accessibility evidence;
- `@section508` Section 508 evidence;
- `@maps` map controls, geography synchronization, MapLibre visibility, and capability regressions.

Chromium, Firefox, and WebKit remain the deterministic cross-browser targets. WebGL-specific assertions may use a dedicated stable subset when a browser engine cannot provide deterministic global style readiness; the accessible semantic equivalent must still be cross-browser tested.

Storybook and Playwright are complementary. Storybook proves isolated accessible states comprehensively; Playwright proves those states remain correct when composed into routed workflows, synchronized with application state, and exercised in real browsers.

### 5. Manual Section 508/WCAG evidence

Automated axe/Storybook/Playwright checks cannot certify the complete accessibility requirement set. Accessibility-critical stories should also act as stable fixtures for manual evidence where appropriate, including:

- keyboard-only navigation and visible focus;
- screen-reader name/role/value and announcements;
- 200%/400% zoom and reflow;
- reduced motion;
- forced colors/high contrast;
- touch target and pointer alternatives;
- content presented visually in charts/maps having a usable semantic equivalent.

When a component has a Storybook story for one of these states, manual evidence should reference that stable story/state rather than relying only on an ad hoc application route.

### 6. Live-stack integration evidence

Use the real Compose stack when a mock cannot prove the behavior, including:

- Solr/OpenSearch parity and projection identity;
- PostgreSQL-specific SQL;
- container/runtime startup contracts;
- search performance diagnostics;
- publisher/source integration where deterministic fixture tests are insufficient.

Do not replace real-stack evidence with H2 when the production SQL dialect is the behavior under test.

### 7. Java coverage

JUnit is the primary Java behavior layer. Add JaCoCo measurement/verification separately so backend coverage is visible and regressions can be ratcheted without weakening service/integration tests.

PostgreSQL-native statements such as `INSERT ... ON CONFLICT` require a PostgreSQL-backed integration test (for example, the existing Compose topology or a bounded Testcontainers test); H2 cannot certify that syntax.

## Coverage measurement and thresholds

Coverage percentages are a guardrail, not the definition of completeness.

Policy:

1. capture the current frontend and Java baselines before introducing numeric thresholds;
2. publish statements, branches, functions/methods, and lines/instructions where the tool supports them;
3. set thresholds at or slightly below the measured baseline so the first gate is truthful;
4. ratchet thresholds upward as uncovered code receives tests;
5. require stronger branch/failure-path coverage for new or materially changed code even if the repository-wide percentage is already above threshold;
6. do not exclude difficult production code merely to improve the percentage.

A literal 100% repository-wide line target is not required. The goal is full **risk and behavior coverage** across the layers above, with measurable coverage that cannot silently regress.

## Pull-request expectations

For each PR, reviewers should be able to answer:

- What behavior changed?
- What is the cheapest deterministic test that proves it?
- What failure/regression path is covered?
- Does the change alter an operator/file/CLI contract?
- Does it introduce or materially change an accessibility-relevant UI state that needs a Storybook story?
- Does the story exercise the relevant loading/error/capability/focus/semantic-equivalent states and run automated a11y checks?
- Does it cross routing/API/NgRx/browser/MapLibre boundaries and therefore need E2E?
- Does it depend on PostgreSQL, Solr, OpenSearch, Docker, or publisher behavior that mocks cannot certify?
- Are accessibility semantics covered at Storybook/component, browser, and manual layers where required?
- Did measured coverage stay at or above the configured baseline?

A review comment that identifies a real missing test should normally be closed by adding the regression test rather than by documenting why the untested code is assumed to work.

## Current audit findings — 2026-09-02

The initial repository-wide scan found:

- strong existing Angular/NgRx, Node research-harness, Java/JUnit, Playwright, axe, WCAG, and Section 508 testing;
- dedicated Research Coverage E2E evidence that preserves Discovery criteria and verifies semantic/map count equivalence;
- multiple `@maps` suites already present, but they were not included in the required PR Browser Evidence grep;
- V8 coverage providers configured for multiple libraries, but no required repository coverage command/threshold gate;
- no Storybook dependencies, configuration, or actual `*.stories.*` files yet; the existing `storyboard` target is a Playwright tag and is not Storybook;
- therefore no deterministic story-level WCAG/Section 508 accessibility gate exists yet, which is a material gap rather than a cosmetic tooling omission;
- no JaCoCo plugin/verification gate on the Java service;
- a known PostgreSQL-native SQL path that H2 cannot exercise.

This workstream should close those gaps incrementally without turning existing E2E tests into a substitute for unit/component/Storybook accessibility coverage or inventing unmeasured percentage thresholds.
