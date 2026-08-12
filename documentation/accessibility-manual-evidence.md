# Manual Accessibility Evidence

Executable checklists for the manual half of Section 508 evidence. The automated suites in [accessibility-508-wcag.md](accessibility-508-wcag.md) prove the absence of detectable violations; these checklists prove the workflow is actually usable, which is a different claim and the one a program office cares about.

The map is the reason this matters. A MapLibre canvas can pass every axe rule and still be unusable with a screen reader, and this project's risk register says so explicitly. Automated evidence alone would overstate compliance.

## How to Use This

Run before each release, or before any demo presented as evidence. Record results in a dated copy under `documentation/accessibility-evidence/release-checklists/`, using the structure in [accessibility-508-wcag.md](accessibility-508-wcag.md#evidence-folder-direction).

Every check has an outcome of **Pass**, **Fail**, or **N/A**, plus a note when the outcome is not Pass. "Mostly works" is a Fail with a note; partial credit is how inaccessible software ships.

Record for each run: date, tester, application version or commit SHA, browser and version, assistive technology and version, and operating system.

Start the stack with `pnpm run start:all`, then run each checklist against `http://localhost:4200`.

## Scope

Six routes carry the demo, and each is covered by the automated suites at these same paths:

| Route            | What it must support                                            |
| ---------------- | --------------------------------------------------------------- |
| `/`              | Orientation and navigation to every other route                 |
| `/discovery`     | Keyword search, facet filtering, result navigation              |
| `/datasets/{id}` | Metadata, files, citation, versions, related research, map tabs |
| `/maps`          | Layer toggles, Census area selection, overlay states            |
| `/admin/sync`    | Dry-run, diff, and apply controls with status reporting         |
| `/evidence`      | Accessibility status summary                                    |

---

## Checklist 1 - Keyboard Only

Unplug or ignore the mouse for the entire checklist. Using it once invalidates the run.

### Global

| #   | Check                                                                             | WCAG         | Outcome |
| --- | --------------------------------------------------------------------------------- | ------------ | ------- |
| K1  | Every interactive control is reachable with `Tab`                                 | 2.1.1        |         |
| K2  | Nothing traps focus; `Tab` and `Shift+Tab` always escape                          | 2.1.2        |         |
| K3  | Focus indicator is visible on every focused control                               | 2.4.7        |         |
| K4  | Focus order matches visual order on each route                                    | 2.4.3        |         |
| K5  | A skip link, or an equivalent, reaches main content without tabbing the whole nav | 2.4.1        |         |
| K6  | Route changes move focus somewhere sensible and announce the new page             | 2.4.3        |         |
| K7  | No control requires a pointer-only gesture such as hover or drag                  | 2.1.1, 2.5.1 |         |

### Discovery

| #   | Check                                                                             | WCAG         | Outcome |
| --- | --------------------------------------------------------------------------------- | ------------ | ------- |
| K8  | The search field is reachable and accepts typed terms                             | 2.1.1        |         |
| K9  | `Enter` in the search field submits the search                                    | 2.1.1        |         |
| K10 | Every facet button is reachable and activates with `Enter` and `Space`            | 2.1.1        |         |
| K11 | Selected facet state is perceivable without color — check `aria-pressed`          | 1.4.1, 4.1.2 |         |
| K12 | Result count changes are announced without moving focus                           | 4.1.3        |         |
| K13 | Each result's dataset link is reachable and has a distinguishable accessible name | 2.4.4        |         |
| K14 | Loading, empty, and error states are reachable and readable                       | 4.1.3        |         |

### Dataset Detail

| #   | Check                                                                           | WCAG  | Outcome |
| --- | ------------------------------------------------------------------------------- | ----- | ------- |
| K15 | Tabs follow the tab pattern: arrows move between tabs, `Tab` leaves the tablist | 2.1.1 |         |
| K16 | `Home` and `End` move to the first and last tab                                 | 2.1.1 |         |
| K17 | The selected tab's panel is the one exposed and reachable                       | 4.1.2 |         |
| K18 | File download links have accessible names that identify format and content      | 2.4.4 |         |
| K19 | The citation is selectable and copyable by keyboard                             | 2.1.1 |         |
| K20 | The Map Preview tab's link into the map workspace is reachable                  | 2.1.1 |         |

### Maps

| #   | Check                                                                     | WCAG  | Outcome |
| --- | ------------------------------------------------------------------------- | ----- | ------- |
| K21 | Every layer toggle is reachable and operates with `Space`                 | 2.1.1 |         |
| K22 | Census area select is reachable and changeable by keyboard                | 2.1.1 |         |
| K23 | Toggling a layer updates the accessible feature list, not only the canvas | 1.1.1 |         |
| K24 | Map information is fully available without interacting with the canvas    | 1.1.1 |         |
| K25 | The legend is readable and does not rely on color alone                   | 1.4.1 |         |
| K26 | Attribution and update timestamp are reachable and readable               | —     |         |
| K27 | Stale and error overlay states are announced and readable                 | 4.1.3 |         |

### Admin Sync

| #   | Check                                                           | WCAG         | Outcome |
| --- | --------------------------------------------------------------- | ------------ | ------- |
| K28 | Dry run, Diff, and Apply are reachable and activate by keyboard | 2.1.1        |         |
| K29 | The disabled state during a run is perceivable, not just visual | 4.1.2        |         |
| K30 | Job status and resulting actions are announced when they arrive | 4.1.3        |         |
| K31 | A failed sync announces the error without stealing focus        | 3.3.1, 4.1.3 |         |

---

## Checklist 2 - NVDA Smoke Test

NVDA on Windows, latest stable, with Firefox and then Chrome. Use browse mode unless a check names focus mode. Record NVDA and browser versions.

| #   | Check                                                                                          | WCAG         | Outcome |
| --- | ---------------------------------------------------------------------------------------------- | ------------ | ------- |
| N1  | Page title is announced on load and is distinct per route                                      | 2.4.2        |         |
| N2  | Heading structure is navigable with `H`, with exactly one `h1` per route and no skipped levels | 1.3.1, 2.4.6 |         |
| N3  | Landmarks are navigable with `D`: banner, navigation, main, contentinfo                        | 1.3.1        |         |
| N4  | Navigation links are announced with their destination and current state                        | 2.4.4        |         |
| N5  | The search field is announced with its label and its role                                      | 3.3.2, 4.1.2 |         |
| N6  | Facet buttons announce label, count, and pressed state                                         | 4.1.2        |         |
| N7  | Activating a facet announces the updated result count via the status region                    | 4.1.3        |         |
| N8  | Results are navigable as a list, and each item's title is announced                            | 1.3.1        |         |
| N9  | Dataset metadata reads as description list pairs, not as run-together text                     | 1.3.1        |         |
| N10 | Tabs announce role, selected state, and position (`tab 2 of 6`)                                | 4.1.2        |         |
| N11 | Switching tabs announces the newly revealed panel                                              | 4.1.2        |         |
| N12 | The file list announces each file's label and format                                           | 1.3.1        |         |
| N13 | Map layer checkboxes announce label and checked state                                          | 4.1.2        |         |
| N14 | The accessible feature list conveys the same events as the map, including place and magnitude  | 1.1.1        |         |
| N15 | Overlay stale and error states are announced through the alert region                          | 4.1.3        |         |
| N16 | The map canvas does not trap browse mode or emit meaningless output                            | 2.1.2        |         |
| N17 | Sync status changes are announced without focus moving                                         | 4.1.3        |         |
| N18 | Sync errors are announced as alerts                                                            | 3.3.1        |         |
| N19 | Nothing announces a raw URL, an ID, or debug text where a human label belongs                  | 2.4.4        |         |
| N20 | Loading states are announced rather than presenting as silence                                 | 4.1.3        |         |

## Checklist 3 - JAWS Smoke Test

JAWS on Windows with Chrome, where a license is available. If unavailable, record N/A with the reason — an untested claim of JAWS support is worse than an honest gap.

Repeat N1–N20 under JAWS, then add the checks where JAWS commonly diverges from NVDA:

| #   | Check                                                                           | WCAG  | Outcome |
| --- | ------------------------------------------------------------------------------- | ----- | ------- |
| J1  | Virtual cursor reads the full page without skipping regions                     | 1.3.1 |         |
| J2  | Forms mode activates correctly on the search field and does not strand the user | 2.1.2 |         |
| J3  | The tablist is usable with the JAWS tab-control commands                        | 4.1.2 |         |
| J4  | `Insert+F7` lists links with meaningful, distinguishable names                  | 2.4.4 |         |
| J5  | `Insert+F6` lists headings in a coherent outline                                | 2.4.6 |         |
| J6  | `Insert+Ctrl+R` regions list exposes the alert and status regions               | 4.1.3 |         |
| J7  | Live-region announcements fire once, not repeatedly                             | 4.1.3 |         |
| J8  | Table or list semantics in the feature list survive the virtual cursor          | 1.3.1 |         |

## Checklist 4 - Map Equivalence

The determining question: **can someone who never perceives the canvas obtain the same information and perform the same tasks?** If the answer is no, the map is inaccessible regardless of the axe result.

| #   | Check                                                                                         | WCAG   | Outcome |
| --- | --------------------------------------------------------------------------------------------- | ------ | ------- |
| M1  | Every layer rendered on the map has a corresponding entry in the accessible list              | 1.1.1  |         |
| M2  | Every earthquake feature drawn is present in the feature list with place, magnitude, and time | 1.1.1  |         |
| M3  | Toggling a layer off removes it from both the canvas and the list, in the same interaction    | 1.1.1  |         |
| M4  | Selecting a Census area updates the list, not only the viewport                               | 1.1.1  |         |
| M5  | The legend communicates meaning through text or shape, not color alone                        | 1.4.1  |         |
| M6  | Magnitude and severity are conveyed by a value or label, never only by marker color or size   | 1.4.1  |         |
| M7  | Source attribution is present as text                                                         | —      |         |
| M8  | The data's update timestamp is present as text                                                | —      |         |
| M9  | Fallback fixture data is disclosed as such, not presented as live                             | —      |         |
| M10 | Stale data is labelled as stale in text                                                       | —      |         |
| M11 | An overlay outage is explained in text and leaves Census layers usable                        | —      |         |
| M12 | Nothing is conveyed only by pointer interaction such as hover or click-on-canvas              | 2.1.1  |         |
| M13 | The map region has an accessible name describing its purpose                                  | 1.1.1  |         |
| M14 | Map content reflows at 320px without horizontal scrolling                                     | 1.4.10 |         |
| M15 | At 200% zoom the layer controls and feature list stay operable                                | 1.4.4  |         |

## Checklist 5 - Cognitive and Workflow Review

Not a WCAG conformance list. These are the checks that separate a compliant interface from a usable one, and they are the ones a demo audience notices.

| #   | Check                                                                                                        | Outcome |
| --- | ------------------------------------------------------------------------------------------------------------ | ------- |
| C1  | The purpose of each route is clear from its heading and lead text                                            |         |
| C2  | Search results explain why they matched, and what each result is                                             |         |
| C3  | Applied filters are visible, and clearing them is discoverable                                               |         |
| C4  | Error messages state what happened and what to do next, without stack traces or status codes                 |         |
| C5  | Long operations show progress rather than appearing frozen                                                   |         |
| C6  | Repository jargon — community, collection, item, bitstream, research object — is either avoided or explained |         |
| C7  | Download affordances make file format and size expectations clear before activation                          |         |
| C8  | The citation is copyable and correctly formatted                                                             |         |
| C9  | Nothing implies data is live when it is a fixture                                                            |         |

---

## Recording Results

Copy this template per run:

```text
documentation/accessibility-evidence/release-checklists/YYYY-MM-DD-<commit-sha>.md

Date:            2026-08-12
Tester:
Commit:
Browser:         Firefox 130 / Chrome 128
Assistive tech:  NVDA 2024.3 / JAWS 2025
OS:              Windows 11

Automated:  pnpm run wcag:report      -> pass/fail, N checks
            pnpm run section508:report -> pass/fail, N checks
            pnpm run storyboard        -> pass/fail, N checks

Keyboard:        K1-K31   pass / fail (list failures)
NVDA:            N1-N20   pass / fail
JAWS:            J1-J8    pass / fail / N/A + reason
Map equivalence: M1-M15   pass / fail
Cognitive:       C1-C9    pass / fail

Failures found:
  <id> - <what happened> - <severity> - <issue link>

Known limitations accepted for this release:
  <what, why, and when it will be addressed>
```

## Known Limitations

Maintained honestly. An empty section here on a project with a map component is not credible.

| Limitation                                                                                       | Impact                                                                              | Status                                                                                     |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| No manual assistive-technology run has been recorded yet                                         | Screen-reader support is unverified; automated evidence alone does not establish it | Open — first run is a release blocker for any evidence-backed demo                         |
| JAWS licensing may be unavailable                                                                | JAWS-specific behavior unverified; NVDA is the primary evidence                     | Open — record N/A with reason rather than implying coverage                                |
| MapLibre canvas is not itself accessible                                                         | Mitigated by the parallel feature list rather than by making the canvas navigable   | Accepted design approach; verified by Checklist 4                                          |
| Forced-colors and high-contrast mode is listed as planned automated evidence but not implemented | Windows high-contrast users unverified                                              | Open                                                                                       |
| Fixture data is served where live repository data is intended                                    | An evidence run exercises fixture content, not production-shaped content            | Open — see Known Seams in [architecture-diagrams.md](architecture-diagrams.md#known-seams) |
