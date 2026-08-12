# Accessibility Evidence Run — 2026-08-12 (automated baseline)

Date: 2026-08-12
Tester: Automated suite (Claude Code session)
Commit: 16c4c06
Browsers: Chromium, Firefox, WebKit (Playwright)
Assistive tech: **None used**
OS: Windows 11 (Docker Desktop)

## What this run is, and is not

This is an **automated baseline**, not a screen-reader run. No assistive technology was operated
and no human listened to speech output. Every result below was produced by machine assertion.

It exists because most checklist items decompose into a precondition a machine can verify and a
judgement only a human can make. "Headings are navigable with H" becomes "exactly one h1, no
skipped levels" (machine) plus "the outline helps someone find what they came for" (human). This
run settles the preconditions so a manual run spends its time on judgement.

**Passing this run is not evidence of screen-reader support.** The project's honest claim today
remains "an accessible equivalent is present and structurally sound", not "the application is
accessible to screen-reader users".

## Automated results

| Suite                    | Command                      | Checks | Result |
| ------------------------ | ---------------------------- | ------ | ------ |
| axe-core scans, 6 routes | `pnpm run wcag:report`       | 57     | Pass   |
| Section 508 tagged scans | `pnpm run section508:report` | 57     | Pass   |
| Structural accessibility | included in the two above    | 39     | Pass   |
| Demo storyboard          | `pnpm run storyboard`        | 72     | Pass   |

Structural checks now automated, per route (`/`, `/discovery`, `/datasets/{id}`, `/maps`,
`/admin/sync`, `/evidence`):

- Distinct page title per route (N1)
- Exactly one `h1`, first heading is the `h1`, no skipped levels (N2)
- Banner, navigation, and main landmarks present and named (N3)
- No positive `tabindex` anywhere (K1, K4)
- Every visible control has an accessible name resolved the way a screen reader resolves it —
  `aria-labelledby`, then `aria-label`, then associated or wrapping `<label>`, then `title`,
  then text — and no control is named with a bare URL or a UUID (K13, N19)

Interaction and state checks:

- Skip link is the first tab stop, targets `#main-content`, and the target is focusable (K5)
- Primary navigation marks the active route (N4)
- Facet buttons expose `aria-pressed` and update it on activation (K11, N6)
- Dataset tabs expose `tablist`/`tab`/`tabpanel` with correct `aria-selected` (K15, K17, N10)
- Map layer controls are labelled checkboxes carrying their own checked state (K21, N13)
- The accessible feature list contains every event the overlay returns, each with place and
  magnitude (N14, M1, M2 precondition)
- The map is exposed as a named region, and the legend as a named complementary region
- Map selection is announced through a `role="status"` live region (K30, N17)
- A failed sync surfaces as `role="alert"` (K31, N18)

## Findings

**1. The MapLibre canvas is a tab stop.** MapLibre sets `tabindex="0"` on its canvas so keyboard
users can pan and zoom. That is a feature for a sighted keyboard user and an open question for a
screen-reader user: focus lands on a canvas whose only name comes from the wrapping region. Whether
this is acceptable or merely confusing cannot be decided by machine. **Resolve under N16 and M12 in
the first NVDA run.**

**2. No `contentinfo` landmark.** The application has no footer. Not a violation, and axe does not
flag it under the configured rule sets, but a landmark list will look sparse to a screen-reader user
navigating by region. Consider whether attribution and non-affiliation text belong in one.

**3. Safari does not tab to links by default.** WebKit only moves focus to links when Safari's
full keyboard access preference is enabled, so the skip link — and every in-page link — is not
reachable by Tab for a default-configured Safari user. This is platform behavior rather than an
application defect, and it is why the skip-link check asserts DOM order and direct focus rather
than a Tab press. Worth stating in any accessibility conformance report, because a reviewer testing
on Safari will otherwise report the skip link as broken.

**4. Map-to-list selection is unverified.** Activating a feature on the canvas should move focus to
the matching list entry. It is implemented but cannot be asserted automatically: a WebGL hit test
needs trusted pointer events, and synthetic events do not reach MapLibre's handler. **This is the
single most important item for the first manual run — Checklist 4, item M12.**

## Still requiring a human

Nothing below has been run. These are the items that decide whether the application is usable, as
opposed to structurally sound.

| Checklist                  | Items  | Status                                                                         |
| -------------------------- | ------ | ------------------------------------------------------------------------------ |
| 1 — Keyboard only          | K1–K31 | Preconditions automated; the end-to-end mouse-free pass has not been performed |
| 2 — NVDA                   | N1–N20 | **Not run.** Requires NVDA and a human listener                                |
| 3 — JAWS                   | J1–J8  | **Not run.** Requires a JAWS license                                           |
| 4 — Map equivalence        | M1–M15 | M1, M2, M14, M15 preconditions automated; M3–M13 not run, M12 is the priority  |
| 5 — Cognitive and workflow | C1–C9  | **Not run.** Judgement only                                                    |

## Next run

The first genuine manual run should start with the three findings above, then Checklist 4 in full,
then NVDA. Record it as a new dated file in this directory rather than editing this one.
