# Testing

Automated browser evidence must verify:

- both category summaries are present and named;
- visible-child counts update as checkboxes change;
- each child checkbox still drives legend, accessible equivalent and MapLibre visibility;
- collapsing a category with a checked child leaves that layer rendered;
- reopening the category restores access to the unchanged checked control;
- info controls retain accessible names/descriptions;
- no positive tabindex or custom disclosure keyboard handling is introduced.
