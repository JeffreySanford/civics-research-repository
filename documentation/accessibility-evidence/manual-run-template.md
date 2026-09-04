# Manual Accessibility Evidence Run

> Copy this file to a dated evidence record. Do not mark an item `Pass` unless a human tester performed the stated task on the recorded commit/environment. `N/A` requires a reason. “Mostly works” is `Fail` with a note.

## Run identity

| Field | Value |
| --- | --- |
| Date/time | |
| Tester | |
| Application commit SHA | |
| Active corpus/profile | |
| Operating system/version | |
| Browser/version | |
| Viewport | |
| Zoom | |
| Assistive technology/version | |
| NVDA browse/focus mode notes | |
| JAWS availability/license status | |
| Safari Full Keyboard Access/Tab highlighting | N/A unless Safari is tested |

## Result codes

- `Pass` — the task completed and the expected information/state was perceivable.
- `Fail` — the task did not complete reliably or required an inaccessible workaround.
- `N/A` — the check does not apply to this environment; record the reason.
- `Not run` — no human evidence has been collected yet.

## Primary route matrix

| Route | Workflow | Keyboard | Screen reader | Notes/issues |
| --- | --- | --- | --- | --- |
| `/` | Orientation, navigation, skip link | Not run | Not run | |
| `/discovery` | Search, facets, URL state, paging, result navigation | Not run | Not run | |
| `/research/:id` | Metadata, provenance, relationships/files where present | Not run | Not run | |
| `/maps` | Layer controls, area selection, semantic equivalent, synchronized selection | Not run | Not run | |
| `/admin/sync` | Status and safe operator controls | Not run | Not run | |
| `/evidence` | Evidence navigation, dense tables, C2 claim boundary | Not run | Not run | |
| `/search-lab` | Form, comparison execution, projection parity, two-engine results | Not run | Not run | |

## Keyboard-only results

Run without using a pointing device.

| ID | Check | WCAG | Result | Observation / issue |
| --- | --- | --- | --- | --- |
| K1 | Every interactive control is reachable with `Tab` | 2.1.1 | Not run | |
| K2 | `Tab` / `Shift+Tab` always escape; no keyboard trap | 2.1.2 | Not run | |
| K3 | Focus indicator remains clearly visible | 2.4.7 | Not run | |
| K4 | Focus order follows workflow/reading order | 2.4.3 | Not run | |
| K5 | Skip link or equivalent reaches main content | 2.4.1 | Not run | |
| K6 | Route/content changes move or announce focus sensibly | 2.4.3 | Not run | |
| K7 | No meaningful task requires hover, drag or pointer-only input | 2.1.1, 2.5.1, 2.5.7 | Not run | |
| K8 | Focused controls are not hidden by sticky/fixed content | 2.4.11 | Not run | |
| K9 | Target sizes or spacing are usable for primary controls | 2.5.8 | Not run | |

### Discovery

| ID | Check | Result | Observation / issue |
| --- | --- | --- | --- |
| KD1 | Reach search input, enter terms and submit without mouse | Not run | |
| KD2 | Operate facets with keyboard and perceive selected state without color | Not run | |
| KD3 | Result-count/loading updates do not steal focus and are announced appropriately | Not run | |
| KD4 | Clear/reverse filters and restore a predictable result state | Not run | |
| KD5 | Navigate result links and return without losing workflow context | Not run | |
| KD6 | Paging/deep-discovery controls remain keyboard operable | Not run | |

### Research detail

| ID | Check | Result | Observation / issue |
| --- | --- | --- | --- |
| KR1 | Heading/provenance identify what the research object is and who is authoritative | Not run | |
| KR2 | Tabs, disclosures and links follow expected keyboard patterns | Not run | |
| KR3 | Citation/file/external-resource actions are reachable and meaningfully named | Not run | |
| KR4 | Restricted/external/not-preserved states are understandable without visual-only cues | Not run | |

### Maps

| ID | Check | Result | Observation / issue |
| --- | --- | --- | --- |
| KM1 | Every layer/category control is keyboard operable | Not run | |
| KM2 | Geography/area controls are reachable and changeable | Not run | |
| KM3 | Layer/area changes update the semantic list/table equivalent | Not run | |
| KM4 | All meaningful research values can be obtained without perceiving the canvas | Not run | |
| KM5 | Map/legend meaning does not rely on color alone | Not run | |
| KM6 | MapLibre canvas/focusable region does not trap keyboard navigation | Not run | |
| KM7 | Trusted feature selection has a usable map-to-list/list-to-map focus path | Not run | |
| KM8 | Controls and equivalent content remain usable at 200% zoom and 320 CSS px width | Not run | |

### Evidence

| ID | Check | Result | Observation / issue |
| --- | --- | --- | --- |
| KE1 | Reach the Search comparison evidence surface in a predictable order | Not run | |
| KE2 | Certified corpus/projection/order/telemetry summary is readable without layout-dependent interpretation | Not run | |
| KE3 | Separately warmed batch inference terms and sign convention are understandable | Not run | |
| KE4 | Paired workload and concurrency tables can be traversed by keyboard without horizontal-scroll traps | Not run | |
| KE5 | Table captions/headers preserve row/column meaning at dense data points | Not run | |
| KE6 | Experimental controls and claim boundary are reachable after the tables | Not run | |
| KE7 | Loading/error status for evidence is perceivable without moving focus unexpectedly | Not run | |

### Search Lab

| ID | Check | Result | Observation / issue |
| --- | --- | --- | --- |
| KS1 | Reach Scenario, Search terms and structured filter controls in logical order | Not run | |
| KS2 | Submit `Run both engines` with keyboard and perceive `Running comparison` | Not run | |
| KS3 | Completion is announced without forcing focus away from the form | Not run | |
| KS4 | Projection parity verified/warning state is discoverable before interpreting engine results | Not run | |
| KS5 | Navigate Solr and OpenSearch metrics/facets/results with coherent headings | Not run | |
| KS6 | Clear filters and rerun comparison without stale focus/state | Not run | |
| KS7 | Partial-engine warning/error remains understandable and the available engine evidence remains usable | Not run | |

## NVDA results

Run with current stable NVDA in **Firefox**, then repeat in **Chrome/Chromium**. Record browser-specific differences instead of copying results between browsers.

| ID | Check | Firefox | Chrome/Chromium | Observation / issue |
| --- | --- | --- | --- | --- |
| N1 | Distinct page title is announced | Not run | Not run | |
| N2 | Heading outline is coherent with heading navigation | Not run | Not run | |
| N3 | Landmarks are meaningful and navigable | Not run | Not run | |
| N4 | Navigation exposes destination/current state | Not run | Not run | |
| N5 | Form controls expose label, role and state | Not run | Not run | |
| N6 | Search/facet result updates announce once without unwanted focus movement | Not run | Not run | |
| N7 | Research metadata/provenance reads as meaningful label/value information | Not run | Not run | |
| N8 | Maps semantic table/list conveys the information available visually | Not run | Not run | |
| N9 | MapLibre canvas does not trap browse/focus mode or emit misleading content | Not run | Not run | |
| N10 | Evidence summary metrics and headings are understandable in reading order | Not run | Not run | |
| N11 | Evidence tables expose caption, column headers and row headers correctly | Not run | Not run | |
| N12 | Claim boundary is encountered and understood as part of C2 evidence | Not run | Not run | |
| N13 | Search Lab comparison form is operable in focus mode | Not run | Not run | |
| N14 | `Running comparison` and completion announcements fire once | Not run | Not run | |
| N15 | Projection parity/warning state is announced before engine result interpretation | Not run | Not run | |
| N16 | Solr/OpenSearch sections expose distinct coherent heading structures | Not run | Not run | |
| N17 | Loading, empty, stale, partial-service and error states are announced | Not run | Not run | |
| N18 | No raw UUID/URL/debug identifier substitutes for a human-facing name where a label is expected | Not run | Not run | |

## JAWS results

Run with JAWS + Chrome where available. If a license/environment is unavailable, mark the entire section `N/A` and record the reason; do not infer a JAWS pass from NVDA.

| ID | Check | Result | Observation / issue |
| --- | --- | --- | --- |
| J1 | Virtual cursor reads the complete primary content | Not run | |
| J2 | Forms mode enters/exits search/filter controls correctly | Not run | |
| J3 | Heading/region/link lists expose meaningful names | Not run | |
| J4 | Status/alert regions announce once and at the appropriate time | Not run | |
| J5 | Dense Evidence tables remain understandable with table-navigation commands | Not run | |
| J6 | Search Lab form/results remain usable without switching to pointer interaction | Not run | |
| J7 | Maps equivalent list/table provides the meaningful nonvisual workflow | Not run | |

## Cognitive/workflow results

| ID | Check | Result | Observation / issue |
| --- | --- | --- | --- |
| C1 | Route purpose is clear from heading/lead text | Not run | |
| C2 | Applied filters/status are visible, understandable and reversible | Not run | |
| C3 | Errors explain what happened and the next available action | Not run | |
| C4 | Long operations expose progress/status | Not run | |
| C5 | Provenance makes live/stored/fixture/federated authority understandable | Not run | |
| C6 | Evidence distinguishes operational parity, descriptive timing and stronger inference | Not run | |
| C7 | Dense C2 tables do not require memorizing unexplained abbreviations/sign conventions | Not run | |
| C8 | Search Lab explains that local timings are diagnostic rather than universal performance claims | Not run | |

## Failures and remediation

Every failure gets a product defect before the evidence can be treated as complete.

| Check ID | Severity | Defect/PR | Failure | Remediation | Rerun commit/result |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

## Accepted limitations / N/A rationale

| Check / environment | Reason | Impact | Follow-up |
| --- | --- | --- | --- |
| | | | |

## Run conclusion

- Keyboard-only evidence: **Not run**
- NVDA Firefox: **Not run**
- NVDA Chrome/Chromium: **Not run**
- JAWS: **Not run**
- Maps equivalence: **Not run**
- Search Lab: **Not run**
- Evidence/C2 dense data: **Not run**
- Cognitive/workflow review: **Not run**

### Claim permitted by this run

> No manual accessibility claim is permitted until the applicable checks above have been performed and recorded. Automated evidence remains a separate evidence class.
