# Open Census Metadata Profile Design Review Checklist

Use this checklist before implementation planning for issue #115.

## Scope and authority

- [ ] One `ResearchMetadataProfile` authority boundary drives every export.
- [ ] DSpace/application metadata remains authoritative for curated records.
- [ ] Federated publisher authority remains explicit for federated records.
- [ ] Solr/OpenSearch remain discovery projections only.
- [ ] No format renderer directly reconstructs authority from raw search documents.
- [ ] #114 version/provenance truth boundaries remain intact.

## Standards

- [ ] DataCite Metadata Schema version is pinned to 4.7.
- [ ] DataCite mandatory-property/readiness distinction is explicit.
- [ ] Missing DOI never becomes a local ID, URL, or DSpace handle.
- [ ] Schema.org JSON-LD type mapping is truthful per CRR resource type.
- [ ] DCAT-US version is pinned to 3.0.
- [ ] DCAT-US is dataset/data-service scoped rather than universal.
- [ ] DCAT-US 3.0 validation uses pinned JSON Schema 2020-12 definitions.
- [ ] Old `accessLevel` assumptions are not presented as DCAT-US 3.0 core semantics.

## Relations and versions

- [ ] `hasPart` → `HasPart` only where exact.
- [ ] `documents` → `Documents` only where exact.
- [ ] `isDerivedFrom` → `IsDerivedFrom` only where exact.
- [ ] generic `uses` is intentionally unmapped by default.
- [ ] DSpace-native lineage drives version relations.
- [ ] vintage/title/filename do not create history.
- [ ] source provenance remains separate from repository lineage.

## Restricted access

- [ ] Structured access mechanism is modeled.
- [ ] Authoritative access/application URL is modeled.
- [ ] Access instructions are modeled.
- [ ] Restriction basis is modeled only when known.
- [ ] LEHD restricted fixture remains metadata-only.
- [ ] No confidential file/download is introduced.
- [ ] No FSRDC/SAP authorization workflow is simulated.

## API

- [ ] Exact profile/export endpoints are documented.
- [ ] Content types are documented.
- [ ] malformed research ID → 400.
- [ ] unknown research object → 404.
- [ ] non-DCAT resource requested as DCAT → typed 409 `EXPORT_NOT_APPLICABLE`.
- [ ] DataCite non-registration-ready record remains truthfully exportable without fabricated fields.

## Human citation

- [ ] Retained authoritative citation wins when present.
- [ ] Fallback citation never invents author/year/DOI/version.
- [ ] BibTeX and RIS use the same normalized citation model.
- [ ] Formatting/escaping is deterministic and tested.

## Accessibility

- [ ] Cite / Export uses native buttons/links.
- [ ] Copy success is announced semantically.
- [ ] Copy failure is announced semantically.
- [ ] Focus remains logical after copy/export.
- [ ] Narrow/reflow layout is tested.
- [ ] JSON-LD is machine-readable without visible UI noise.
- [ ] Both desktop and mobile experiences are covered.

## Verification

- [ ] `pnpm metadata:validate` is a required PR 2+ CI gate.
- [ ] Profile unit tests include public/restricted/partial/versioned cases.
- [ ] DSpace APPLY → readback → DIFF `SKIP_ITEM` proof exists for new access fields.
- [ ] DataCite no-fake-DOI tests exist.
- [ ] DCAT-US JSON Schema validation exists.
- [ ] Schema.org structured-data tests exist.
- [ ] deterministic/golden output tests exist.
- [ ] OpenAPI/client drift gate remains green.
- [ ] Storybook + axe remains green.
- [ ] Chromium/Firefox/WebKit remain green.
- [ ] live Solr/OpenSearch remains green.
- [ ] MapLibre regression remains green.
- [ ] #114 DSpace provenance/version-lineage regression remains green.
- [ ] metadata evidence artifact is uploaded in CI.

## Documentation

- [ ] Final `documentation/open-census-metadata-profile.md` is complete.
- [ ] Final `documentation/metadata-export-verification.md` is complete.
- [ ] Field-by-field crosswalk records cardinality/requirement/loss notes.
- [ ] Standards versions and source references are explicit.
- [ ] DataCite export vs DOI registration distinction is explicit.
- [ ] DCAT dataset-scoping rationale is explicit.
- [ ] Restricted-access semantics are explained.
- [ ] Generated examples are deterministic and reviewed.

## Implementation slicing

- [ ] PR 1: profile foundation + structured access + DSpace idempotence.
- [ ] PR 2: renderers + OpenAPI + `metadata:validate` + evidence artifact.
- [ ] PR 3: desktop/mobile Cite / Export + JSON-LD DOM + browser evidence.
- [ ] #115 remains open until PR 3 and the complete issue-level verification matrix are green.
