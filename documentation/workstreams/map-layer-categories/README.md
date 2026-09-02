# Map Layer Categories

## Purpose

The Maps workspace has grown beyond a flat six-toggle demo. This workstream organizes existing layers by research purpose while preserving the rendering contract: every layer remains independently checkable, URL-addressable, NgRx-backed and MapLibre-renderable.

## Stable taxonomy

### Geography & Boundaries

- TIGER/Line boundary

Geometry and administrative reference layers belong here. Future shared county/PUMA/tract geometry can extend this category without mixing geometry with measures.

### Community & Economy

- LODES workplace employment
- LODES commuting flows
- SAIPE county poverty

Future thematic layers such as Population Estimates, County Business Patterns, Business Dynamics Statistics and Building Permits belong here.

### Environment & Hazards

- USGS 3HP hydrography
- USGS earthquake overlay

Future 3DEP terrain belongs here.

### Research Coverage — future

Do not render an empty category. Add it only when its first backed child exists, beginning with repository research-by-area and later explicit Data.gov/NASA spatial coverage.

## Interaction design

Use native `details` / `summary` disclosure semantics. Category disclosure owns presentation only; child checkboxes remain authoritative for layer visibility.

Requirements:

- categories expand/collapse independently;
- every existing layer remains an ordinary labelled checkbox;
- collapsing a category never changes checked or rendered state;
- summaries keep the browser-native disclosure marker;
- summary metadata is static category size (`1 layer`, `3 layers`, `2 layers`) rather than recomputing visibility with additional template subscriptions;
- no positive tabindex or custom disclosure keyboard handling is introduced;
- info/help controls remain keyboard reachable when expanded.

## Accessibility

The MapLibre canvas is not the information model. Existing semantic layer lists/tables, status text and selection state remain the accessible equivalents.

Evidence covers keyboard disclosure behavior, independently operable child controls, collapse-with-active-layer behavior, native focus indication, forced colors, responsive layout and unchanged semantic/map visibility parity.

## Non-goals

This workstream does not add new map data, alter Census/USGS APIs, make categories toggle children, infer research geography, or render an empty Research Coverage category.

## Exit criteria

1. The six current layers are organized under the three implemented categories above.
2. All child checkboxes remain independent.
3. Category collapse never changes layer visibility.
4. Native disclosure affordance remains visible.
5. The template does not create extra subscriptions merely to count visible children.
6. Browser evidence addresses categories by stable identifiers rather than array position.
7. The structure leaves a clean insertion point for Research Coverage.
