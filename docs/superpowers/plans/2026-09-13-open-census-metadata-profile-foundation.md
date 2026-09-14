# Open Census Metadata Profile Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build PR 1 of issue #115: a lossless, testable metadata-profile foundation that carries structured access guidance and all existing research-object semantics through catalog/source → DSpace → repository API → one normalized `ResearchMetadataProfile`, with replay-safe verification and no fabricated facts.

**Architecture:** Keep DSpace/application metadata authoritative for curated records and publisher data authoritative for federated records. Extend the existing normalized source/detail models only where facts are currently missing, persist structured access guidance as managed `crr.*` metadata, and assemble one backend `ResearchMetadataProfile` from `ResearchObjectDetail` plus observed `ResearchArtifactVersionHistory`. Do not add DataCite/Schema.org/DCAT renderers or Cite/Export UI in this PR; those consume this foundation in PRs 2 and 3.

**Tech Stack:** Java 21 / Spring Boot, OpenAPI 3.1 + generated Java/TypeScript DTOs, DSpace 9 REST + SAF, Nx, pnpm 10.14, Node 22 test runner, JUnit 5, Docker Compose.

**Spec:** `documentation/open-census-metadata-profile-design.md`

**Verification contract:** `documentation/metadata-export-verification-design.md`

## Global Constraints

- DataCite target is Metadata Schema **4.7**; this PR prepares facts/readiness inputs but does not render DataCite yet.
- Schema.org structured output and DCAT-US 3.0 output are PR 2; do not leak format-specific property names into `ResearchMetadataProfile`.
- DSpace/application metadata remains authoritative for curated repository records.
- Federated publishers remain authoritative for federated records.
- Solr/OpenSearch remain discovery projections and must not be queried by the profile assembler.
- Missing source facts mean unknown/no opinion. Never synthesize DOI, ORCID, release year, version lineage, checksum, capture time, or access facts.
- `vintageYear` does not establish artifact version history.
- DSpace-native version history remains the only repository lineage authority when it is available.
- Restricted metadata must never imply a local/protected file, direct confidential download, or authorization workflow.
- New DSpace access fields must obey the existing APPLY → readback → DIFF `SKIP_ITEM` reconciliation contract.
- Preserve the existing repository-augmented-field rule for `dc.identifier.uri`; DSpace handles are allowed extras and the publisher URI remains required.
- Do not alter browser/map behavior in PR 1 except generated TypeScript types caused by the OpenAPI contract.
- `tools/scripts/dspace-version-lineage.test.mjs` may exist as an untracked local file in the developer checkout; never clean or overwrite unrelated untracked files.

---

## File/Responsibility Map

### New backend domain files

- `apps/repository-api/src/main/java/org/civicsrepo/metadata/ResearchAccessGuidance.java` — source/application-neutral structured access facts.
- `apps/repository-api/src/main/java/org/civicsrepo/metadata/ResearchMetadataProfile.java` — normalized export/profile authority; no DataCite/Schema.org/DCAT names.
- `apps/repository-api/src/main/java/org/civicsrepo/metadata/ResearchMetadataProfileAssembler.java` — assembles one profile from detail + observed version history.
- `apps/repository-api/src/test/java/org/civicsrepo/metadata/ResearchMetadataProfileAssemblerTest.java` — representative profile behavior and no-fabrication tests.

### Existing source/sync files

- `apps/repository-api/src/main/java/org/civicsrepo/sources/ResearchObjectMetadata.java` — carry optional structured access guidance without breaking existing adapters.
- `apps/repository-api/src/main/java/org/civicsrepo/sources/CatalogMetadataReader.java` — stop collapsing every catalog object to `dataset(...)`; parse the full generated catalog faithfully.
- `apps/repository-api/src/test/java/org/civicsrepo/sources/CatalogMetadataReaderTest.java` — full-fidelity catalog parsing and no-current-clock tests.
- `apps/repository-api/src/main/java/org/civicsrepo/dspace/DspaceManagedFields.java` — register managed access guidance fields.
- `apps/repository-api/src/main/java/org/civicsrepo/dspace/DspaceItemPayloadMapper.java` — write structured access guidance and tolerate absent release dates.
- `apps/repository-api/src/test/java/org/civicsrepo/dspace/DspaceItemPayloadMapperTest.java` — source → DSpace payload coverage.

### Existing repository read files

- `apps/repository-api/src/main/java/org/civicsrepo/repository/RepositoryObjectMapper.java` — read `crr.access.*`, documentation URL, geographic level, and subjects into detail.
- `apps/repository-api/src/test/java/org/civicsrepo/repository/RepositoryObjectMapperTest.java` — repository → detail verification.
- `apps/repository-api/src/main/java/org/civicsrepo/repository/FixtureCatalog.java` — map the generated fallback catalog to the same detail shape.
- `apps/repository-api/src/test/java/org/civicsrepo/repository/FixtureCatalogTest.java` — fixture parity verification.

### DSpace/catalog files

- `tools/dspace/crr-types.xml` — register `crr.access.mechanism`, `crr.access.url`, `crr.access.instructions`, `crr.access.restrictionbasis`.
- `tools/dspace/catalog.json` — add explicit structured FSRDC guidance to `lehd-microdata-restricted`.
- `tools/scripts/generate-saf.mjs` — write/read the new catalog properties into SAF and generated fixture JSON.
- `tools/scripts/check-fixture-catalog.mjs` — unchanged unless its snapshot contract needs an explicit new assertion.
- `apps/repository-api/src/main/resources/discovery-fixture-catalog.json` — regenerated output; never hand-edit.

### API/generated contract files

- `schemas/openapi/repository-api.yaml` — add `ResearchAccessGuidance` plus optional detail fields needed by the normalized profile: documentation URL, geographic level, subjects, and access guidance.
- `libs/repository/api-client/src/generated/repository-api.types.ts` — regenerate only through `pnpm openapi:generate`.
- `libs/repository/api-client/src/lib/repository-api-client.spec.ts` — generated-contract smoke test updates.

### Verification/docs files

- `tools/scripts/metadata-profile-contract.test.mjs` — committed catalog/profile input invariants that are fast and browser-free.
- `tools/scripts/dspace-access-guidance-idempotence.mjs` — real DSpace restricted-object APPLY/readback/DIFF proof.
- `package.json` — introduce `metadata:validate` for the foundation and extend it in PR 2.
- `.github/workflows/ci.yml` — run metadata validation and DSpace access-guidance replay in CI.
- `documentation/open-science-research-objects.md` — document new managed fields and authority semantics.
- `documentation/open-census-metadata-profile-design.md` — update only if implementation exposes a verified design correction; do not rewrite the design to match accidental code.
- `documentation/metadata-export-verification-design.md` — evolve PR-1 sections from design wording to exact commands/evidence where proven.

---

### Task 1: Extend the API detail contract with structured access/profile inputs

**Files:**
- Modify: `schemas/openapi/repository-api.yaml`
- Regenerate: `libs/repository/api-client/src/generated/repository-api.types.ts`
- Modify test: `libs/repository/api-client/src/lib/repository-api-client.spec.ts`

**Interfaces:**
- Produces OpenAPI schema `ResearchAccessGuidance` with optional `mechanism`, `accessUrl`, `instructions`, `restrictionBasis` strings.
- Extends `ResearchObjectDetail` with optional `documentationUrl`, optional `geographicLevel`, required `subjects: string[]`, and optional `accessGuidance: ResearchAccessGuidance`.
- Later tasks consume generated Java DTO `ResearchAccessGuidance` and TypeScript `components['schemas']['ResearchAccessGuidance']`.

- [ ] **Step 1: Write the failing generated-client contract test**

Add a detail fixture in `repository-api-client.spec.ts` that includes the new fields and asserts they survive the typed client response:

```ts
const detail: ResearchObjectDetail = {
  // existing required fields unchanged
  ...existingDetail,
  documentationUrl: 'https://www.census.gov/about/adrm/fsrdc.html',
  geographicLevel: 'National',
  subjects: ['LEHD', 'Restricted use', 'Title 13'],
  accessGuidance: {
    mechanism: 'FSRDC',
    accessUrl: 'https://www.census.gov/about/adrm/fsrdc.html',
    instructions:
      'Access requires an approved research proposal and Special Sworn Status.',
    restrictionBasis: 'Title 13, U.S. Code',
  },
};
```

Assert `result.accessGuidance?.mechanism === 'FSRDC'` and `result.subjects` contains `Title 13`.

- [ ] **Step 2: Run the client test and confirm RED**

Run:

```bash
pnpm nx test repository-api-client --runInBand
```

Expected: TypeScript compile/test failure because the generated `ResearchObjectDetail` type does not yet expose the new fields.

- [ ] **Step 3: Add the exact OpenAPI schemas**

Add:

```yaml
ResearchAccessGuidance:
  type: object
  additionalProperties: false
  properties:
    mechanism:
      type: string
    accessUrl:
      type: string
      format: uri
    instructions:
      type: string
    restrictionBasis:
      type: string
```

Extend `ResearchObjectDetail.properties` with:

```yaml
documentationUrl:
  type: string
  format: uri
geographicLevel:
  type: string
subjects:
  type: array
  items:
    type: string
accessGuidance:
  $ref: '#/components/schemas/ResearchAccessGuidance'
```

Add `subjects` to `ResearchObjectDetail.required`; keep the other new fields optional because unknown facts must remain absent.

- [ ] **Step 4: Regenerate and verify contract drift is clean**

Run:

```bash
pnpm openapi:lint
pnpm openapi:generate
pnpm openapi:check
pnpm nx test repository-api-client --runInBand
```

Expected: all PASS.

- [ ] **Step 5: Commit the contract slice**

```bash
git add schemas/openapi/repository-api.yaml \
  libs/repository/api-client/src/generated/repository-api.types.ts \
  libs/repository/api-client/src/lib/repository-api-client.spec.ts
git commit -m "feat(metadata): extend research detail profile inputs"
```

---

### Task 2: Make catalog/source metadata full-fidelity and remove current-clock fabrication

**Files:**
- Create: `apps/repository-api/src/main/java/org/civicsrepo/metadata/ResearchAccessGuidance.java`
- Modify: `apps/repository-api/src/main/java/org/civicsrepo/sources/ResearchObjectMetadata.java`
- Modify: `apps/repository-api/src/main/java/org/civicsrepo/sources/CatalogMetadataReader.java`
- Test: `apps/repository-api/src/test/java/org/civicsrepo/sources/CatalogMetadataReaderTest.java`

**Interfaces:**
- `ResearchAccessGuidance(String mechanism, String accessUrl, String instructions, String restrictionBasis)` is a normalized fact record; every component may be null independently.
- `ResearchObjectMetadata` gains final optional component `ResearchAccessGuidance accessGuidance` after `versionProvenance`.
- Existing compatibility/dataset constructors continue to compile and pass `null` for access guidance.
- `CatalogMetadataReader` must construct full `ResearchObjectMetadata`, not call `ResearchObjectMetadata.dataset(...)` for all records.

- [ ] **Step 1: Write failing restricted-object and publication tests**

In `CatalogMetadataReaderTest`, assert that `forProgram(ResearchProgram.LEHD)` contains `lehd-microdata-restricted` with:

```java
assertThat(restricted.contentType()).isEqualTo(ResearchObjectType.DATASET);
assertThat(restricted.accessLevel()).isEqualTo(AccessLevel.RESTRICTED);
assertThat(restricted.files()).isEmpty();
assertThat(restricted.accessGuidance().mechanism()).isEqualTo("FSRDC");
assertThat(restricted.accessGuidance().restrictionBasis()).isEqualTo("Title 13, U.S. Code");
```

Also select a known publication fixture and assert its `contentType`, DOI/authors/relations are not collapsed to dataset defaults.

Add a package-private parse test for invalid/blank `releasedOn` input and assert the reader returns `null`, not `LocalDate.now()`.

- [ ] **Step 2: Run repository-api tests and confirm RED**

Run:

```bash
pnpm nx test repository-api
```

Expected: new assertions fail because the current reader uses `ResearchObjectMetadata.dataset(...)` and substitutes `LocalDate.now()`.

- [ ] **Step 3: Add the normalized access record and compatibility wiring**

Create:

```java
package org.civicsrepo.metadata;

public record ResearchAccessGuidance(
        String mechanism,
        String accessUrl,
        String instructions,
        String restrictionBasis) {}
```

Add `ResearchAccessGuidance accessGuidance` to `ResearchObjectMetadata`; preserve every existing constructor by delegating with `null` for the new final component.

- [ ] **Step 4: Replace dataset-only catalog parsing with full parsing**

`CatalogMetadataReader.toMetadata(...)` must parse:

```java
new ResearchObjectMetadata(
    text(item, "id"),
    text(item, "title"),
    program,
    text(item, "publisher"),
    text(item, "summary"),
    text(item, "geography"),
    text(item, "geographyLevel"),
    integerOrNull(item, "vintageYear"),
    releasedOn(text(item, "releasedOn")),
    text(item, "sourceUrl"),
    text(item, "documentationUrl"),
    text(item, "citation"),
    files(item),
    contentType(item),
    accessLevel(item),
    textOrNull(item, "accessNote"),
    textOrNull(item, "license"),
    textOrNull(item, "doi"),
    authors(item),
    relations(item),
    null,
    accessGuidance(item));
```

Do not reuse `LocalDate.now()` as an error fallback:

```java
private LocalDate releasedOn(String value) {
    if (value == null || value.isBlank()) {
        return null;
    }
    try {
        return LocalDate.parse(value);
    } catch (DateTimeParseException exception) {
        LOGGER.warn("Invalid catalog release date {}; leaving it unknown.", value);
        return null;
    }
}
```

The generated committed catalog contains valid release dates, so normal DSpace sync remains non-null in practice; Task 4 updates the payload mapper to be null-safe by contract.

- [ ] **Step 5: Run tests and verify GREEN**

Run:

```bash
pnpm nx test repository-api
```

Expected: PASS including restricted/full-fidelity/no-clock cases.

- [ ] **Step 6: Commit**

```bash
git add apps/repository-api/src/main/java/org/civicsrepo/metadata/ResearchAccessGuidance.java \
  apps/repository-api/src/main/java/org/civicsrepo/sources/ResearchObjectMetadata.java \
  apps/repository-api/src/main/java/org/civicsrepo/sources/CatalogMetadataReader.java \
  apps/repository-api/src/test/java/org/civicsrepo/sources/CatalogMetadataReaderTest.java
git commit -m "fix(metadata): preserve catalog research semantics"
```

---

### Task 3: Author structured FSRDC guidance in the catalog and generated SAF

**Files:**
- Modify: `tools/dspace/catalog.json`
- Modify: `tools/scripts/generate-saf.mjs`
- Modify: `tools/dspace/crr-types.xml`
- Regenerate: `apps/repository-api/src/main/resources/discovery-fixture-catalog.json`
- Create test: `tools/scripts/metadata-profile-contract.test.mjs`

**Interfaces:**
- Catalog object `lehd-microdata-restricted` gains:

```json
"accessGuidance": {
  "mechanism": "FSRDC",
  "accessUrl": "https://www.census.gov/about/adrm/fsrdc.html",
  "instructions": "Access requires an approved research proposal and Special Sworn Status through a Federal Statistical Research Data Center.",
  "restrictionBasis": "Title 13, U.S. Code"
}
```

- SAF uses exact managed fields:
  - `crr.access.mechanism`
  - `crr.access.url`
  - `crr.access.instructions`
  - `crr.access.restrictionbasis`

- [ ] **Step 1: Write the RED catalog contract test**

Create `metadata-profile-contract.test.mjs` using Node's built-in test runner. Read `tools/dspace/catalog.json` and assert:

```js
assert.equal(restricted.access, 'RESTRICTED');
assert.deepEqual(restricted.files, []);
assert.equal(restricted.accessGuidance.mechanism, 'FSRDC');
assert.match(restricted.accessGuidance.accessUrl, /^https:\/\/www\.census\.gov\//);
assert.match(restricted.accessGuidance.restrictionBasis, /Title 13/);
```

Also assert every PUBLIC object either has no `accessGuidance` or has no restrictive mechanism, preventing accidental restricted copy on public records.

- [ ] **Step 2: Run and confirm RED**

```bash
node --test tools/scripts/metadata-profile-contract.test.mjs
```

Expected: FAIL because `accessGuidance` does not exist yet.

- [ ] **Step 3: Add catalog guidance and DSpace schema registrations**

Add the exact catalog object above. Register four `dc-type` entries in `crr-types.xml`, each with scope notes explicitly saying they are access/discovery guidance and do not grant authorization.

- [ ] **Step 4: Extend SAF generation**

`buildResearchObject(entry)` carries `accessGuidance: entry.accessGuidance ?? null`.

In `writeItem(item)` add:

```js
if (item.accessGuidance?.mechanism) {
  crr += dcvalue('access', 'mechanism', item.accessGuidance.mechanism);
}
if (item.accessGuidance?.accessUrl) {
  crr += dcvalue('access', 'url', item.accessGuidance.accessUrl);
}
if (item.accessGuidance?.instructions) {
  crr += dcvalue('access', 'instructions', item.accessGuidance.instructions);
}
if (item.accessGuidance?.restrictionBasis) {
  crr += dcvalue(
    'access',
    'restrictionbasis',
    item.accessGuidance.restrictionBasis,
  );
}
```

When writing `discovery-fixture-catalog.json`, include `accessGuidance: item.accessGuidance` so fixture/source/read paths share one input.

- [ ] **Step 5: Regenerate and verify deterministic fixture parity**

Run:

```bash
pnpm dspace:saf:generate
pnpm fixture:check
node --test tools/scripts/metadata-profile-contract.test.mjs
```

Expected: PASS. Confirm `git diff -- apps/repository-api/src/main/resources/discovery-fixture-catalog.json` contains only deterministic generated changes.

- [ ] **Step 6: Commit**

```bash
git add tools/dspace/catalog.json tools/dspace/crr-types.xml \
  tools/scripts/generate-saf.mjs \
  tools/scripts/metadata-profile-contract.test.mjs \
  apps/repository-api/src/main/resources/discovery-fixture-catalog.json
git commit -m "feat(metadata): model structured restricted access"
```

---

### Task 4: Persist structured access guidance through sync without breaking reconciliation

**Files:**
- Modify: `apps/repository-api/src/main/java/org/civicsrepo/dspace/DspaceManagedFields.java`
- Modify: `apps/repository-api/src/main/java/org/civicsrepo/dspace/DspaceItemPayloadMapper.java`
- Modify test: `apps/repository-api/src/test/java/org/civicsrepo/dspace/DspaceItemPayloadMapperTest.java`
- Modify test: `apps/repository-api/src/test/java/org/civicsrepo/dspace/DspaceItemDiffPlannerTest.java`
- Modify test: `apps/repository-api/src/test/java/org/civicsrepo/dspace/DspaceRestItemWriteGatewayTest.java`

**Interfaces:**
- `DspaceManagedFields` adds constants:

```java
ACCESS_MECHANISM_FIELD = "crr.access.mechanism";
ACCESS_URL_FIELD = "crr.access.url";
ACCESS_INSTRUCTIONS_FIELD = "crr.access.instructions";
ACCESS_RESTRICTION_BASIS_FIELD = "crr.access.restrictionbasis";
```

and includes all four in `ALL`.

- [ ] **Step 1: Add RED payload assertions**

Construct restricted `ResearchObjectMetadata` with `ResearchAccessGuidance` and assert the payload contains the four exact fields once each.

Add a public/no-guidance case asserting none of the four fields are emitted.

Add a null-release-date case asserting `dc.date.issued` is omitted rather than throwing or using the current date.

- [ ] **Step 2: Run tests and confirm RED**

```bash
pnpm nx test repository-api
```

Expected: payload test fails on missing fields; null-date case fails on `metadata.releasedOn().format(...)`.

- [ ] **Step 3: Implement minimal managed-field/payload support**

Add constants to `DspaceManagedFields.ALL`.

Change required-field map construction so release date is inserted through `putIfPresent`:

```java
putIfPresent(
    fields,
    "dc.date.issued",
    metadata.releasedOn() == null
        ? null
        : metadata.releasedOn().format(DateTimeFormatter.ISO_LOCAL_DATE));
```

For guidance:

```java
ResearchAccessGuidance access = metadata.accessGuidance();
if (access != null) {
    putIfPresent(fields, DspaceManagedFields.ACCESS_MECHANISM_FIELD, access.mechanism());
    putIfPresent(fields, DspaceManagedFields.ACCESS_URL_FIELD, access.accessUrl());
    putIfPresent(fields, DspaceManagedFields.ACCESS_INSTRUCTIONS_FIELD, access.instructions());
    putIfPresent(
        fields,
        DspaceManagedFields.ACCESS_RESTRICTION_BASIS_FIELD,
        access.restrictionBasis());
}
```

Do not add any of these to `REPOSITORY_AUGMENTED_FIELDS`; DSpace does not own or append them.

- [ ] **Step 4: Add diff/write regression assertions**

In planner/write-gateway tests prove:

1. exact matching guidance yields `SKIP_ITEM` / no patches;
2. changed `accessUrl` yields one managed-field update;
3. source guidance absent follows existing no-op semantics and does not clear richer repository guidance.

- [ ] **Step 5: Run tests and verify GREEN**

```bash
pnpm nx test repository-api
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/repository-api/src/main/java/org/civicsrepo/dspace/DspaceManagedFields.java \
  apps/repository-api/src/main/java/org/civicsrepo/dspace/DspaceItemPayloadMapper.java \
  apps/repository-api/src/test/java/org/civicsrepo/dspace/DspaceItemPayloadMapperTest.java \
  apps/repository-api/src/test/java/org/civicsrepo/dspace/DspaceItemDiffPlannerTest.java \
  apps/repository-api/src/test/java/org/civicsrepo/dspace/DspaceRestItemWriteGatewayTest.java
git commit -m "feat(dspace): persist structured access guidance"
```

---

### Task 5: Read the same profile inputs from DSpace and fixture detail paths

**Files:**
- Modify: `apps/repository-api/src/main/java/org/civicsrepo/repository/RepositoryObjectMapper.java`
- Modify: `apps/repository-api/src/main/java/org/civicsrepo/repository/FixtureCatalog.java`
- Modify test: `apps/repository-api/src/test/java/org/civicsrepo/repository/RepositoryObjectMapperTest.java`
- Modify test: `apps/repository-api/src/test/java/org/civicsrepo/repository/FixtureCatalogTest.java`

**Interfaces:**
- Both repository-backed and fixture-backed `ResearchObjectDetail` expose the same fields:
  - `documentationUrl`
  - `geographicLevel`
  - `subjects`
  - `accessGuidance`
- Unknown values remain null/empty; invalid restrictive data never defaults to PUBLIC.

- [ ] **Step 1: Write RED repository-mapper test**

Build a `DspaceItem` containing:

```text
crr.documentation.url=https://www.census.gov/about/adrm/fsrdc.html
crr.geography.level=National
dc.subject=LEHD
dc.subject=Restricted use
crr.access.mechanism=FSRDC
crr.access.url=https://www.census.gov/about/adrm/fsrdc.html
crr.access.instructions=Access requires an approved research proposal...
crr.access.restrictionbasis=Title 13, U.S. Code
```

Assert mapped detail contains the exact fields and no file is introduced.

- [ ] **Step 2: Write RED fixture parity test**

Read `lehd-microdata-restricted` from `FixtureCatalog` and assert the same detail values as the repository mapper case.

- [ ] **Step 3: Run and confirm RED**

```bash
pnpm nx test repository-api
```

Expected: new detail assertions fail.

- [ ] **Step 4: Implement repository mapping**

Use existing `firstValue`/metadata helpers. Build generated DTO guidance only if at least one structured access value exists:

```java
private ResearchAccessGuidance accessGuidance(DspaceItem item) {
    String mechanism = firstValue(item, DspaceManagedFields.ACCESS_MECHANISM_FIELD).orElse(null);
    String accessUrl = firstValue(item, DspaceManagedFields.ACCESS_URL_FIELD).orElse(null);
    String instructions = firstValue(item, DspaceManagedFields.ACCESS_INSTRUCTIONS_FIELD).orElse(null);
    String restrictionBasis = firstValue(item, DspaceManagedFields.ACCESS_RESTRICTION_BASIS_FIELD).orElse(null);
    if (Stream.of(mechanism, accessUrl, instructions, restrictionBasis).allMatch(Objects::isNull)) {
        return null;
    }
    return new ResearchAccessGuidance()
        .mechanism(mechanism)
        .accessUrl(accessUrl == null ? null : URI.create(accessUrl))
        .instructions(instructions)
        .restrictionBasis(restrictionBasis);
}
```

Use the generated DTO class name produced by Task 1; if the Java generator models `accessUrl` as `URI`, retain that type rather than converting back to string.

Map `dc.subject` as a list without inventing values.

- [ ] **Step 5: Implement fixture parity**

Parse the same JSON `accessGuidance` object in `FixtureCatalog`. Set `subjects(textList(item.path("subjects")))`, `documentationUrl`, `geographicLevel`, and `accessGuidance` on `ResearchObjectDetail`.

- [ ] **Step 6: Run tests and verify GREEN**

```bash
pnpm nx test repository-api
pnpm openapi:check
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/repository-api/src/main/java/org/civicsrepo/repository/RepositoryObjectMapper.java \
  apps/repository-api/src/main/java/org/civicsrepo/repository/FixtureCatalog.java \
  apps/repository-api/src/test/java/org/civicsrepo/repository/RepositoryObjectMapperTest.java \
  apps/repository-api/src/test/java/org/civicsrepo/repository/FixtureCatalogTest.java
git commit -m "feat(metadata): expose profile inputs from repository"
```

---

### Task 6: Introduce the normalized `ResearchMetadataProfile` authority boundary

**Files:**
- Create: `apps/repository-api/src/main/java/org/civicsrepo/metadata/ResearchMetadataProfile.java`
- Create: `apps/repository-api/src/main/java/org/civicsrepo/metadata/ResearchMetadataProfileAssembler.java`
- Create test: `apps/repository-api/src/test/java/org/civicsrepo/metadata/ResearchMetadataProfileAssemblerTest.java`
- Modify: `apps/repository-api/src/main/java/org/civicsrepo/research/ResearchObjectService.java`
- Modify test: `apps/repository-api/src/test/java/org/civicsrepo/research/ResearchObjectServiceTest.java`

**Interfaces:**
- `ResearchMetadataProfile` contains normalized facts only. Recommended decomposition:

```java
public record ResearchMetadataProfile(
    String id,
    ResearchObjectType type,
    String title,
    String abstractText,
    String publisher,
    ResearchProgram program,
    String citation,
    String doi,
    URI sourceUrl,
    URI documentationUrl,
    String geography,
    String geographicLevel,
    Integer vintageYear,
    LocalDate releasedOn,
    List<String> subjects,
    List<ResearchAuthor> authors,
    AccessLevel accessLevel,
    String accessNote,
    String license,
    org.civicsrepo.generated.dto.ResearchAccessGuidance accessGuidance,
    List<DatasetFile> files,
    List<ResearchRelation> relations,
    ResearchArtifactVersionHistory versionHistory) {}
```

If reusing generated DTOs inside the profile makes equality/testing awkward, introduce small immutable profile-owned records for author/file/relation/access instead. The non-negotiable rule is that renderers in PR 2 receive one profile object and do not re-read DSpace/search/fixture state themselves.

- `ResearchMetadataProfileAssembler.assemble(ResearchObjectDetail detail, ResearchArtifactVersionHistory versions)` returns a deterministic immutable profile.
- `ResearchObjectService.getResearchMetadataProfile(String researchIdToken)` resolves detail and version history through existing authority paths, then delegates to the assembler. It is internal service API in PR 1; no HTTP export endpoint yet.

- [ ] **Step 1: Write RED profile tests for representative object classes**

Cover at minimum:

1. public dataset;
2. DOI-bearing publication with author + ORCID;
3. methodology object;
4. project object;
5. code object;
6. restricted LEHD dataset with zero files;
7. versioned TIGER object with `HISTORY_AVAILABLE` 2 → 1;
8. partial metadata object.

Assertions must include:

```java
assertThat(profile.doi()).isNull(); // when absent; never fabricated
assertThat(profile.versionHistory().getStatus()).isEqualTo(HISTORY_AVAILABLE);
assertThat(profile.accessGuidance().getMechanism()).isEqualTo("FSRDC");
assertThat(profile.files()).isEmpty(); // restricted object
```

For the partial object, assert unknown ORCID/DOI/documentation/access guidance stay absent. Do not assert fallback strings like `Unknown`.

- [ ] **Step 2: Add determinism/no-inference RED tests**

Assemble the same detail/history twice and assert equality. Also create a detail with `vintageYear=2025` but singleton version history and assert the profile retains singleton history; it must not create an inferred 2024/previous version.

- [ ] **Step 3: Run and confirm RED**

```bash
pnpm nx test repository-api
```

Expected: classes/methods do not exist.

- [ ] **Step 4: Implement the immutable profile and assembler**

The assembler performs copying/normalization only. It must not call repositories, clocks, search indexes, network services, DOI resolvers, or ORCID services.

Use `List.copyOf(...)` for collection components and preserve null as unknown.

- [ ] **Step 5: Wire the service authority path**

Inject `ResearchMetadataProfileAssembler` into `ResearchObjectService` and add:

```java
public ResearchMetadataProfile getResearchMetadataProfile(String researchIdToken) {
    ResearchObjectDetail detail = getResearchObject(researchIdToken);
    ResearchArtifactVersionHistory versions = getResearchObjectVersionHistory(researchIdToken);
    return researchMetadataProfileAssembler.assemble(detail, versions);
}
```

Do not create a controller route yet. PR 2 owns export endpoints and content types.

- [ ] **Step 6: Run tests and verify GREEN**

```bash
pnpm nx test repository-api
```

Expected: PASS across all representative profile cases.

- [ ] **Step 7: Commit**

```bash
git add apps/repository-api/src/main/java/org/civicsrepo/metadata/ResearchMetadataProfile.java \
  apps/repository-api/src/main/java/org/civicsrepo/metadata/ResearchMetadataProfileAssembler.java \
  apps/repository-api/src/test/java/org/civicsrepo/metadata/ResearchMetadataProfileAssemblerTest.java \
  apps/repository-api/src/main/java/org/civicsrepo/research/ResearchObjectService.java \
  apps/repository-api/src/test/java/org/civicsrepo/research/ResearchObjectServiceTest.java
git commit -m "feat(metadata): add normalized research profile"
```

---

### Task 7: Add a deterministic `metadata:validate` foundation gate

**Files:**
- Modify: `package.json`
- Modify: `tools/scripts/metadata-profile-contract.test.mjs`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- `pnpm metadata:validate` is the stable command named in the verification design.
- In PR 1 it validates the profile/input invariants and runs repository-api tests. PR 2 extends the same command with DataCite/Schema.org/DCAT/citation renderer/schema checks; it must not rename the command.

- [ ] **Step 1: Expand the Node contract test before wiring the command**

Add checks that committed catalog fixtures include examples for every required profile role:

```js
for (const type of [
  'DATASET',
  'PUBLICATION',
  'METHODOLOGY',
  'PROJECT',
  'CODE',
]) {
  assert.ok(items.some((item) => item.resourceType === type));
}
```

Assert the restricted fixture has zero files and structured FSRDC guidance. Assert at least one DOI-bearing publication has an author with ORCID. Assert no object has an empty-string DOI/ORCID/access URL.

- [ ] **Step 2: Add the package command**

Add:

```json
"metadata:validate": "node --test tools/scripts/metadata-profile-contract.test.mjs && pnpm nx test repository-api"
```

This is intentionally browser-free and deterministic. PR 2 appends renderer/schema validation to this exact command.

- [ ] **Step 3: Run the gate locally**

```bash
pnpm metadata:validate
```

Expected: PASS.

- [ ] **Step 4: Add CI execution**

In the normal workspace/quality CI job, add a named step after fixture/OpenAPI checks:

```yaml
- name: Validate metadata profile foundation
  run: pnpm metadata:validate
```

Do not remove existing `test:all`, OpenAPI, fixture, docs, accessibility, or browser gates.

- [ ] **Step 5: Commit**

```bash
git add package.json tools/scripts/metadata-profile-contract.test.mjs .github/workflows/ci.yml
git commit -m "test(metadata): add profile validation gate"
```

---

### Task 8: Prove real DSpace restricted-access APPLY/readback/DIFF idempotence

**Files:**
- Create: `tools/scripts/dspace-access-guidance-idempotence.mjs`
- Modify: `.github/workflows/ci.yml`
- Modify: `documentation/metadata-export-verification-design.md`

**Interfaces:**
- Script operates on stable fixture `lehd-microdata-restricted`.
- Evidence result must prove exact DSpace fields, zero file manifest/bitstreams for protected data, API detail parity, and a replay `SKIP_ITEM`.
- Script must not delete/reseed volumes itself; CI owns clean environment orchestration.

- [ ] **Step 1: Write the script as assertions, not log-only diagnostics**

Required checks:

```text
1. locate restricted item by crr.identifier.source
2. assert crr.rights.access == RESTRICTED
3. assert crr.access.mechanism == FSRDC
4. assert crr.access.url == authoritative Census FSRDC URL
5. assert crr.access.restrictionbasis contains Title 13
6. assert crr.file.manifest is absent/empty
7. assert no ORIGINAL bundle bitstream represents confidential microdata
8. GET repository API detail and assert the same accessGuidance
9. run DIFF for the applicable source/program
10. assert action for the restricted item is SKIP_ITEM and not UPDATE_ITEM/CREATE_ITEM
```

If the current sync CLI cannot target the singleton without also processing its program, filter the returned action list by source identifier and assert that item specifically; do not weaken the assertion to “DIFF completed”.

- [ ] **Step 2: Run against the local DSpace stack**

From a working copy with DSpace already seeded:

```bash
node tools/scripts/dspace-access-guidance-idempotence.mjs
```

Expected final line:

```text
DSPACE ACCESS GUIDANCE IDEMPOTENCE: PASS
```

If APPLY is required to introduce the new fields in an existing local seed, run the repository's established APPLY once, then require the script's replay DIFF to settle. Never claim idempotence from the APPLY itself.

- [ ] **Step 3: Add clean-run CI sequence**

In the existing DSpace provenance job, after seed/readiness and before or alongside the #114 lineage proof, run the new access-guidance evidence script. Preserve the existing Phase B and Phase C scripts unchanged unless this feature genuinely requires a shared helper.

- [ ] **Step 4: Document the exact evidence output**

Update `documentation/metadata-export-verification-design.md` PR-1 section with the command name and the exact fields asserted. Keep PR-2/PR-3 sections marked as future design scope without pretending they are implemented.

- [ ] **Step 5: Commit**

```bash
git add tools/scripts/dspace-access-guidance-idempotence.mjs \
  .github/workflows/ci.yml \
  documentation/metadata-export-verification-design.md
git commit -m "test(dspace): prove restricted access guidance replay"
```

---

### Task 9: Update permanent metadata documentation and verify crosswalk foundation

**Files:**
- Modify: `documentation/open-science-research-objects.md`
- Create: `documentation/metadata-profile-crosswalk.md`
- Modify: `documentation/open-census-metadata-profile-design.md` only for verified corrections
- Modify: `documentation/open-census-metadata-profile-review-checklist.md`

**Interfaces:**
- `metadata-profile-crosswalk.md` is the permanent field-level crosswalk, separate from the architectural design.
- PR 1 rows describe internal + DSpace authority and reserved target mappings; PR 2 fills verified serialized examples and validation status.

- [ ] **Step 1: Document the new DSpace fields verbosely**

Add a table to `open-science-research-objects.md`:

```markdown
| Semantic | DSpace field | Authority rule |
|---|---|---|
| Access mechanism | `crr.access.mechanism` | Named real access path such as FSRDC; does not grant access |
| Access URL | `crr.access.url` | Authoritative public application/instructions URL; never protected content |
| Access instructions | `crr.access.instructions` | Human eligibility/process instructions when recorded |
| Restriction basis | `crr.access.restrictionbasis` | Legal/policy basis only when explicitly known |
```

Explain the relationship between these fields and existing `crr.rights.access` / `crr.rights.accessnote`.

- [ ] **Step 2: Create the permanent crosswalk**

Copy the approved semantic table from the design into `documentation/metadata-profile-crosswalk.md`, then add columns:

- `CRR requirement` (`REQUIRED`, `RECOMMENDED`, `OPTIONAL`);
- `Cardinality`;
- `Loss/ambiguity`;
- `Verification fixture`.

Do not mark a target-standard mapping as implemented until PR 2 adds and validates the renderer. Use explicit status text `DESIGNED — renderer in PR 2`, not TODO/TBD.

- [ ] **Step 3: Run documentation checks**

```bash
pnpm docs:check
pnpm format:check
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add documentation/open-science-research-objects.md \
  documentation/metadata-profile-crosswalk.md \
  documentation/open-census-metadata-profile-design.md \
  documentation/open-census-metadata-profile-review-checklist.md
git commit -m "docs(metadata): document profile authority crosswalk"
```

---

### Task 10: Run the PR-1 verification matrix before opening/merging

**Files:**
- No feature files unless a failing gate reveals a real defect.
- Update evidence docs only after commands actually pass.

**Interfaces:**
- This task produces evidence, not new behavior.
- Do not weaken assertions or skip gates to make the matrix green.

- [ ] **Step 1: Protect local unrelated work**

```bash
git status --short --branch
```

Confirm any unrelated untracked file such as `tools/scripts/dspace-version-lineage.test.mjs` is untouched. Do not run `git clean`.

- [ ] **Step 2: Run focused profile/contract gates**

```bash
pnpm metadata:validate
pnpm openapi:lint
pnpm openapi:check
pnpm fixture:check
pnpm docs:check
```

Expected: all PASS.

- [ ] **Step 3: Run repository/unit/build quality gates**

```bash
pnpm format:check
pnpm lint
pnpm test:all
pnpm build:all
```

Expected: all PASS.

- [ ] **Step 4: Run DSpace evidence on a clean/reproducible stack**

Use the existing CI-equivalent DSpace setup; do not destroy the developer's existing evidence volume merely to make a local test convenient. Require:

```text
DSpace seed/readiness: PASS
Phase B provenance APPLY→DIFF: PASS
Phase C native version lineage: PASS
Restricted access guidance APPLY/readback/DIFF: PASS
```

The new feature must not regress #114.

- [ ] **Step 5: Push and inspect GitHub CI**

Do not mark the PR ready until normal CI is green. PR 1 intentionally has no new visible UI, but existing Browser Evidence / Storybook / live Solr/OpenSearch / cross-browser / MapLibre workflows must remain green because OpenAPI/client and fixture changes can regress application compilation or mocks.

- [ ] **Step 6: Require evidence artifacts before merge**

Confirm CI has machine-readable/log evidence for:

- `metadata:validate`;
- restricted DSpace access guidance;
- existing DSpace provenance/version lineage;
- normal repository quality gates.

If the existing workflow does not upload a metadata-profile evidence artifact yet, add a small JSON summary under `artifacts/metadata-profile-evidence.json` generated deterministically by the validation script and upload it as `metadata-profile-evidence`. The artifact contains fixture IDs/check names/status only—no current timestamp unless supplied by GitHub workflow metadata outside the deterministic body.

- [ ] **Step 7: Final verification-before-completion**

Invoke `superpowers:verification-before-completion`. Re-fetch the exact PR head SHA and workflow results. Only then mark ready/merge with an expected-head guard.

---

## PR 1 Definition of Done

PR 1 is complete only when all statements below are evidenced:

1. Catalog/source parsing preserves DATASET, PUBLICATION, METHODOLOGY, PROJECT, CODE and restricted semantics instead of collapsing them to datasets.
2. Blank/invalid release dates no longer become the current date.
3. Structured access mechanism, URL, instructions, and restriction basis can be authored once in the catalog.
4. Those access facts are registered DSpace metadata fields.
5. SAF generation carries them deterministically.
6. Live sync writes them only when known.
7. Repository readback and fixture fallback expose the same access/detail shape.
8. Restricted LEHD remains metadata-only with zero confidential files/downloads.
9. APPLY/readback/replay DIFF settles to `SKIP_ITEM` for the restricted object.
10. `ResearchMetadataProfile` exists as the single renderer input boundary.
11. Profile assembly uses detail + observed version history and never queries search projections.
12. Representative dataset/publication/methodology/project/code/restricted/versioned/partial profile tests pass.
13. Vintage does not manufacture version lineage.
14. DOI/ORCID/access facts remain absent when unknown.
15. `pnpm metadata:validate` exists and is green locally and in CI.
16. OpenAPI/generated-client drift is green.
17. Existing #114 Phase B/Phase C DSpace evidence remains green.
18. Normal CI, Storybook/axe, live Solr/OpenSearch, cross-browser and MapLibre regressions remain green.
19. Permanent documentation explains every new field and authority boundary.
20. No DataCite/Schema.org/DCAT renderer or UI behavior is prematurely implemented in PR 1.
