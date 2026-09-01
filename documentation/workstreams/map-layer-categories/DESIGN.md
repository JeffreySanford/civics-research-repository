# Design Choice

Use native `details`/`summary` disclosures instead of a custom accordion component. This keeps the expand/collapse keyboard model in the browser, avoids a second category-state store, and lets layer URL/NgRx state remain the sole render authority.
