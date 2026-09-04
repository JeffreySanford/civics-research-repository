# Manual Accessibility Evidence

Automated evidence proves machine-checkable preconditions. Manual evidence proves that a person can complete the workflow with a keyboard and assistive technology. The two are recorded separately.

A MapLibre canvas can pass axe and still be unusable. For this platform, the determining question is whether someone who never perceives the canvas can obtain the same research information and perform the same meaningful tasks through the equivalent controls, tables and lists.

## Recording a run

Start the stack with:

```bash
pnpm run start:all
```

Record results under `documentation/accessibility-evidence/` with:

- date and tester,
- application commit SHA,
- browser and version,
- operating system,
- assistive technology and version,
- Safari Full Keyboard Access / Tab-highlighting state when applicable,
- Pass, Fail or N/A for every item,
- notes for every result that is not Pass,
- issue links and accepted limitations.

“Mostly works” is a Fail with a note. A missing license or unavailable platform is N/A with the reason, not an implied pass.

## Scope

| Route                                      | Primary workflow                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `/`                                        | Orientation and primary navigation                                                               |
| `/discovery`                               | Search, facets, paging and result navigation                                                     |
| `/datasets/{id}` / future `/research/{id}` | Type-aware research-object metadata, files, citation and relationships                           |
| `/maps`                                    | Layer controls, area selection, equivalent tables/lists and synchronized selection               |
| `/admin/sync`                              | Dry-run, diff, apply, reindex and status reporting                                               |
| `/evidence`                                | Accessibility/data-pipeline evidence plus Historical C2 baseline and Adversarial C2.1 validation |
| `/search-lab`                              | Two-engine comparison form, projection parity, status and result interpretation                  |

## Checklist 1 — Keyboard only

Ignore or disconnect the mouse for the entire run.

### Global

| ID  | Check                                                        | WCAG         |
| --- | ------------------------------------------------------------ | ------------ |
| K1  | Every interactive control is reachable with `Tab`            | 2.1.1        |
| K2  | `Tab` and `Shift+Tab` always escape; no keyboard trap        | 2.1.2        |
| K3  | Every focused control has a visible focus indicator          | 2.4.7        |
| K4  | Focus order follows the visual and workflow order            | 2.4.3        |
| K5  | Skip link or equivalent reaches main content                 | 2.4.1        |
| K6  | Route and major content changes move/announce focus sensibly | 2.4.3        |
| K7  | No task requires hover, drag or pointer-only gestures        | 2.1.1, 2.5.1 |

### Discovery

| ID  | Check                                                   | WCAG         |
| --- | ------------------------------------------------------- | ------------ |
| K8  | Search input is reachable and accepts text              | 2.1.1        |
| K9  | Enter submits search                                    | 2.1.1        |
| K10 | Facets operate with Enter and Space                     | 2.1.1        |
| K11 | Selected facet state is perceivable without color       | 1.4.1, 4.1.2 |
| K12 | Result count changes are announced without moving focus | 4.1.3        |
| K13 | Result links are reachable and distinguishable          | 2.4.4        |
| K14 | Loading, empty and error states are reachable/readable  | 4.1.3        |

### Research-object detail

| ID  | Check                                       | WCAG  |
| --- | ------------------------------------------- | ----- |
| K15 | Tabs follow the keyboard tab pattern        | 2.1.1 |
| K16 | Home and End move to first/last tab         | 2.1.1 |
| K17 | Selected tab and visible panel agree        | 4.1.2 |
| K18 | File links identify content and format      | 2.4.4 |
| K19 | Citation is selectable/copyable by keyboard | 2.1.1 |
| K20 | Map/research-context links are reachable    | 2.1.1 |

### Maps

| ID  | Check                                                   | WCAG  |
| --- | ------------------------------------------------------- | ----- |
| K21 | Every layer toggle operates with keyboard               | 2.1.1 |
| K22 | Census area control is reachable/changeable             | 2.1.1 |
| K23 | Layer changes update the non-map representation         | 1.1.1 |
| K24 | Research values are available without the canvas        | 1.1.1 |
| K25 | Legend meaning does not rely on color alone             | 1.4.1 |
| K26 | Attribution, methodology and timestamps are reachable   | —     |
| K27 | Stale, fallback and error states are announced/readable | 4.1.3 |

### Admin sync

| ID  | Check                                                | WCAG         |
| --- | ---------------------------------------------------- | ------------ |
| K28 | Dry run, Diff, Apply and Reindex operate by keyboard | 2.1.1        |
| K29 | Disabled/busy state is perceivable                   | 4.1.2        |
| K30 | Job status and resulting actions are announced       | 4.1.3        |
| K31 | Sync failure is announced without stealing focus     | 3.3.1, 4.1.3 |

### WCAG 2.2 manual extension

| ID  | Check                                                                   | WCAG   |
| --- | ----------------------------------------------------------------------- | ------ |
| W1  | Focused controls are not entirely obscured by author-created content    | 2.4.11 |
| W2  | Any drag interaction has a non-dragging alternative where applicable    | 2.5.7  |
| W3  | Primary pointer targets meet target-size, spacing or exception criteria | 2.5.8  |

## Checklist 2 — NVDA

Run the latest stable NVDA with Firefox and Chrome. Record browse/focus mode where relevant.

| ID  | Check                                                       | WCAG         |
| --- | ----------------------------------------------------------- | ------------ |
| N1  | Page title is announced and distinct                        | 2.4.2        |
| N2  | Heading outline is navigable and coherent                   | 1.3.1, 2.4.6 |
| N3  | Landmarks are navigable and meaningful                      | 1.3.1        |
| N4  | Navigation links expose destination/current state           | 2.4.4        |
| N5  | Search field exposes label and role                         | 3.3.2, 4.1.2 |
| N6  | Facets announce label, count and pressed state              | 4.1.2        |
| N7  | Facet changes announce result count                         | 4.1.3        |
| N8  | Results read as a list with meaningful titles               | 1.3.1        |
| N9  | Metadata reads as label/value relationships                 | 1.3.1        |
| N10 | Tabs announce role, selected state and position             | 4.1.2        |
| N11 | Switching tabs exposes the new panel clearly                | 4.1.2        |
| N12 | Files announce content and format                           | 1.3.1        |
| N13 | Layer controls announce label and state                     | 4.1.2        |
| N14 | Tables/lists convey the map's research values               | 1.1.1        |
| N15 | Stale/fallback/error states are announced                   | 4.1.3        |
| N16 | Canvas does not trap browse mode or emit meaningless output | 2.1.2        |
| N17 | Sync status changes announce once without moving focus      | 4.1.3        |
| N18 | Sync errors announce as alerts                              | 3.3.1        |
| N19 | No raw URL, UUID or debug text substitutes for a human name | 2.4.4        |
| N20 | Loading states are announced rather than silent             | 4.1.3        |

## Checklist 3 — JAWS

Repeat N1–N20 with JAWS and Chrome where a license is available, then add:

| ID  | Check                                               | WCAG  |
| --- | --------------------------------------------------- | ----- |
| J1  | Virtual cursor reads the complete page              | 1.3.1 |
| J2  | Forms mode enters/exits the search field correctly  | 2.1.2 |
| J3  | Tab control commands operate the tablist            | 4.1.2 |
| J4  | Link list contains meaningful distinguishable names | 2.4.4 |
| J5  | Heading list is coherent                            | 2.4.6 |
| J6  | Regions list exposes alert/status regions           | 4.1.3 |
| J7  | Live announcements fire once                        | 4.1.3 |
| J8  | Equivalent tables/lists retain usable semantics     | 1.3.1 |

## Checklist 4 — Map equivalence

| ID  | Check                                                              | WCAG   |
| --- | ------------------------------------------------------------------ | ------ |
| M1  | Every visible map layer has equivalent textual controls/content    | 1.1.1  |
| M2  | Every displayed event/value is available nonvisually               | 1.1.1  |
| M3  | Hiding a layer updates both map and equivalent content             | 1.1.1  |
| M4  | Changing area updates both viewport and equivalent content         | 1.1.1  |
| M5  | Legend uses text/shape as well as color                            | 1.4.1  |
| M6  | Magnitude/intensity is expressed as a value or label               | 1.4.1  |
| M7  | Attribution is textual                                             | —      |
| M8  | Update/freshness time is textual                                   | —      |
| M9  | Fixture or stored-sample data is disclosed                         | —      |
| M10 | Stale data is labelled                                             | —      |
| M11 | Overlay outage leaves other layers usable and explained            | —      |
| M12 | No information/task exists only through canvas pointer interaction | 2.1.1  |
| M13 | Map region has a meaningful accessible name                        | 1.1.1  |
| M14 | Map content reflows at 320px                                       | 1.4.10 |
| M15 | Controls and equivalent content remain usable at 200% zoom         | 1.4.4  |

For M12, explicitly test a trusted click on a rendered feature and confirm that the matching table/list item receives the intended selection/focus treatment. This remains manual because WebGL hit testing and trusted pointer behavior are not fully represented by the automated fixture path.

## Evidence and Search Lab extension for issue #49

The current demo exposes historical C2 evidence and the adversarial C2.1 experiment as separate layers. Human review must preserve that distinction rather than treating both as one pooled benchmark.

### Search comparison Evidence

| ID  | Check                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------ |
| E1  | **Historical C2 baseline** and **Adversarial C2.1 validation** are separately named and encountered in a logical reading order |
| E2  | The C2.1 24-cell workload table can be reached, traversed and interpreted without relying on visual layout alone               |
| E3  | Median `OpenSearch - Solr`, bootstrap 95% CI, 16 independent batch summaries and four restart blocks are understandable        |
| E4  | Historical C2 and C2.1 claim boundaries are both discoverable and no wording implies that their samples are pooled             |
| E5  | Dense C2/C2.1 tables preserve captions/headers/units and remain operable when local horizontal scrolling is required           |

### Search Lab

| ID  | Check                                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------- |
| S1  | Scenario, search terms and structured-filter controls are reached in logical order                        |
| S2  | `Run both engines` is keyboard operable and the running/completion status is perceivable                  |
| S3  | Projection parity or warning state is encountered before interpreting engine differences                  |
| S4  | Solr and OpenSearch result/metric sections have distinct, coherent headings                               |
| S5  | Clear/reverse filters restores a predictable form state without stale focus                               |
| S6  | Local timing is explained as diagnostic evidence for this topology rather than a universal engine verdict |

## Checklist 5 — Cognitive and workflow review

| ID  | Check                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------ |
| C1  | Each route's purpose is clear from heading and lead text                                                           |
| C2  | Search results explain what the object is and why it matched                                                       |
| C3  | Applied filters are visible and reversible                                                                         |
| C4  | Errors explain what happened and what to do next                                                                   |
| C5  | Long operations show progress                                                                                      |
| C6  | Repository terminology is avoided or explained                                                                     |
| C7  | File actions communicate content/format/size expectations                                                          |
| C8  | Citation is correct and copyable                                                                                   |
| C9  | Nothing implies live/repository content when it is fixture, stale or sampled                                       |
| C10 | Evidence distinguishes Historical C2 baseline from Adversarial C2.1 validation and preserves scoped claim language |

## Browser-specific notes

### Safari/WebKit

Raw Tab traversal depends on macOS/Safari Full Keyboard Access. Playwright WebKit does not reliably reproduce that preference, so automated WebKit results cover semantics, names/descriptions, axe, reflow, contrast and supported interactions—not K1/K2 traversal. Record the preference state during manual Safari testing.

### Forced colors

Forced-colors/high-contrast checks are implemented in Chromium automation. Firefox/WebKit do not emulate the media feature reliably in this suite, so those specific automated cases are skipped rather than reported as passes.

## Known limitations

| Limitation                                             | Impact                                                       | Status                                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| No completed manual AT run is recorded                 | Screen-reader usability remains unverified                   | Open; required before an evidence-backed release claim                                  |
| JAWS may be unavailable                                | JAWS-specific behavior may remain unverified                 | Record N/A with reason                                                                  |
| WebGL canvas is not the accessible information model   | Direct canvas experience is not equivalent to semantic HTML  | Accepted design; equivalent controls/tables/lists must pass Checklist 4                 |
| Trusted map-click to list focus is not fully automated | One direction of synchronized selection needs human evidence | Open M12 check                                                                          |
| Safari raw Tab behavior depends on user preference     | Playwright WebKit cannot establish K1/K2                     | Manual Safari evidence required                                                         |
| Fixture/stored-sample paths exist                      | A reviewer could mistake fallback for live data              | Mitigated by typed provenance and visible disclosure; provenance hardening remains open |

## Result template

```text
Date:
Tester:
Commit:
OS:
Browser(s):
Safari Full Keyboard Access state (if applicable):
Assistive technology:

Keyboard K1-K31: pass / fail
WCAG 2.2 W1-W3: pass / fail
NVDA N1-N20: pass / fail
JAWS N1-N20 + J1-J8: pass / fail / N/A
Map M1-M15: pass / fail
Evidence E1-E5: pass / fail
Search Lab S1-S6: pass / fail
Cognitive C1-C10: pass / fail

Failures:
  <ID> — <behavior> — <severity> — <issue link>

Accepted limitations:
  <limitation, rationale and follow-up>
```
