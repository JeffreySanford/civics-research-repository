# Manual Accessibility Run Procedure

This procedure turns the checklist in [`../accessibility-manual-evidence.md`](../accessibility-manual-evidence.md) into a reproducible, commit-bound evidence run for issue #49.

It does **not** establish a pass by itself. A human tester must perform the tasks and save the completed results using [`manual-run-template.md`](manual-run-template.md).

## 1. Freeze the application under test

Before testing:

```bash
git switch main
git pull --ff-only origin main
git rev-parse HEAD
```

Record that SHA in the run file. Do not mix results from different application commits into one evidence record.

Start the ordinary supported demo topology:

```bash
pnpm install --frozen-lockfile
pnpm run start:all
```

Record the active corpus/profile shown by the application. The manual accessibility result is about the UI commit and the visible runtime state; it is not a new C2 or C2.1 performance run.

## 2. Record the test environment

For every browser/AT combination record:

- OS and version;
- browser and version;
- assistive technology and version;
- viewport and zoom;
- forced-colors/high-contrast state if used;
- NVDA browse/focus-mode observations where relevant;
- JAWS availability/license status;
- Safari Full Keyboard Access/Tab-highlighting state if Safari is tested.

Do not reuse a Firefox result as a Chrome result or an NVDA result as a JAWS result.

## 3. Keyboard-only route pass

Disconnect or deliberately avoid the mouse/pointer for the keyboard run.

Use this route order:

1. `/`
2. `/discovery`
3. one representative `/research/:id`
4. `/maps`
5. `/admin/sync`
6. `/evidence`
7. `/search-lab`

For every route verify:

- predictable entry into main content;
- visible focus;
- logical forward/reverse order;
- no traps;
- no pointer-only task;
- no focused item obscured by fixed/sticky content;
- primary targets/spacing remain usable;
- status changes do not steal focus unexpectedly.

### Discovery task

Perform a complete workflow rather than tabbing through controls without using them:

1. focus the search input;
2. enter a real query;
3. submit;
4. apply at least one facet;
5. confirm result count/status changes;
6. remove/reverse the facet;
7. navigate a result;
8. return to Discovery and confirm the workflow remains understandable;
9. exercise paging/deep-discovery navigation where present.

### Research-object task

On a representative object:

1. identify type/title/provenance;
2. navigate every tab/disclosure used by the object;
3. inspect citation/relationships/files or external links where present;
4. confirm restricted/external/not-preserved states are understandable without color or pointer cues.

### Maps task

1. operate the category/layer controls;
2. change an area/geography where supported;
3. confirm the semantic list/table changes with the visual state;
4. obtain the meaningful research values without relying on the canvas;
5. tab through/around the MapLibre region and confirm there is no trap;
6. perform the trusted map-feature to semantic-list synchronization check when a selectable rendered feature is available;
7. repeat the route at 200% zoom;
8. inspect the 320 CSS-pixel/reflow condition without horizontal page-level loss of controls/content.

### Evidence task

On `/evidence`, select **Search comparison** and verify the two evidence layers in reading order.

For the **Historical C2 baseline** verify:

1. certified corpus/projection summary;
2. order robustness and telemetry integrity;
3. separately warmed batch inference;
4. paired workload table;
5. 1/8/32 concurrency table;
6. experimental controls;
7. historical C2 scientific claim boundary.

Then continue into **Adversarial C2.1 validation** and verify:

1. the heading makes C2.1 visibly and nonvisually distinct from the historical C2 baseline;
2. the optimized `C2_1_OPTIMIZED_EQUIVALENT` treatment and experiment design are understandable;
3. the 16 independent batch summaries per cell and four restart blocks are discoverable;
4. all 24 retained workload cells can be reached and read, including query/filter identity and realized hit count;
5. median `OpenSearch - Solr`, bootstrap 95% CI and Solr batch win rate have understandable units/sign meaning;
6. the C2.1 claim boundary is encountered and remains scoped to the certified corpus/configuration/topology;
7. the page does not imply that historical C2 and adversarial C2.1 samples were pooled.

For dense tables, confirm keyboard users can reach/read all content, any table-local horizontal scrolling is operable, and the page itself does not become an uncontrolled horizontal-scroll surface. Do not pool C2 and C2.1 observations into one manual result; record any layer-specific failure against the layer where it occurred.

### Search Lab task

On `/search-lab`:

1. reach **Scenario**;
2. choose **Full-text relevance**;
3. reach **Search terms** and enter `North Dakota workforce`;
4. activate **Run both engines**;
5. perceive the `Running comparison` status;
6. confirm completion is announced without focus being forced away from the form;
7. locate **Projection parity verified** before interpreting engine differences;
8. navigate the Solr result section;
9. navigate the OpenSearch result section;
10. use **Clear filters** and confirm a predictable form state.

Repeat with at least one structured filter. If an engine-unavailable test state is available without damaging the local corpus, confirm the surviving engine evidence and warning remain understandable. Do not disrupt the certified corpus merely to manufacture an error state.

## 4. NVDA + Firefox

Use current stable NVDA and Firefox.

For each primary route:

- inspect page title;
- navigate headings;
- navigate landmarks;
- inspect forms/labels/states in focus mode;
- inspect status/alert announcements;
- confirm raw IDs/URLs/debug values do not replace human labels where labels are expected.

Then perform the complete Discovery, Maps, Evidence and Search Lab tasks rather than only reading static content.

For Evidence specifically, use NVDA table-navigation commands to confirm that captions, column headers and row headers preserve meaning in the historical C2 paired-workload/concurrency tables and the adversarial C2.1 24-cell table. Confirm the **Historical C2 baseline** and **Adversarial C2.1 validation** headings are distinct in the heading list, the `OpenSearch - Solr` sign convention is understandable, and each layer's claim boundary is encountered separately.

For Maps, the success criterion is the semantic workflow, not whether NVDA can interpret WebGL drawing commands.

## 5. NVDA + Chrome/Chromium

Repeat the NVDA workflow in Chrome/Chromium. Record differences independently.

Do not copy the Firefox cells into the Chrome column even when behavior appears identical.

## 6. JAWS + Chrome

Where a JAWS license/environment is available, repeat the relevant screen-reader workflow and specifically inspect:

- virtual cursor reading order;
- Forms Mode entry/exit;
- heading/link/region lists;
- live-region behavior;
- Evidence table navigation across both C2 and C2.1 layers;
- Search Lab form/result navigation;
- Maps semantic equivalent.

If JAWS is unavailable, record `N/A` with the licensing/environment reason. Do not represent unavailable testing as a pass.

## 7. WCAG 2.2 manual checks

Explicitly record:

- **2.4.11 Focus Not Obscured (Minimum)** — keyboard focus is not entirely hidden by author-created content;
- **2.5.7 Dragging Movements** — any drag interaction has a non-dragging alternative where the criterion applies;
- **2.5.8 Target Size (Minimum)** — primary pointer targets meet the criterion or its spacing/exception conditions.

These are separate from the existing automated WCAG/Section 508-oriented evidence.

## 8. Cognitive/workflow review

Review the product as a public researcher or repository steward rather than as the developer who already knows the architecture.

Particularly inspect:

- whether provenance is understandable;
- whether search/filter state is reversible;
- whether errors explain a next action;
- whether Search Lab distinguishes diagnostic local timing from a universal engine verdict;
- whether Evidence distinguishes operational parity, descriptive request timing and stronger batch-level inference;
- whether **Historical C2 baseline** and **Adversarial C2.1 validation** are clearly separate evidence layers;
- whether dense C2/C2.1 tables explain their units/sign conventions without requiring prior benchmark knowledge;
- whether the C2.1 claim boundary remains scoped and does not imply a universal Solr/OpenSearch result.

## 9. Failure handling

A manual failure is evidence, not something to edit out of the checklist.

For every failure:

1. record the checklist ID and exact behavior;
2. open/link a product defect;
3. implement a narrowly scoped fix with automated regression evidence where practical;
4. rerun the failed manual task on the fixing commit;
5. record both the original failure and rerun result.

Do not change a failed item to `N/A` merely because fixing it is inconvenient.

## 10. Save the evidence

Create dated records under the evidence structure, for example:

```text
documentation/accessibility-evidence/
  keyboard-tests/
    2026-09-xx-<short-sha>.md
  screen-reader-notes/
    2026-09-xx-nvda-firefox-<short-sha>.md
    2026-09-xx-nvda-chrome-<short-sha>.md
    2026-09-xx-jaws-chrome-<short-sha>.md
  release-checklists/
    2026-09-xx-manual-accessibility-<short-sha>.md
```

A release summary should link to the detailed keyboard/screen-reader records rather than copying observations inconsistently.

After evidence files are added, use the repository's evidence generation/check path as appropriate. Do not hand-edit automated pass status to manufacture a combined conformance claim.

## Completion boundary

Issue #49 is complete only when:

- keyboard evidence exists for the primary routes;
- NVDA Firefox and Chrome/Chromium evidence is recorded;
- JAWS is tested or explicitly `N/A` with reason;
- Maps, Evidence and Search Lab have manual workflow evidence;
- Historical C2 baseline and Adversarial C2.1 validation have separate human Evidence observations;
- failures have remediation/rerun records;
- evidence/status language still distinguishes automated and manual verification.
