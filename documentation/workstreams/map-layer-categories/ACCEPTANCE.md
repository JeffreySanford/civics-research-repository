# Acceptance Criteria

- `Geography & Boundaries` contains TIGER/Line boundary.
- `Community & Economy` contains LODES workplace employment, LODES commuting flows and SAIPE county poverty.
- `Environment & Hazards` contains USGS 3HP hydrography and USGS earthquake overlay.
- Every child remains an independent checkbox backed by existing URL/NgRx state.
- Category expand/collapse never changes a child's checked/rendered state.
- The browser-native disclosure marker remains visible.
- Summary layout remains usable at narrow widths and in forced colors.
- Summary metadata does not add multiple `async` subscriptions or timing-dependent visible-count arithmetic.
- Browser evidence selects visibility groups by stable toggle ID rather than array position.
- Browser evidence asserts native disclosure state through the `open` DOM property rather than boolean-attribute serialization.
- Existing accessible layer lists/tables and MapLibre visibility evidence remain synchronized.
- No empty `Research Coverage` category is rendered before its first implemented child exists.
