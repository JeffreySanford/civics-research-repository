# Manual Accessibility Validation Protocol

Status: protocol/template — no manual results are implied by this document

Automated axe, component, and Playwright checks are necessary evidence, but they do not establish that the assembled search journey is usable with real assistive technology, browser zoom, forced colors, or keyboard-only interaction. This protocol records those checks separately so automated and manual evidence are never conflated.

## Test record header

Complete this block for every session:

| Field | Value |
| --- | --- |
| Date / time | |
| Tester | |
| Branch / commit | |
| Application URL | |
| OS | |
| Browser + version | |
| Viewport / display scaling | |
| Assistive technology + version | |
| Input method | |
| Search corpus/profile | |
| Notes / known environmental limitations | |

Result values: **Pass**, **Fail**, **Blocked**, or **Not run**. A failure should reference a defect/issue or include enough reproduction detail to create one.

## Core scenario

Use the acceptance search:

`Where are people migrating from North Dakota to?`

Also run the lexical comparison:

`North Dakota migration`

The goal is not to prove that the current repository answers a structured migration question. It is to verify that the search interface, ranking/relevance explanation, result-type summary, pagination, and match-evidence disclosure are understandable and operable.

## Keyboard-only checklist

| Check | Expected behavior | Result | Evidence / notes |
| --- | --- | --- | --- |
| Reach search field | Visible focus indicator; label and purpose are clear. | | |
| Submit search | Enter/button activation works without pointer input. | | |
| Traverse result metadata | Reading/focus order follows visual/logical order. | | |
| Reach `Why this matched` | Summary is focusable and named. | | |
| Toggle match evidence | Enter/Space opens and closes the native disclosure; content follows it in reading order. | | |
| Reach pagination | Previous/Next names and disabled state are understandable. | | |
| Operate summary disclosure when present | Expanded/collapsed state is available and does not trap focus. | | |
| Focus visibility | Every interactive element has a clearly visible focus indication. | | |
| No keyboard trap | User can move into and out of every interactive region. | | |

Relevant WCAG targets include 2.1.1 Keyboard, 2.1.2 No Keyboard Trap, 2.4.3 Focus Order, 2.4.7 Focus Visible, and 4.1.2 Name, Role, Value.

## Zoom and reflow

Run with browser zoom rather than merely resizing the window.

| Check | Expected behavior | Result | Evidence / notes |
| --- | --- | --- | --- |
| 200% zoom | Text scales without clipping, overlap, or loss of controls. | | |
| 400% zoom / narrow reflow | Primary search/results remain usable without two-dimensional scrolling except where genuinely necessary. | | |
| Long result title/metadata | Content wraps without covering rank/relevance controls. | | |
| Match-evidence terms | Long field values/terms wrap inside the result card. | | |
| Search summary | Labels/counts remain readable and bars do not carry unique meaning. | | |

Primary targets: WCAG 1.4.4 Resize Text and 1.4.10 Reflow.

## Forced-colors / high-contrast

Use Windows High Contrast / `forced-colors` where available.

Verify:

- `Strong / Good / Moderate / Weak / Low` remains understandable from visible text when custom colors collapse;
- rank remains distinct from match strength;
- borders/focus indicators remain perceivable;
- result-type bars do not communicate information that is missing from adjacent text;
- disclosure and pagination controls remain distinguishable;
- selected/disabled states are not encoded only by background color.

Record screenshots only as supporting evidence; the test result must describe the observed behavior in words.

## Reduced motion

With the operating system/browser preference set to reduced motion:

- verify no required information depends on animation;
- verify any transitions do not prevent immediate operation;
- record any animation that should be disabled or shortened.

If the current surface has no meaningful motion, record that observation rather than marking the check silently complete.

## Screen-reader smoke test

Run at least one desktop screen reader before calling the core flow manually validated. Preferred environments for this federal-facing project are NVDA + Chrome/Firefox and, when available, JAWS + Chrome/Edge. VoiceOver can provide additional cross-platform evidence but should not be used to imply Windows AT coverage.

### Reading/interaction checks

| Check | Expected announcement/behavior | Result | Evidence / notes |
| --- | --- | --- | --- |
| Page/search landmark | Search purpose can be located without visual scanning. | | |
| Search field | Accessible name and current value are announced. | | |
| Search submission/loading | State change is understandable; note whether additional live-region work is needed. | | |
| Results heading/count | Result context and query are discoverable. | | |
| Rank vs match strength | User can tell that `Rank 1` and `Strong match` are different concepts. | | |
| Match badge | Text label is announced without dependence on color. | | |
| `Why this matched` | Disclosure role/state is announced; expanded content reads in a useful order. | | |
| Search summary | Counts and percentages are available as text; decorative bars do not add noise. | | |
| Pagination | Previous/Next names and disabled state are announced. | | |
| Empty browse | No relevance/match-evidence claim is announced for blank browse. | | |

## Defect record

For each failure capture:

- requirement ID from `requirements/mobile-search-traceability.md`;
- exact reproduction steps;
- expected result;
- observed result;
- AT/browser/OS versions;
- severity based on task impact;
- proposed remediation if known;
- retest commit and result after correction.

## Completion statement template

Do not write “508 compliant” or “WCAG compliant” solely from this protocol. A suitable evidence statement is:

> Manual accessibility checks were performed on commit `<sha>` using `<environment>`. The recorded protocol covers keyboard operation, zoom/reflow, forced colors, reduced motion, and `<screen reader>` for the tested search journey. Results and known limitations are recorded below/alongside this protocol.

If a category was not run, say so explicitly.
