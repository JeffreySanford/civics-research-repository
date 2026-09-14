# Metadata Export Verification Design

Status: **Companion verification contract for issue #115**  
Primary design: `documentation/open-census-metadata-profile-design.md`

## Purpose

This document defines the evidence required to prove the Open Census metadata-profile and structured-export work is correct.

It is intentionally separate from the architecture design because verification must remain operationally useful after implementation. When #115 is complete, this design document should evolve into the permanent `documentation/metadata-export-verification.md` runbook with exact commands and observed example output.

The central rule is:

> No standards/export capability is considered complete because a renderer returned JSON. Completion requires evidence that the JSON preserves CRR authority boundaries, validates where an external schema is available, remains deterministic, exposes no fabricated facts, behaves correctly for restricted metadata, and remains accessible through both Angular experiences.

---

## 1. Evidence classes

#115 requires six independent evidence classes.

### A. Authority evidence

Proves that every exported fact comes from the canonical CRR research-object/profile path rather than a search projection or format-specific lookup.

### B. Standards evidence

Proves that mappings match the pinned standard/version and that non-applicable mappings are rejected rather than coerced.

### C. Repository evidence

Proves new access metadata survives DSpace write/read/reconciliation and does not break #114 lineage semantics.

### D. Restricted-resource evidence

Proves metadata remains useful for a restricted object without exposing or implying a protected download or fake authorization flow.

### E. Accessibility evidence

Proves Cite / Export is operable and understandable by keyboard, assistive technology semantics, narrow/reflow layouts, and all required browsers.

### F. Regression evidence

Proves search, maps, DSpace provenance/version lineage, Storybook, generated clients, and the existing application remain healthy.

---

## 2. Canonical verification fixtures

Use stable committed fixtures so CI evidence is reviewable and reproducible.

Required fixture roles:

| Fixture role                | Intended proof                                                                 |
| --------------------------- | ------------------------------------------------------------------------------ |
| Public dataset              | DataCite-oriented mapping, Schema.org Dataset, DCAT-US Dataset + Distributions |
| DOI-bearing publication     | real DOI, creators/ORCID, DataCite registration-readiness path, no DCAT        |
| Restricted LEHD dataset     | FSRDC guidance, Title 13 statement, zero public downloads                      |
| Partial metadata object     | unknown facts remain absent and DataCite readiness fails explicitly            |
| Methodology object          | textual research output, documentation relationships, no DCAT                  |
| Project object              | DataCite Project + Schema.org ResearchProject, no DCAT                         |
| Code object                 | DataCite Software + Schema.org SoftwareSourceCode, no DCAT                     |
| Versioned TIGER/Line object | DSpace-native repository versions 2 → 1 remain truthful in export relations    |

The exact IDs must be recorded in the final runbook when implementation fixtures are finalized.

---

## 3. Required command surface

The implementation must provide a single deterministic standards validation command:

```bash
pnpm metadata:validate
```

That command must be suitable for both local use and CI.

It must fail non-zero when any required profile/export invariant fails.

It must not require a browser.

It must not depend on a mutable `latest` external schema URL during execution.

---

## 4. `metadata:validate` minimum checks

The command must prove all of the following.

### Profile invariants

- every fixture resolves to one canonical `ResearchMetadataProfile`;
- normalized output contains no renderer-specific property names;
- missing source facts remain absent;
- no current-clock timestamp is substituted for missing provenance;
- no DOI is generated;
- no ORCID is generated;
- no version relation is generated from vintage/title/filename inference.

### DataCite 4.7 invariants

- mandatory property readiness is assessed;
- actual DOI is used only when present;
- missing DOI produces `MISSING_DOI`;
- missing mandatory non-DOI metadata produces `MISSING_MANDATORY_METADATA`;
- creator + ORCID mapping is deterministic;
- resource type mapping is allowlisted;
- supported relation mappings are allowlisted;
- generic `uses` does not silently become a stronger DataCite relation;
- observed DSpace lineage produces version relationships only where direction is established.

### Schema.org invariants

- `@context` is `https://schema.org`;
- resource type is truthful;
- public dataset files become `DataDownload` only when they are real public distributions;
- restricted LEHD metadata has no `DataDownload`;
- `conditionsOfAccess` is emitted when access conditions are recorded;
- creator/ORCID identity is preserved;
- serialization is valid JSON and deterministic.

### DCAT-US 3.0 invariants

- DATASET fixtures are applicable;
- PUBLICATION, CODE, METHODOLOGY, SUPPORTING_MATERIAL, PROJECT are non-applicable;
- generated applicable documents validate against the pinned official DCAT-US 3.0 JSON Schema 2020-12 definitions;
- public distributions have appropriate access/download semantics;
- restricted dataset does not contain a direct confidential download;
- restrictions/access guidance are represented without reintroducing DCAT-US 1.1 `accessLevel` as a v3 core field.

### Citation invariants

- retained citation remains unchanged when authoritative;
- generated fallback never invents unknown author/year/DOI/version;
- BibTeX escapes special characters deterministically;
- RIS line structure is deterministic;
- all three citation forms draw from the same normalized citation model.

### Determinism invariants

Run representative renderers twice from identical input and assert byte-equivalent normalized output after any deliberately documented serialization normalization.

There must be no random identifiers and no render-time timestamps.

---

## 5. DSpace verification

The new structured access fields are repository-managed metadata and require the same rigor as #114 provenance fields.

Required proof sequence for the restricted LEHD fixture:

1. seed/source input contains structured FSRDC guidance;
2. APPLY writes `crr.access.*` metadata;
3. DSpace readback contains the exact expected values;
4. repository API profile exposes the same values;
5. DIFF immediately returns `SKIP_ITEM`;
6. no file is created for the restricted object;
7. no direct confidential download URL appears;
8. existing DSpace-native version-lineage proof remains green.

Any access field that is absent from the source must follow the repository's established missing-source/no-op semantics and must not accidentally erase unrelated repository evidence.

---

## 6. HTTP/API verification

For each export endpoint, verify:

- successful status;
- exact content type;
- canonical research identity;
- deterministic body;
- malformed ID → 400;
- unknown ID → 404.

Additional requirements:

### DataCite endpoint

- returns mapped metadata even when not registration-ready;
- carries readiness state;
- never uses local ID/source URL/DSpace handle as a fake DOI.

### Schema.org endpoint

- returns `application/ld+json`;
- body is valid JSON;
- body matches the profile used by the human page.

### DCAT-US endpoint

- DATASET → applicable output;
- non-data resource → 409 typed `EXPORT_NOT_APPLICABLE` response;
- restricted dataset remains metadata/access-guidance only.

### Text citation endpoints

- citation is text;
- BibTeX is deterministic;
- RIS is deterministic;
- no browser-specific formatting logic is required.

---

## 7. Angular verification

Both frontends require unit/component coverage for:

- profile/export loading;
- public dataset;
- publication;
- restricted dataset;
- partial metadata;
- DCAT applicable;
- DCAT non-applicable;
- copy success;
- copy failure;
- export network failure;
- route changes;
- stale export state clearing.

Schema.org JSON-LD tests must prove:

- one script exists for the current research object;
- script content corresponds to backend export/profile semantics;
- navigating to another research object replaces prior structured data;
- navigating away removes or replaces stale structured data;
- script is not visible UI content.

---

## 8. Storybook and axe verification

Required stories:

- public dataset Cite / Export;
- DOI-bearing publication;
- restricted dataset with FSRDC guidance;
- partial metadata;
- observed version history;
- citation-copy success;
- citation-copy error;
- export load error.

Every required story must pass the repository's axe gate.

---

## 9. Browser evidence

Required browsers:

- Chromium;
- Firefox;
- WebKit.

Required interactions:

1. navigate to research detail;
2. keyboard-tab to Cite / Export;
3. open/activate the export controls;
4. copy citation via keyboard;
5. observe semantic success status;
6. exercise a structured format action/link;
7. verify focus remains logical;
8. verify restricted-access guidance is reachable;
9. verify no keyboard trap;
10. verify narrow viewport/reflow does not create horizontal control overflow.

Copy failure must have a component/browser-level test using an intentionally failing clipboard mock and must expose an announced error state.

---

## 10. Live-stack evidence

CI must include real service-stack checks, not only fixture/unit assertions.

Minimum live evidence:

- repository API running against DSpace-backed catalog;
- one real public dataset export;
- one real restricted metadata-only export;
- one publication non-DCAT response;
- one DSpace-native versioned object showing observed lineage in profile/export semantics;
- Solr/OpenSearch live smoke remains green;
- export generation succeeds from authoritative application/DSpace path independent of search-index authority.

---

## 11. Required regression matrix

Every #115 PR must preserve:

| Gate                                   | Required    |
| -------------------------------------- | ----------- |
| repository API unit/integration tests  | yes         |
| OpenAPI lint                           | yes         |
| generated Java/TypeScript client drift | yes         |
| frontend lint                          | yes         |
| frontend unit tests                    | yes         |
| frontend build                         | yes         |
| Storybook interactions                 | yes         |
| axe                                    | yes         |
| live Solr/OpenSearch                   | yes         |
| Chromium evidence                      | yes         |
| Firefox evidence                       | yes         |
| WebKit evidence                        | yes         |
| MapLibre regression                    | yes         |
| DSpace provenance APPLY→DIFF           | yes         |
| DSpace-native version lineage          | yes         |
| `pnpm metadata:validate`               | PR 2 onward |

PR 1 must add its new profile/access tests to normal CI even though the full export validator arrives in PR 2.

---

## 12. CI evidence artifact

PR 2 onward uploads a metadata evidence artifact.

Required files:

```text
metadata-evidence/
  dataset-profile.json
  dataset-datacite.json
  dataset-schema-org.json
  dataset-dcat-us.json
  publication-profile.json
  publication-datacite.json
  publication-schema-org.json
  restricted-dataset-profile.json
  restricted-dataset-schema-org.json
  restricted-dataset-dcat-us.json
  validation-summary.json
```

`validation-summary.json` must contain at least:

- git SHA;
- DataCite schema version (`4.7`);
- DCAT-US version (`3.0`);
- fixture IDs;
- DataCite readiness result per fixture;
- DCAT applicability result per fixture;
- DCAT JSON Schema validation result;
- restricted-file/download assertion;
- deterministic-render assertion.

The artifact must contain metadata only. It must never contain protected microdata.

---

## 13. Manual local verification at milestone boundaries

Although CI is authoritative for merge gates, local verification is useful at the end of each PR slice.

The final runbook should provide copy/paste commands for:

- starting required Docker services;
- checking repository API health;
- fetching a canonical profile;
- fetching all export formats;
- running `pnpm metadata:validate`;
- running DSpace APPLY→DIFF for the restricted fixture;
- checking the restricted record contains zero public files;
- inspecting Schema.org JSON-LD in the browser DOM;
- running focused frontend tests;
- running the full repository verification suite.

Commands must state whether they mutate local DSpace state. Read-only probes should be clearly labeled read-only, following the discipline used during #114.

---

## 14. Failure triage rules

When a verification gate fails, do not weaken the standard/profile assertion simply to make CI green.

Triage order:

1. identify whether the failure is authority/model, renderer, schema, UI, or harness;
2. reproduce with the smallest focused test;
3. add/confirm a RED regression test for behavior defects;
4. apply the smallest semantic fix;
5. rerun the focused test;
6. rerun the relevant layer;
7. rerun full required gates before merge.

Specific forbidden shortcuts:

- do not generate a DOI to satisfy DataCite mandatory fields;
- do not add a fake creator/year to satisfy DataCite;
- do not turn a publication into a DCAT Dataset;
- do not add a dummy file to satisfy restricted-distribution expectations;
- do not map generic `uses` to a stronger relation merely to increase coverage;
- do not bypass DCAT JSON Schema validation;
- do not hide copy failure from assistive technology;
- do not disable #114 lineage/provenance regression jobs.

---

## 15. Completion evidence

#115 is verification-complete only when fresh evidence on the exact merge head proves:

- normal CI green;
- `metadata:validate` green;
- DSpace profile/access write-read-DIFF proof green;
- native version-lineage regression green;
- Storybook + axe green;
- live Solr/OpenSearch green;
- Chromium/Firefox/WebKit green;
- MapLibre regression green;
- metadata evidence artifact uploaded and internally consistent;
- final documentation accurately reflects the implemented behavior.

Only after that evidence is present should the final PR be marked ready and issue #115 be closed.
