# Mobile Search Usability Study Protocol

Status: study plan/template — contains no participant results

## Purpose

Use a small formative study to discover whether the mobile-first search interface communicates its search evidence clearly enough for real users to complete research-discovery tasks. This is not a statistically representative Census usability study and should never be reported as one.

A useful first round is **3–5 participants**. The value is qualitative: identify repeated confusion, task failures, misleading copy, or avoidable interaction cost, then make and document targeted changes.

## Research questions

1. Can a user submit a Census/research question and recognize the returned result context?
2. Can a user distinguish **rank** from **match strength** without being taught the underlying scoring model?
3. Does `Why this matched` help the user understand why a result was retrieved without implying that highlighted fields fully explain the score?
4. Can a user interpret the result-type summary as describing the entire matching result set rather than only the visible page?
5. Can a user continue through result pages without losing their understanding of the search context?

## Participant profile

Recruit ordinary research/search users rather than only developers. For the first formative round, record relevant experience without attempting demographic representativeness.

For each participant record only what is needed for interpretation, for example:

- familiarity with Census/federal data: none / occasional / frequent;
- general web-search confidence: low / medium / high;
- mobile-web confidence: low / medium / high;
- accessibility/assistive-technology context if voluntarily relevant to the session.

Do not include sensitive personal information that is unnecessary to the study.

## Session setup

- Use the same branch/commit for all participants in a round where practical.
- Record device/browser/viewport.
- Prefer the live repository-backed stack rather than a prototype if the current feature is stable.
- Start each participant from the same initial page state.
- Ask the participant to think aloud, but do not explain rank, relevance bands, or match evidence until a task is over.
- If the facilitator must intervene, record the intervention; do not count the task as unassisted success.

## Current tasks

### Task 1 — Find North Dakota migration research

Prompt:

> You want to find research or data related to people migrating from North Dakota. Use this page to start that search and identify a result you would investigate first.

Observe:

- query wording chosen;
- whether result context is understood;
- first result selected for investigation and why;
- whether broad repository records are mistaken for a direct demographic answer.

### Task 2 — Interpret rank and match strength

Prompt:

> Look at the first two results. Tell me what `Rank` and the match label mean to you, and whether you think they are the same thing.

Do not define the terms beforehand.

Observe:

- whether users read `Rank 1` as position/order rather than percentage/probability;
- whether `Strong match` is understood as relative search evidence;
- whether the explanatory copy is noticed;
- any language that creates false confidence.

### Task 3 — Explain why a result matched

Prompt:

> Without leaving the result list, find out why the first result matched the search. Tell me what evidence the interface gives you and what it does _not_ tell you.

Observe:

- discovery of the `Why this matched` disclosure;
- understanding of field labels and matched terms;
- whether users overinterpret the evidence as a complete scoring formula;
- whether disclosure length/noise is appropriate on mobile.

### Task 4 — Interpret the search snapshot and continue

Prompt:

> Use the search snapshot to describe the types of records in this search, then continue to the next available result page.

Observe:

- whether users understand counts as query-wide;
- whether bar + text presentation is clear without relying on color;
- whether pagination remains understandable after interacting with the summary/disclosures;
- whether primary results feel displaced by the summary on a small screen.

## Deferred tasks

Do **not** test these as implemented until the current branch actually supports them:

- filtering through the richer mobile filter-drawer interaction;
- reconstructing/sharing a search from URL state;
- focus restoration from the future filter drawer.

Once those features enter the current stack, add tasks such as “filter to a program” and “send a URL another user can open to reproduce this search.”

## Measures

For each task record:

| Measure                   | Allowed values / guidance                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| Completion                | Success / success with facilitator help / failure                                           |
| Time on task              | Approximate elapsed time; useful for within-round comparison, not performance certification |
| Wrong turns               | Count obvious reversals or actions that do not advance the task                             |
| Facilitator interventions | Count and describe                                                                          |
| Confidence                | Optional 1–5 self-rating after the task                                                     |
| Key quote/observation     | Short note in participant's own words when useful                                           |
| Accessibility barrier     | Yes / no + description                                                                      |

Do not average tiny-sample metrics into claims such as “95% usable.” A small formative study is best reported as task outcomes, repeated patterns, and resulting design changes.

## Observation sheet

| Participant | Task | Outcome | Time | Wrong turns | Intervention | Observation / quote | Candidate change |
| ----------- | ---- | ------- | ---- | ----------- | ------------ | ------------------- | ---------------- |
|             |      |         |      |             |              |                     |                  |

## Synthesis

After the round:

1. Group observations by repeated issue rather than participant identity.
2. Separate clear defects from preferences.
3. Link each accepted change to a requirement ID where possible.
4. Prioritize issues that block task completion or create misleading interpretations of search evidence.
5. Implement the smallest justified change.
6. Repeat affected tasks in a later round or targeted retest.

A useful findings table is:

| Finding | Participants affected | Task impact | Evidence | Change | Retest status |
| ------- | --------------------: | ----------- | -------- | ------ | ------------- |
|         |                       |             |          |        |               |

## Reporting guardrails

- Never fabricate participants, quotes, completion times, or findings.
- Keep raw observations distinct from interpretation.
- State the sample size and recruitment limitations.
- Do not imply that formative testing represents all Census users.
- Do not call the interface accessible solely because participants without disabilities completed tasks.
- Keep manual accessibility testing documented under the separate accessibility protocol.

## Exit criterion for the first round

The first study has done its job when it produces one of two evidence-backed outcomes:

- concrete usability changes with documented reasons; or
- no high-impact issue observed in the tested tasks, with the small sample limitation stated explicitly.

Either outcome is valid. The study is evidence gathering, not a requirement to manufacture redesign work.
