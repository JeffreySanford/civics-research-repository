# Open Census Metadata Profile Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build PR 1 of issue #115: a lossless, testable metadata-profile foundation that carries structured access guidance and all existing research-object semantics through catalog/source → DSpace → repository API → one normalized `ResearchMetadataProfile`, with replay-safe verification and no fabricated facts.

**Architecture:** Keep DSpace/application metadata authoritative for curated records and publisher data authoritative for federated records. Extend the existing normalized source/detail models only where facts are currently missing, persist structured access guidance as managed `crr.*` metadata, and assemble one backend `ResearchMetadataProfile` from `ResearchObjectDetail` plus observed `ResearchArtifactVersionHistory`. Do not add DataCite/Schema.org/DCAT renderers or Cite/Export UI in this PR; those consume this foundation in PRs 2 and 3.

**Tech Stack:** Java 21 / Spring Boot, OpenAPI 3.1 + generated Java/TypeScript DTOs, DSpace 9 REST + SAF, Nx, pnpm 10.14, Node 22 test runner, JUnit 5, Docker Compose.

**Spec:** `documentation/open-census-metadata-profile-design.md`

**Verification contract:** `documentation/metadata-export-verification-design.md`

## Global Constraints

- DataCite target is Metadata Schema **4.7**; PR 1 prepares facts/readiness inputs but does not render DataCite.
- Schema.org JSON-LD and DCAT-US 3.0 output are PR 2; no format-specific property names belong in `ResearchMetadataProfile`.
- DSpace/application metadata remains authoritative for curated repository records.
- Federated publishers remain authoritative for federated records.
- Solr/OpenSearch remain disposable discovery projections; the profile assembler must not query them.
- Missing source facts mean unknown/no opinion. Never synthesize DOI, ORCID, release year, version lineage, checksum, capture time, access mechanism, or restriction basis.
- `vintageYear` does not establish artifact version history.
- DSpace-native version history remains the repository lineage authority when available.
- Restricted metadata must never imply a local/protected file, confidential download, or authorization workflow.
- New DSpace access fields must obey the established APPLY → readback → DIFF `SKIP_ITEM` reconciliation contract.
- Preserve the existing repository-augmented-field rule for `dc.identifier.uri`; DSpace handles are allowed extras while the publisher URI remains required.
- Do not alter browser/map behavior in PR 1 except generated client types caused by the OpenAPI contract.
- `tools/scripts/dspace-version-lineage.test.mjs` may exist as an unrelated untracked local file; never clean or overwrite it.

---

## File / Responsibility Map

### New backend domain files

- `apps/repository-api/src/main/java/org/civicsrepo/metadata/ResearchAccessMetadata.java` — source/application-neutral structured access facts.
- `apps/repository-api/src/main/java/org/civicsrepo/metadata/ResearchMetadataProfile.java` — immutable normalized export/profile authority with profile-owned nested records.
- `apps/repository-api/src/main/java/org/civicsrepo/metadata/ResearchMetadataProfileAssembler.java` — copies authoritative application facts into one deterministic profile.
- `apps/repository-api/src/test/java/org/civicsrepo/metadata/ResearchMetadataProfileAssemblerTest.java` — representative profile/no-fabrication tests.

### Source / sync files

- `apps/repository-api/src/main/java/org/civicsrepo/sources/ResearchObjectMetadata.java`
- `apps/repository-api/src/main/java/org/civicsrepo/sources/CatalogMetadataReader.java`
- `apps/repository-api/src/test/java/org/civicsrepo/sources/CatalogMetadataReaderTest.java`
- `apps/repository-api/src/main/java/org/civicsrepo/dspace/DspaceManagedFields.java`
- `apps/repository-api/src/main/java/org/civicsrepo/dspace/DspaceItemPayloadMapper.java`
- `apps/repository-api/src/test/java/org/civicsrepo/dspace/DspaceItemPayloadMapperTest.java`
- `apps/repository-api/src/test/java/org/civicsrepo/dspace/DspaceItemDiffPlannerTest.java`
- `apps/repository-api/src/test/java/org/civicsrepo/dspace/DspaceRestItemWriteGatewayTest.java`

### Repository / fixture read files

- `apps/repository-api/src/main/java/org/civicsrepo/repository/RepositoryObjectMapper.java`
- `apps/repository-api/src/test/java/org/civicsrepo/repository/RepositoryObjectMapperTest.java`
- `apps/repository-api/src/main/java/org/civicsrepo/repository/FixtureCatalog.java`
- `apps/repository-api/src/test/java/org/civicsrepo/repository/FixtureCatalogTest.java`

### Catalog / DSpace files

- `tools/dspace/catalog.json`
- `tools/dspace/crr-types.xml`
- `tools/scripts/generate-saf.mjs`
- `apps/repository-api/src/main/resources/discovery-fixture-catalog.json` — generated; never hand-edit.

### API / generated contract files

- `schemas/openapi/repository-api.yaml`
- `libs/repository/api-client/src/generated/repository-api.types.ts` — regenerate only with `pnpm openapi:generate`.
- `libs/repository/api-client/src/lib/repository-api-client.spec.ts`

### Verification / docs files

- `tools/scripts/metadata-profile-contract.test.mjs`
- `tools/scripts/dspace-access-guidance-idempotence.mjs`
- `package.json`
- `.github/workflows/ci.yml`
- `documentation/open-science-research-objects.md`
- `documentation/metadata-profile-crosswalk.md`
- `documentation/metadata-export-verification-design.md`

---

## Task 1: Extend the API detail contract with profile inputs

**Files:**
- Modify: `schemas/openapi/repository-api.yaml`
- Regenerate: `libs/repository/api-client/src/generated/repository-api.types.ts`
- Modify test: `libs/repository/api-client/src/lib/repository-api-client.spec.ts`

**Interfaces:**
- OpenAPI `ResearchAccessGuidance` has optional `mechanism`, `accessUrl`, `instructions`, `restrictionBasis`.
- `ResearchObjectDetail` gains optional `documentationUrl`, optional `geographicLevel`, required `subjects: string[]`, optional `accessGuidance`.
- Generated Java DTO keeps the name `org.civicsrepo.generated.dto.ResearchAccessGuidance`; the internal source/profile type is deliberately named `ResearchAccessMetadata` to avoid a collision.

- [ ] **Step 1: Write the failing generated-client contract test**

Extend the existing typed detail fixture:

```ts
const detail: ResearchObjectDetail = {
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

Assert the returned typed value preserves `FSRDC` and all three subjects.

- [ ] **Step 2: Run the client test and verify RED**

```bash
pnpm nx test repository-api-client
```

Expected: compile/test failure because generated types do not expose the new fields.

- [ ] **Step 3: Add the OpenAPI schema exactly**

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

Extend `ResearchObjectDetail.properties`:

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

Add `subjects` to `ResearchObjectDetail.required`. Keep the other fields optional because absence is meaningful.

- [ ] **Step 4: Regenerate and verify**

```bash
pnpm openapi:lint
pnpm openapi:generate
pnpm openapi:check
pnpm nx test repository-api-client
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add schemas/openapi/repository-api.yaml \
  libs/repository/api-client/src/generated/repository-api.types.ts \
  libs/repository/api-client/src/lib/repository-api-client.spec.ts
git commit -m "feat(metadata): extend research detail profile inputs"
```

---

## Task 2: Author structured restricted-access facts once in the catalog and SAF

**Files:**
- Modify: `tools/dspace/catalog.json`
- Modify: `tools/scripts/generate-saf.mjs`
- Modify: `tools/dspace/crr-types.xml`
- Regenerate: `apps/repository-api/src/main/resources/discovery-fixture-catalog.json`
- Create test: `tools/scripts/metadata-profile-contract.test.mjs`

**Interfaces:**
- `lehd-microdata-restricted` gains one structured object:

```json
"accessGuidance": {
  "mechanism": "FSRDC",
  "accessUrl": "https://www.census.gov/about/adrm/fsrdc.html",
  "instructions": "Access requires an approved research proposal and Special Sworn Status through a Federal Statistical Research Data Center.",
  "restrictionBasis": "Title 13, U.S. Code"
}
```

- DSpace metadata field names are fixed:
  - `crr.access.mechanism`
  - `crr.access.url`
  - `crr.access.instructions`
  - `crr.access.restrictionbasis`

- [ ] **Step 1: Write the RED catalog contract test**

Create `tools/scripts/metadata-profile-contract.test.mjs` using Node's built-in test runner:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const catalog = JSON.parse(readFileSync('tools/dspace/catalog.json', 'utf8'));
const restricted = catalog.researchObjects.find(
  (item) => item.id === 'lehd-microdata-restricted',
);

test('restricted LEHD metadata exposes guidance but no files', () => {
  assert.equal(restricted.access, 'RESTRICTED');
  assert.deepEqual(restricted.files, []);
  assert.equal(restricted.accessGuidance.mechanism, 'FSRDC');
  assert.equal(
    restricted.accessGuidance.accessUrl,
    'https://www.census.gov/about/adrm/fsrdc.html',
  );
  assert.match(restricted.accessGuidance.restrictionBasis, /Title 13/);
});
```

If `catalog.json` stores singleton objects under a differently named array, use that existing array name rather than introducing a second catalog section.

- [ ] **Step 2: Run and verify RED**

```bash
node --test tools/scripts/metadata-profile-contract.test.mjs
```

Expected: FAIL because `accessGuidance` is absent.

- [ ] **Step 3: Add the exact catalog facts and DSpace schema fields**

Add the object above to the existing `lehd-microdata-restricted` record. Register all four `crr.access.*` fields in `tools/dspace/crr-types.xml`. Each scope note must say the field describes legitimate access/discovery and does not grant access.

- [ ] **Step 4: Extend SAF/fixture generation**

`buildResearchObject(entry)` carries:

```js
accessGuidance: entry.accessGuidance ?? null,
```

`writeItem(item)` emits only recorded values:

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
  crr += dcvalue('access', 'restrictionbasis', item.accessGuidance.restrictionBasis);
}
```

The generated fixture JSON must include `accessGuidance: item.accessGuidance` for singleton objects.

- [ ] **Step 5: Regenerate and verify deterministic parity**

```bash
pnpm dspace:saf:generate
pnpm fixture:check
node --test tools/scripts/metadata-profile-contract.test.mjs
```

Expected: PASS. Review the generated fixture diff; it must contain the new guidance only where authored.

- [ ] **Step 6: Commit**

```bash
git add tools/dspace/catalog.json tools/dspace/crr-types.xml \
  tools/scripts/generate-saf.mjs \
  tools/scripts/metadata-profile-contract.test.mjs \
  apps/repository-api/src/main/resources/discovery-fixture-catalog.json
git commit -m "feat(metadata): model structured restricted access"
```

---

## Task 3: Make catalog/source parsing full-fidelity and remove current-clock fabrication

**Files:**
- Create: `apps/repository-api/src/main/java/org/civicsrepo/metadata/ResearchAccessMetadata.java`
- Modify: `apps/repository-api/src/main/java/org/civicsrepo/sources/ResearchObjectMetadata.java`
- Modify: `apps/repository-api/src/main/java/org/civicsrepo/sources/CatalogMetadataReader.java`
- Modify test: `apps/repository-api/src/test/java/org/civicsrepo/sources/CatalogMetadataReaderTest.java`

**Interfaces:**
- Internal record:

```java
public record ResearchAccessMetadata(
        String mechanism,
        String accessUrl,
        String instructions,
        String restrictionBasis) {}
```

- `ResearchObjectMetadata` gains optional final component `ResearchAccessMetadata accessGuidance` after `versionProvenance`.
- Existing compatibility constructors and `dataset(...)` convenience methods delegate with `null` access guidance.
- `CatalogMetadataReader` constructs full `ResearchObjectMetadata` from generated catalog values instead of routing every item through `ResearchObjectMetadata.dataset(...)`.

- [ ] **Step 1: Write failing full-fidelity tests**

For `lehd-microdata-restricted` assert:

```java
assertThat(restricted.contentType()).isEqualTo(ResearchObjectType.DATASET);
assertThat(restricted.accessLevel()).isEqualTo(AccessLevel.RESTRICTED);
assertThat(restricted.accessNote()).contains("Federal Statistical Research Data Center");
assertThat(restricted.files()).isEmpty();
assertThat(restricted.accessGuidance().mechanism()).isEqualTo("FSRDC");
assertThat(restricted.accessGuidance().restrictionBasis()).isEqualTo("Title 13, U.S. Code");
```

For a known publication object assert `PUBLICATION`, DOI/authors/relations remain present rather than being reset by dataset defaults.

Add an invalid-date fixture/resource case and assert release date is `null`, not today's date.

- [ ] **Step 2: Run and verify RED**

```bash
pnpm nx test repository-api
```

Expected: current reader loses non-dataset fields and substitutes `LocalDate.now()` for invalid/missing dates.

- [ ] **Step 3: Add `ResearchAccessMetadata` and compatibility wiring**

Create the record exactly as specified. Add it as the final optional component of `ResearchObjectMetadata`; update all delegating constructors with `null` so unrelated adapters continue compiling.

- [ ] **Step 4: Parse the full generated catalog**

Replace the unconditional `ResearchObjectMetadata.dataset(...)` call with a full constructor mapping:

```java
return new ResearchObjectMetadata(
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

Implement `authors`, `relations`, `contentType`, `accessLevel`, and `accessGuidance` using the generated fixture JSON already produced in Task 2.

- [ ] **Step 5: Remove current-clock fallback**

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

No code in this reader may call `LocalDate.now()`.

- [ ] **Step 6: Run and verify GREEN**

```bash
pnpm nx test repository-api
```

Expected: PASS for dataset, publication, restricted and invalid-date cases.

- [ ] **Step 7: Commit**

```bash
git add apps/repository-api/src/main/java/org/civicsrepo/metadata/ResearchAccessMetadata.java \
  apps/repository-api/src/main/java/org/civicsrepo/sources/ResearchObjectMetadata.java \
  apps/repository-api/src/main/java/org/civicsrepo/sources/CatalogMetadataReader.java \
  apps/repository-api/src/test/java/org/civicsrepo/sources/CatalogMetadataReaderTest.java
git commit -m "fix(metadata): preserve catalog research semantics"
```

---

## Task 4: Persist structured access metadata through DSpace reconciliation

**Files:**
- Modify: `apps/repository-api/src/main/java/org/civicsrepo/dspace/DspaceManagedFields.java`
- Modify: `apps/repository-api/src/main/java/org/civicsrepo/dspace/DspaceItemPayloadMapper.java`
- Modify test: `apps/repository-api/src/test/java/org/civicsrepo/dspace/DspaceItemPayloadMapperTest.java`
- Modify test: `apps/repository-api/src/test/java/org/civicsrepo/dspace/DspaceItemDiffPlannerTest.java`
- Modify test: `apps/repository-api/src/test/java/org/civicsrepo/dspace/DspaceRestItemWriteGatewayTest.java`

**Interfaces:**

```java
public static final String ACCESS_MECHANISM_FIELD = "crr.access.mechanism";
public static final String ACCESS_URL_FIELD = "crr.access.url";
public static final String ACCESS_INSTRUCTIONS_FIELD = "crr.access.instructions";
public static final String ACCESS_RESTRICTION_BASIS_FIELD = "crr.access.restrictionbasis";
```

All four belong in `DspaceManagedFields.ALL`. None belongs in `REPOSITORY_AUGMENTED_FIELDS`.

- [ ] **Step 1: Add RED payload tests**

Build restricted metadata with `ResearchAccessMetadata` and assert all four fields are written exactly once. Build a public/no-guidance object and assert none are written.

Also add a null release-date case asserting `dc.date.issued` is omitted instead of throwing or using today's date.

- [ ] **Step 2: Run and verify RED**

```bash
pnpm nx test repository-api
```

- [ ] **Step 3: Implement managed fields and null-safe date writing**

Replace direct `metadata.releasedOn().format(...)` insertion with:

```java
putIfPresent(
        fields,
        "dc.date.issued",
        metadata.releasedOn() == null
                ? null
                : metadata.releasedOn().format(DateTimeFormatter.ISO_LOCAL_DATE));
```

Write access values only when present:

```java
ResearchAccessMetadata access = metadata.accessGuidance();
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

- [ ] **Step 4: Add diff/write semantics tests**

Prove all three behaviors:

1. exact source/repository access values settle to no mutation / `SKIP_ITEM`;
2. changed `crr.access.url` produces an update;
3. absent source guidance follows the existing missing-source/no-op rule and does not clear richer repository guidance.

- [ ] **Step 5: Run and verify GREEN**

```bash
pnpm nx test repository-api
```

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

## Task 5: Expose identical profile inputs from repository and fixture detail paths

**Files:**
- Modify: `apps/repository-api/src/main/java/org/civicsrepo/repository/RepositoryObjectMapper.java`
- Modify: `apps/repository-api/src/main/java/org/civicsrepo/repository/FixtureCatalog.java`
- Modify test: `apps/repository-api/src/test/java/org/civicsrepo/repository/RepositoryObjectMapperTest.java`
- Modify test: `apps/repository-api/src/test/java/org/civicsrepo/repository/FixtureCatalogTest.java`

**Interfaces:**
- Repository and fixture `ResearchObjectDetail` expose the same `documentationUrl`, `geographicLevel`, `subjects`, `accessGuidance` values.
- `accessGuidance` uses the generated OpenAPI DTO; the internal source/profile record remains `ResearchAccessMetadata`.

- [ ] **Step 1: Write RED repository mapper assertions**

Create a DSpace item with:

```text
crr.documentation.url=https://www.census.gov/about/adrm/fsrdc.html
crr.geography.level=National
dc.subject=LEHD
dc.subject=Restricted use
crr.access.mechanism=FSRDC
crr.access.url=https://www.census.gov/about/adrm/fsrdc.html
crr.access.instructions=Access requires an approved research proposal and Special Sworn Status through a Federal Statistical Research Data Center.
crr.access.restrictionbasis=Title 13, U.S. Code
```

Assert mapped detail contains exactly those facts and no synthetic file.

- [ ] **Step 2: Write RED fixture parity assertions**

Load `lehd-microdata-restricted` from `FixtureCatalog` and assert the same detail facts.

- [ ] **Step 3: Run and verify RED**

```bash
pnpm nx test repository-api
```

- [ ] **Step 4: Implement repository mapping**

Add a helper that returns generated `org.civicsrepo.generated.dto.ResearchAccessGuidance` only when at least one managed access value exists. Preserve URI typing produced by the generator for `accessUrl`.

Map subjects from `dc.subject`, documentation URL from `crr.documentation.url`, geographic level from `crr.geography.level`.

- [ ] **Step 5: Implement fixture parity**

Parse `item.path("accessGuidance")` in `FixtureCatalog`; set the same generated DTO plus subjects, documentation URL and geographic level.

- [ ] **Step 6: Run and verify GREEN**

```bash
pnpm nx test repository-api
pnpm openapi:check
```

- [ ] **Step 7: Commit**

```bash
git add apps/repository-api/src/main/java/org/civicsrepo/repository/RepositoryObjectMapper.java \
  apps/repository-api/src/main/java/org/civicsrepo/repository/FixtureCatalog.java \
  apps/repository-api/src/test/java/org/civicsrepo/repository/RepositoryObjectMapperTest.java \
  apps/repository-api/src/test/java/org/civicsrepo/repository/FixtureCatalogTest.java
git commit -m "feat(metadata): expose profile inputs from repository"
```

---

## Task 6: Introduce the immutable `ResearchMetadataProfile` boundary

**Files:**
- Create: `apps/repository-api/src/main/java/org/civicsrepo/metadata/ResearchMetadataProfile.java`
- Create: `apps/repository-api/src/main/java/org/civicsrepo/metadata/ResearchMetadataProfileAssembler.java`
- Create test: `apps/repository-api/src/test/java/org/civicsrepo/metadata/ResearchMetadataProfileAssemblerTest.java`
- Modify: `apps/repository-api/src/main/java/org/civicsrepo/research/ResearchObjectService.java`
- Modify test: `apps/repository-api/src/test/java/org/civicsrepo/research/ResearchObjectServiceTest.java`

**Interfaces:**
- `ResearchMetadataProfile` is profile-owned and immutable. It may use existing enums (`ResearchObjectType`, `ResearchProgram`, `AccessLevel`, `FileFormat`, `VersionHistoryStatus`) but must not store generated mutable DTO objects.
- Define nested records exactly for authors, files, relations, access and versions so PR 2 renderers depend only on this profile.

Required shape:

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
        List<Author> authors,
        Access access,
        List<Distribution> distributions,
        List<Relation> relations,
        VersionHistory versions) {

    public record Author(String name, String orcid) {}

    public record Access(
            AccessLevel level,
            String note,
            String license,
            ResearchAccessMetadata guidance) {}

    public record Distribution(String id, String label, FileFormat format, URI url) {}

    public record Relation(
            String verb,
            String targetId,
            String targetTitle,
            ResearchObjectType targetType,
            AccessLevel targetAccessLevel,
            String note) {}

    public record VersionHistory(
            VersionHistoryStatus status,
            List<Version> items,
            String note) {}

    public record Version(
            String id,
            String label,
            boolean current,
            String versionLabel,
            LocalDate versionDate,
            LocalDate releasedOn,
            String doi,
            URI sourceUrl,
            String sourceSha256,
            OffsetDateTime capturedAt,
            String isVersionOf,
            String supersedes,
            String changeNote) {}
}
```

Compact constructors copy every list with `List.copyOf(...)` and replace null lists with `List.of()`.

- `ResearchMetadataProfileAssembler.assemble(ResearchObjectDetail detail, ResearchArtifactVersionHistory history)` performs copying only; it has no repositories, clocks, HTTP clients or search dependencies.

- [ ] **Step 1: Write RED representative profile tests**

Cover at minimum:

1. public dataset;
2. DOI-bearing publication with author + ORCID;
3. methodology object;
4. project object;
5. code object;
6. restricted LEHD dataset with zero distributions;
7. versioned TIGER object with repository versions 2 → 1;
8. partial metadata object.

Required assertions include:

```java
assertThat(restricted.access().guidance().mechanism()).isEqualTo("FSRDC");
assertThat(restricted.distributions()).isEmpty();
assertThat(partial.doi()).isNull();
assertThat(versioned.versions().status()).isEqualTo(VersionHistoryStatus.HISTORY_AVAILABLE);
assertThat(versioned.versions().items()).hasSize(2);
assertThat(versioned.versions().items().get(0).supersedes()).isEqualTo("dspace-version:1");
```

- [ ] **Step 2: Write RED determinism/no-inference tests**

Assemble identical inputs twice and assert equality. Build a detail with `vintageYear=2025` and singleton `OBSERVED_CURRENT_ONLY` history; assert the profile still contains one version and no inferred predecessor.

- [ ] **Step 3: Run and verify RED**

```bash
pnpm nx test repository-api
```

Expected: profile classes/methods do not exist.

- [ ] **Step 4: Implement profile + pure assembler**

Convert generated detail/history DTOs into the profile-owned nested records. Preserve nulls. Do not normalize unknown facts into display strings.

- [ ] **Step 5: Wire service authority without duplicate resolution**

Refactor `ResearchObjectService` so existing version-history construction can accept an already resolved detail:

```java
public ResearchMetadataProfile getResearchMetadataProfile(String researchIdToken) {
    ResearchObjectDetail detail = getResearchObject(researchIdToken);
    ResearchArtifactVersionHistory history = buildVersionHistory(detail);
    return researchMetadataProfileAssembler.assemble(detail, history);
}
```

`getResearchObjectVersionHistory(...)` should call the same private `buildVersionHistory(detail)` after resolving detail once. No new controller route is added in PR 1.

- [ ] **Step 6: Run and verify GREEN**

```bash
pnpm nx test repository-api
```

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

## Task 7: Add the stable `metadata:validate` foundation gate

**Files:**
- Modify: `tools/scripts/metadata-profile-contract.test.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Stable command: `pnpm metadata:validate`.
- PR 1 validates profile/catalog invariants and repository-api tests.
- PR 2 extends the same command with DataCite/Schema.org/DCAT/citation renderer/schema validation; never rename it.

- [ ] **Step 1: Expand the fast contract test**

Assert the committed catalog contains representative `DATASET`, `PUBLICATION`, `METHODOLOGY`, `PROJECT`, `CODE` objects; restricted LEHD has zero files + FSRDC guidance; at least one DOI-bearing publication has an ORCID author; no DOI, ORCID or access URL is stored as an empty string.

- [ ] **Step 2: Add the package script**

```json
"metadata:validate": "node --test tools/scripts/metadata-profile-contract.test.mjs && pnpm nx test repository-api"
```

- [ ] **Step 3: Run locally**

```bash
pnpm metadata:validate
```

Expected: PASS.

- [ ] **Step 4: Add CI step without removing existing gates**

```yaml
- name: Validate metadata profile foundation
  run: pnpm metadata:validate
```

Place it after OpenAPI/fixture generation checks in the normal CI job.

- [ ] **Step 5: Commit**

```bash
git add tools/scripts/metadata-profile-contract.test.mjs package.json .github/workflows/ci.yml
git commit -m "test(metadata): add profile validation gate"
```

---

## Task 8: Prove real DSpace restricted-access APPLY/readback/DIFF idempotence

**Files:**
- Create: `tools/scripts/dspace-access-guidance-idempotence.mjs`
- Modify: `.github/workflows/ci.yml`
- Modify: `documentation/metadata-export-verification-design.md`

**Interfaces:**
- Stable target: `lehd-microdata-restricted`.
- Sync source/program: `LEHD`.
- Required terminal proof: exact DSpace metadata + zero protected files + API parity + replay `SKIP_ITEM` for the restricted source identifier.

- [ ] **Step 1: Implement assertions, not diagnostic logging**

The script must:

```text
1. authenticate to DSpace using the established dspace-session helper
2. locate the item whose crr.identifier.source is lehd-microdata-restricted
3. assert crr.rights.access == RESTRICTED
4. assert crr.access.mechanism == FSRDC
5. assert crr.access.url == https://www.census.gov/about/adrm/fsrdc.html
6. assert crr.access.instructions contains approved research proposal
7. assert crr.access.restrictionbasis == Title 13, U.S. Code
8. assert crr.file.manifest is absent/empty
9. assert no ORIGINAL bundle contains confidential LEHD microdata
10. GET repository API detail and assert identical accessGuidance
11. POST /api/admin/sync with { mode: "DIFF", source: "LEHD" }
12. identify the action for lehd-microdata-restricted and require SKIP_ITEM
13. reject CREATE_ITEM or UPDATE_ITEM for that object
```

Final successful output:

```text
DSPACE ACCESS GUIDANCE IDEMPOTENCE: PASS
```

- [ ] **Step 2: Run against local DSpace after APPLY has introduced new fields**

Use the repository's normal LEHD APPLY path once if the existing local item predates the fields, then execute:

```bash
node tools/scripts/dspace-access-guidance-idempotence.mjs
```

The proof is the replay DIFF, not the APPLY.

- [ ] **Step 3: Add clean CI execution**

Run the script in the existing DSpace provenance job after DSpace seed/readiness. Preserve Phase B provenance and Phase C native-lineage scripts as required regression evidence.

- [ ] **Step 4: Update verification documentation with actual command/evidence**

Document the exact command, source identifier, asserted fields, zero-file rule and `SKIP_ITEM` result. Do not mark PR-2/PR-3 renderer/browser evidence implemented yet.

- [ ] **Step 5: Commit**

```bash
git add tools/scripts/dspace-access-guidance-idempotence.mjs \
  .github/workflows/ci.yml \
  documentation/metadata-export-verification-design.md
git commit -m "test(dspace): prove restricted access guidance replay"
```

---

## Task 9: Create permanent verbose crosswalk/authority documentation

**Files:**
- Modify: `documentation/open-science-research-objects.md`
- Create: `documentation/metadata-profile-crosswalk.md`
- Modify: `documentation/open-census-metadata-profile-review-checklist.md`

**Interfaces:**
- Permanent crosswalk columns: CRR semantic, internal/DSpace field, DataCite 4.7 target, Schema.org target, DCAT-US 3.0 target, cardinality, CRR requirement, loss/ambiguity, verification fixture, implementation status.
- PR 1 target-standard rows are explicitly `DESIGNED — renderer in PR 2`, not represented as implemented.

- [ ] **Step 1: Document structured access fields and authority rules**

Add:

```markdown
| Semantic | DSpace field | Authority rule |
|---|---|---|
| Access mechanism | `crr.access.mechanism` | Named real access path such as FSRDC; does not grant access |
| Access URL | `crr.access.url` | Authoritative public application/instructions URL; never protected content |
| Access instructions | `crr.access.instructions` | Human eligibility/process instructions when recorded |
| Restriction basis | `crr.access.restrictionbasis` | Legal/policy basis only when explicitly known |
```

Explain how these complement `crr.rights.access` and `crr.rights.accessnote` rather than replacing them.

- [ ] **Step 2: Create the permanent field-by-field crosswalk**

Move the approved design table into `documentation/metadata-profile-crosswalk.md`; add cardinality/requirement/loss/fixture/status columns. Use explicit `DESIGNED — renderer in PR 2` statuses for external serialization columns.

- [ ] **Step 3: Run docs + formatting checks**

```bash
pnpm docs:check
pnpm format:check
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add documentation/open-science-research-objects.md \
  documentation/metadata-profile-crosswalk.md \
  documentation/open-census-metadata-profile-review-checklist.md
git commit -m "docs(metadata): document profile authority crosswalk"
```

---

## Task 10: Run the full PR-1 verification matrix before ready/merge

**Files:**
- No feature changes unless a gate reveals a real defect.

**Interfaces:**
- This task creates evidence only; never weaken assertions to make the branch green.

- [ ] **Step 1: Protect unrelated local work**

```bash
git status --short --branch
```

Confirm unrelated untracked files remain untouched. Never run `git clean`.

- [ ] **Step 2: Run focused metadata/contract gates**

```bash
pnpm metadata:validate
pnpm openapi:lint
pnpm openapi:check
pnpm fixture:check
pnpm docs:check
```

Expected: all PASS.

- [ ] **Step 3: Run normal repository quality gates**

```bash
pnpm format:check
pnpm lint
pnpm test:all
pnpm build:all
```

Expected: all PASS.

- [ ] **Step 4: Run DSpace evidence without destroying the developer evidence volume**

Require:

```text
DSpace seed/readiness: PASS
Phase B provenance APPLY→DIFF: PASS
Phase C DSpace-native lineage: PASS
Restricted access guidance APPLY/readback/DIFF: PASS
```

Use a disposable CI/worktree stack for destructive clean-seed proof rather than `docker compose down -v` against the developer's existing successful lineage state.

- [ ] **Step 5: Push and inspect GitHub workflows**

Even though PR 1 adds no visible UI, require existing normal CI, Storybook/axe, live Solr/OpenSearch, Chromium/Firefox/WebKit accessibility/comparison, and MapLibre regression workflows to remain green because generated clients and fixtures can break those surfaces.

- [ ] **Step 6: Require evidence artifacts/logs**

Confirm GitHub evidence contains:

- `metadata:validate` success;
- restricted DSpace access-guidance proof;
- existing Phase B/Phase C DSpace proof;
- normal repository quality gates.

If CI lacks a metadata-profile artifact, generate deterministic `artifacts/metadata-profile-evidence.json` containing fixture IDs, named checks and statuses only, and upload it as `metadata-profile-evidence`. Do not put a renderer-time timestamp/random identifier in that JSON.

- [ ] **Step 7: Run final verification-before-completion**

Invoke `superpowers:verification-before-completion`. Re-fetch the exact PR head SHA and all required workflow results. Mark ready/merge only if the head is unchanged and all required evidence is green.

---

## PR 1 Definition of Done

PR 1 is complete only when all of the following are evidenced:

1. Catalog/source parsing preserves DATASET, PUBLICATION, METHODOLOGY, PROJECT, CODE and restricted semantics instead of collapsing them to datasets.
2. Blank/invalid release dates no longer become the current date.
3. Structured access mechanism, URL, instructions and restriction basis are authored once in the catalog.
4. Those facts are registered as managed DSpace metadata.
5. SAF generation and generated fixture output carry them deterministically.
6. Live sync writes access guidance only when known.
7. Repository readback and fixture fallback expose the same detail shape.
8. Restricted LEHD remains metadata-only with no confidential distribution.
9. APPLY/readback/replay DIFF settles to `SKIP_ITEM` for the restricted object.
10. `ResearchMetadataProfile` exists as the single future-renderer input boundary.
11. Profile assembly uses resolved detail + observed version history and never queries search projections.
12. Dataset/publication/methodology/project/code/restricted/versioned/partial profile tests pass.
13. Vintage never manufactures lineage.
14. DOI, ORCID and access facts remain absent when unknown.
15. `pnpm metadata:validate` exists and is green locally and in CI.
16. OpenAPI/generated-client drift is green.
17. Existing #114 Phase B and Phase C DSpace evidence remains green.
18. Existing Storybook/axe, live Solr/OpenSearch, cross-browser and MapLibre regressions remain green.
19. Permanent documentation explains every new field, authority boundary, cardinality and lossy mapping.
20. No DataCite/Schema.org/DCAT renderer or Cite/Export UI is prematurely implemented in PR 1.
