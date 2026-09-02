# Testing

Automated browser evidence verifies:

- all three implemented category summaries are present and correctly named;
- each child checkbox still drives URL state, legend/accessibility evidence and MapLibre visibility;
- collapsing a category with a checked child leaves that layer rendered;
- reopening the category restores access to the unchanged checked control;
- the layer used by collapse evidence is resolved by `toggleTestId`, not array position;
- no positive tabindex or custom disclosure keyboard handling is introduced.

CSS/accessibility review verifies:

- `summary` retains native disclosure-marker behavior;
- flex layout is applied to the inner summary wrapper rather than replacing `summary` display semantics;
- `overflow: hidden` precedes `overflow: clip` as a compatibility fallback;
- focus-visible treatment and forced-colors behavior remain intact;
- narrow-width layout remains readable.

Normal merge evidence remains the repository workspace/API/browser/security checks. This PR does not add heavy C2 data work to ordinary CI.
