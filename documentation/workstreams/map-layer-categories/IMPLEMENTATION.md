# Implementation

## Current implementation

1. Group existing controls under native `details` / `summary` disclosures.
2. Split the current controls into `Geography & Boundaries`, `Community & Economy`, and `Environment & Hazards`.
3. Preserve every existing checkbox, URL parameter, NgRx action and MapLibre rendering path.
4. Keep `summary` at its native list-item display so the browser disclosure marker remains visible; put flex layout on an inner wrapper.
5. Use `overflow: hidden` as the compatibility fallback before `overflow: clip`.
6. Show static category size in summaries instead of creating multiple `async` subscriptions to compute visible-child totals.
7. Keep the existing accessible layer list/tables and tooltip accessible descriptions.
8. Keep Research Coverage downstream until a backed child exists.

## Review hardening

Copilot review identified four issues and the implementation addresses all four:

- test lookup now resolves a layer group by `toggleTestId`, never by array index;
- dynamic count interpolation was removed rather than multiplying template subscriptions;
- native disclosure affordance is preserved;
- overflow compatibility fallback is present.

## Downstream boundary

New thematic/spatial data does not belong in this PR. Shared authoritative administrative geometry and Research Coverage remain separate workstreams so this PR stays a control-organization change.
