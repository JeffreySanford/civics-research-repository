# Map Layer Categories

## Purpose

The Maps workspace has grown from a small demo into a multi-source research surface. A flat list of six independent layer controls is becoming difficult to scan and will not scale when research-coverage layers arrive.

This workstream groups layers into expandable categories without changing the underlying rendering contract: every layer remains independently checkable, URL-addressable and MapLibre-renderable.

## Category model

### Census & Community

- TIGER/Line boundary
- LODES workplace employment
- LODES commuting flows
- SAIPE county poverty

These layers describe official Census geography, workforce movement/employment and socioeconomic context.

### Environment & Hazards

- USGS 3HP hydrography
- USGS earthquake overlay

These layers provide environmental/reference context and event/hazard information from USGS.

### Research Coverage — reserved next

A future category will contain spatial representations of filtered research objects. It is intentionally not mixed with Census or USGS reference layers because research coverage has different provenance and semantics.

## Interaction design

Use native expandable disclosure semantics (`details` / `summary`) or an equivalent accessible disclosure pattern.

Requirements:

- each category can expand/collapse independently;
- each existing layer remains an ordinary labelled checkbox;
- collapsing a category never disables or hides the rendering state from the application;
- a category summary reports the number of visible child layers so active state is not hidden when collapsed;
- info/help controls remain keyboard reachable when the category is expanded;
- no positive tabindex or custom keyboard trap is introduced;
- category disclosure itself works with keyboard and screen readers;
- layer URL state and NgRx state stay authoritative for rendering.

## Accessibility

The canvas is not the information model. Category controls only organize the controls; they do not change the equivalent semantic layer list/tables already used for WCAG/Section 508-oriented evidence.

Evidence should cover:

- category summaries have meaningful accessible names;
- expand/collapse works with keyboard;
- every child checkbox remains independently operable;
- collapsing a category with checked children does not turn layers off;
- visible-layer count remains textual and does not depend on color;
- info buttons retain names/descriptions;
- focus indicators are not obscured;
- targets meet the WCAG 2.2 minimum-size/spacing intent;
- 320 px reflow, 200% zoom, dark mode and forced colors remain usable.

## Non-goals

This workstream does not:

- add new map data;
- change Census/USGS APIs;
- merge independent layer toggles into one category toggle;
- make categories control MapLibre visibility directly;
- infer research geography.

## Exit criteria

1. The six existing layers are grouped under the two categories above.
2. All six layer checkboxes remain independent.
3. Category collapse never changes layer visibility.
4. Category summaries expose active child-layer counts.
5. Browser/accessibility evidence covers disclosure and child controls.
6. The structure leaves a clear insertion point for the future Research Coverage category.
