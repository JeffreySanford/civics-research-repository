# Open Census Metadata Profile and Structured Export Design

Status: **Design contract for issue #115**  
Depends on: **#114 — authoritative observed artifact version/provenance semantics**  
Target branch: `feat/open-census-metadata-profile`  
Implementation strategy: **three independently verifiable PR slices**

## 1. Purpose

Civics Research Repository already has a strong internal research-object model, DSpace-backed authority, federated-source support, observed DSpace-native version lineage, typed research relationships, restricted-object metadata, Solr/OpenSearch discovery projections, and two Angular presentation surfaces.

Issue #115 adds the interoperability layer above that authority model.

The goal is not to replace CRR metadata with a standards vocabulary. The goal is to make one authoritative research-object record usable in four contexts without manufacturing facts:

1. repository-native DSpace/Dublin Core storage;
2. DataCite Metadata Schema 4.7-oriented scholarly metadata;
3. Schema.org JSON-LD for public web discoverability;
4. DCAT-US 3.0 for resources that are genuinely datasets, distributions, APIs, or data services.

The same normalized profile must also generate human citation formats. This keeps the user-facing citation, machine-readable exports, and repository detail response synchronized instead of allowing each surface to invent its own interpretation.

The design therefore introduces a **normalized export/profile boundary** between authoritative CRR research metadata and external representations.

---

## 2. Standards and versions

The implementation will pin and document the following targets.

### 2.1 DataCite Metadata Schema 4.7

DataCite 4.7 was released 3 March 2026.

Authoritative references:

- https://schema.datacite.org/meta/kernel-4.7/
- https://datacite-metadata-schema.readthedocs.io/en/4.7/

DataCite mandatory top-level properties are:

- Identifier;
- Creator;
- Title;
- Publisher;
- PublicationYear;
- ResourceType.

CRR must distinguish two separate statements:

- **DataCite-oriented export available** — CRR can express the record using DataCite concepts;
- **DataCite DOI registration-ready** — all DataCite mandatory values are available and the primary identifier is an actual DOI suitable for a DataCite record.

CRR must never convert a local CRR identifier, source URL, DSpace handle, or arbitrary URL into a fake DataCite DOI.

### 2.2 Schema.org

Schema.org JSON-LD is the public web structured-data representation.

Primary types expected by resource:

- `Dataset` for datasets;
- `ScholarlyArticle` or the narrowest truthful `CreativeWork` type for publications;
- `SoftwareSourceCode` for source code;
- `CreativeWork` for methodology/supporting material where a more specific type would overstate semantics;
- `ResearchProject` only if the supported Schema.org vocabulary and mapped data support the claim; otherwise `CreativeWork`/`Thing` with explicit additional type semantics.

Relevant common properties include:

- `name`;
- `description`;
- `creator`;
- `publisher`;
- `identifier`;
- `citation`;
- `datePublished`;
- `version`;
- `license`;
- `conditionsOfAccess`;
- `url`;
- `distribution` for datasets;
- `hasPart` / `isPartOf` where semantics are exact.

The JSON-LD document is machine-readable metadata, not visible page decoration.

### 2.3 DCAT-US 3.0

DCAT-US 3.0 is the federal metadata profile for datasets, APIs, data services, distributions, dataset series, and catalog inventory records.

Authoritative reference:

- https://resources.data.gov/resources/dcat-us3/

The implementation must use DCAT-US 3.0 rather than the older Project Open Data/DCAT-US 1.1 model.

Important design consequences:

- DCAT-US is **not universal** across all CRR research-object types;
- `accessLevel` is not a DCAT-US 3.0 core field;
- plain-language `accessRights` and the structured restriction classes are preferred for modern restricted-resource metadata;
- distributions carry file/access-specific fields such as `accessURL`, `downloadURL`, media type, license, rights, and restrictions;
- JSON Schema 2020-12 is the validation target for DCAT-US 3.0.

CRR will generate DCAT-US only where the resource actually belongs in the data-catalog domain.

### 2.4 DSpace / Dublin Core

DSpace remains the curated repository authority for repository-backed records.

The existing managed metadata model remains authoritative. `dc.*` fields continue to carry standard descriptive metadata and `crr.*` fields continue to carry CRR-specific semantics that do not map cleanly to Dublin Core.

The export layer reads normalized CRR/application semantics. It does not parse raw DSpace metadata independently of the repository/application mapping layer.

---

## 3. Core architectural principle: one authority, multiple representations

The architecture is:

```text
Authoritative source facts
        │
        ├── curated DSpace record
        └── federated publisher record
                    │
                    ▼
       ResearchObjectDetail + observed version evidence
                    │
                    ▼
          ResearchMetadataProfile
                    │
        ┌───────────┼───────────────┬───────────────┐
        ▼           ▼               ▼               ▼
 DataCite 4.7   Schema.org       DCAT-US 3.0     Citation model
   export        JSON-LD         if applicable    text/BibTeX/RIS
        │           │               │               │
        └───────────┴───────────────┴───────────────┘
                    │
                    ▼
             Angular Cite / Export UI
```

### 3.1 Authority rules

1. DSpace/application metadata remains authoritative for curated CRR records.
2. The external publisher remains authoritative for federated records.
3. DSpace-native version history is authoritative for repository lineage when available.
4. Source provenance/fixity remains distinct from repository version lineage.
5. Solr/OpenSearch remain disposable discovery projections.
6. Export renderers must not query Solr/OpenSearch for authoritative metadata.
7. Export renderers must not infer missing facts from filenames, vintage labels, URLs, titles, or current clock time.
8. Export renderers must not copy current-version facts backward into older versions unless the archived version itself records them.
9. Restricted objects remain metadata-only unless a public access mechanism is explicitly recorded.
10. Standards mappings are representations of CRR facts; they are never a second source of truth.

---

## 4. New normalized profile boundary

Introduce a backend domain model named `ResearchMetadataProfile`.

The implementation may split this boundary into focused Java records/classes for identity, access, distributions, people, relations, and version evidence, but every renderer must consume the same assembled `ResearchMetadataProfile` authority boundary rather than independently re-reading repository fields.

The profile is assembled from:

- `ResearchObjectDetail`;
- observed `ResearchArtifactVersionHistory`;
- structured access guidance where recorded;
- normalized file/distribution information;
- normalized creator identity and relations.

The profile contains normalized facts, not format-specific property names.

### 4.1 Identity

- canonical CRR research-object identifier;
- research-object type;
- DOI/PID when actually recorded;
- authoritative source URL;
- repository/local URL if exposed as a resolvable public page;
- source system / authority type.

### 4.2 Description

- title;
- summary/abstract;
- publisher;
- program;
- citation;
- subjects/keywords where retained;
- geography;
- geography level;
- vintage.

### 4.3 People and organizations

- creator/author display name;
- ORCID when recorded;
- publisher organization;
- contributor roles only when the source/repository establishes them.

### 4.4 Dates and versions

- release/publication date;
- current observed version label/date;
- repository version identity when DSpace-native history exists;
- `isVersionOf`;
- `supersedes`;
- change note;
- source fixity/capture evidence where independently recorded.

### 4.5 Rights and access

- CRR access level;
- access note;
- license/reuse statement;
- structured access mechanism;
- authoritative access/application URL;
- access instructions/eligibility note;
- restriction basis/statement where known.

### 4.6 Files/distributions

For each file/distribution:

- stable local profile identifier;
- human label;
- format;
- media type when determinable from an explicit mapping;
- source/download URL;
- indirect access URL if different;
- byte size when actually known;
- license/right statement where applicable.

No local file is implied merely because a source URL exists.

### 4.7 Relations

Each normalized relation retains:

- CRR verb;
- canonical target identifier;
- target type/title if resolved;
- target DOI/PID/URL when known;
- human note;
- external-standard mapping only where semantically exact.

---

## 5. Field crosswalk contract

The final implementation documentation will include a complete field-by-field table. The table below defines the required mapping direction and interpretation.

| CRR semantic | DSpace / DC | DataCite 4.7 | Schema.org | DCAT-US 3.0 | Notes |
|---|---|---|---|---|---|
| canonical research id | `crr.identifier.source`, `dc.identifier.other` | `alternateIdentifiers` when useful; never primary DOI unless actually DOI | `identifier` | `identifier` where applicable | CRR ID is not a DOI |
| DOI | `crr.identifier.doi` | `doi` / Identifier | `identifier` as `PropertyValue` or DOI URL | `identifier` where appropriate | Preserve exact DOI |
| object type | `crr.resource.type`, `dc.type` | `resourceType` + `resourceTypeGeneral` | most specific truthful `@type` | Dataset/DataService only where applicable | Never force non-data objects into DCAT |
| title | `dc.title` | `titles` | `name` | `title` | Required in all applicable exports |
| abstract | `dc.description.abstract` | Description/Abstract | `description` | `description` | No synthetic abstract |
| publisher | `dc.publisher` | `publisher` | `publisher` | `publisher` | Organization where representable |
| program | `crr.program` | Subject/contributor context only if truthful | `about` / additional property if useful | `programCode` only if valid federal code mapping exists | Do not misuse standard fields |
| authors | `dc.contributor.author`, researcher fields | `creators` | `creator` | attribution only where profile supports | Name order preserved |
| ORCID | researcher managed metadata | `nameIdentifiers` with ORCID scheme | `sameAs` or identifier | not forced | Normalize URL vs bare ORCID at rendering boundary |
| release date | `dc.date.issued` | `publicationYear` + Date where applicable | `datePublished` | `issued` / `modified` only according to DCAT semantics | Publication year must come from an observed date/fact |
| source URL | `crr.source.url`, `dc.identifier.uri` | alternate/related identifier if semantics fit | `url` | `landingPage` / distribution access URL depending role | DSpace handle may coexist but not replace source URL |
| documentation URL | `crr.documentation.url`, `dc.relation.uri` | related identifier when semantics fit | `subjectOf` / related link if useful | `describedBy` where it is actually data documentation | Avoid semantic overreach |
| citation | `dc.identifier.citation` | generated from DataCite-compatible metadata or retained citation | `citation` | related document/rights only if appropriate | Human citation remains explicit output |
| license | `crr.rights.license` | `rightsList` / rights | `license` | distribution `license` | Restricted statement is not an open license |
| access level | `crr.rights.access` | rights/description only where useful | `conditionsOfAccess` | `accessRights` + structured restrictions | Do not export obsolete DCAT-US `accessLevel` as v3 core |
| access note | `crr.rights.accessnote` | Description/rights note if useful | `conditionsOfAccess` | `accessRights` / restriction objects | Preserve human wording |
| access mechanism | new `crr.access.mechanism` | descriptive metadata only | `conditionsOfAccess` | access restriction / access URL | e.g. FSRDC, SAP, RAP |
| access/application URL | new `crr.access.url` | alternate/related URL only if semantics fit | `url`/`conditionsOfAccess` context | distribution `accessURL` | Must be authoritative workflow URL |
| restriction basis | new `crr.access.restrictionbasis` | rights description | `conditionsOfAccess` | access/use restriction | e.g. Title 13 statement when actually known |
| geography | `dc.coverage.spatial` | `geoLocations` where sufficiently structured | `spatialCoverage` | structured `spatial` Location | Plain text may be lossy; document loss |
| vintage | `crr.vintage` | alternate date/version context only where truthful | `temporalCoverage` or additional property if semantics fit | temporal/series semantics only when truthful | Vintage is not automatic version history |
| version label | `crr.version.label` / DSpace native version | `version` | `version` | dataset series/version only when applicable | DSpace version label may be repository-specific |
| version date | `crr.version.date` / DSpace native version date | Date | `dateModified`/version context if truthful | `modified` only when semantically correct | Do not confuse release date and repository version date |
| isVersionOf | managed provenance / DSpace lineage | `IsVersionOf` | `isPartOf` is NOT a replacement; use explicit identifier/additional relation if needed | series relation only when appropriate | Keep relation semantics exact |
| supersedes | managed provenance / DSpace adjacency | `IsNewVersionOf` when direction/meaning is established | no forced approximation | no forced approximation | Repository adjacency must support assertion |
| source SHA-256 | `crr.provenance.sha256` | alternate identifier/description only if appropriate | `sha256` only for distributions/content when semantics fit | checksum only if profile supports and is actual distribution checksum | Never derive from URL |
| captured-at | `crr.provenance.capturedat` | Date if role is accurately expressible | additional property only if useful | not forced | Sync time is not capture time |
| relations | `crr.relation.edge` | `relatedIdentifiers` with exact relation type | `hasPart`, `isPartOf`, `citation`, etc. only if exact | DCAT relation only where applicable | Unmapped CRR relation stays documented rather than distorted |
| files | `crr.file.manifest` plus DSpace bundles when available | formats/sizes/related identifiers as appropriate | `distribution` for dataset downloads | `distribution` | Restricted objects may intentionally have zero files |

---

## 6. DataCite 4.7 mapping rules

### 6.1 Registration readiness

Every DataCite-oriented export exposes a readiness assessment separate from the mapped metadata.

Readiness states are:

- `REGISTRATION_READY`;
- `MISSING_DOI`;
- `MISSING_MANDATORY_METADATA`.

A record is registration-ready only when:

- DOI is present and passes the CRR DOI syntax validator;
- at least one creator is present;
- title is present;
- publisher is present;
- publication year can be truthfully obtained;
- a DataCite `resourceTypeGeneral` mapping exists.

The application does **not** register or mint the DOI.

### 6.2 Resource type mapping

| CRR type | DataCite resourceTypeGeneral |
|---|---|
| DATASET | Dataset |
| PUBLICATION | Text |
| CODE | Software |
| METHODOLOGY | Text |
| SUPPORTING_MATERIAL | Other |
| PROJECT | Project |

The free-text `resourceType` preserves the more specific CRR meaning where useful.

### 6.3 Creators and ORCID

Authors map to DataCite creators.

ORCID mapping is emitted only when a valid recorded ORCID is present. The renderer may normalize a bare ORCID to the canonical `https://orcid.org/...` identifier form but may not invent an ORCID.

### 6.4 Relations

Truthful initial relation mappings:

| CRR/repository relation | DataCite relation |
|---|---|
| `hasPart` | `HasPart` |
| inverse part relation if later modeled | `IsPartOf` |
| `documents` | `Documents` |
| inverse documentation if later modeled | `IsDocumentedBy` |
| `isDerivedFrom` | `IsDerivedFrom` |
| DSpace/native specific-version → conceptual artifact | `IsVersionOf` |
| newer archived version → previous archived version | `IsNewVersionOf` only when adjacency/change semantics justify it |
| previous archived version → newer archived version | `IsPreviousVersionOf` where direction is explicitly rendered |
| `uses` | no default forced mapping |

`uses` remains unmapped by default because `References`, `Requires`, and `IsDerivedFrom` each mean something narrower than generic use.

The crosswalk documents this intentional loss rather than claiming universal relation coverage.

---

## 7. Schema.org JSON-LD rules

Schema.org output is generated from the normalized profile and included on public research detail pages as an `application/ld+json` script element.

### 7.1 Requirements

- one structured-data document per displayed canonical research object;
- title/name must match the human-visible object;
- identifiers must remain distinguishable by scheme;
- DOI must not be fabricated;
- creator and ORCID must come from normalized author identity;
- restricted resources may be indexed as metadata but must not expose a fake public download;
- dataset distributions are emitted only for actual public source distributions/files;
- JSON-LD generation remains backend-owned, not manually duplicated in templates.

### 7.2 Restricted dataset behavior

For the existing LEHD restricted microdata fixture:

- Schema.org type remains `Dataset` because the described resource is genuinely a dataset;
- `conditionsOfAccess` states the restricted access conditions;
- authoritative FSRDC/access guidance is linked when recorded;
- no `DataDownload` is emitted because CRR holds no downloadable confidential data;
- no fake authentication/action endpoint is emitted.

---

## 8. DCAT-US 3.0 applicability and rules

### 8.1 Applicability

DCAT-US generation is available for:

- DATASET;
- future API/data-service resource types if explicitly modeled;
- future dataset-series records when explicitly modeled.

DCAT-US is **not generated** for:

- PUBLICATION;
- CODE merely because code is downloadable;
- METHODOLOGY;
- SUPPORTING_MATERIAL;
- PROJECT.

Those objects remain discoverable through CRR, DataCite-oriented metadata where appropriate, and Schema.org.

### 8.2 Dataset/distribution distinction

A CRR dataset becomes a DCAT-US Dataset record.

Each actual public file/access representation may become a Distribution.

A source landing page alone is not automatically a downloadable Distribution.

A restricted dataset with no files may still have dataset-level metadata and access restrictions. If an authoritative application/request page exists, it may be represented as indirect access according to DCAT-US semantics; it must not be represented as a direct download.

### 8.3 Restrictions

The profile supports:

- `accessRights` plain-language statement;
- structured AccessRestriction where enough information is recorded;
- structured UseRestriction where enough information is recorded;
- CUIRestriction only if CRR later records authoritative CUI facts.

CRR must not infer a CUI classification from generic restriction language.

---

## 9. Structured restricted-access model

Issue #115 extends the normalized internal model because the current `accessLevel` + `accessNote` pair is useful for humans but insufficiently structured for interoperable access guidance.

Initial fields:

- `accessMechanism` — controlled CRR value: `FSRDC`, `SAP`, `REMOTE_ACCESS`, `PUBLISHER_WORKFLOW`, `OTHER`;
- `accessUrl` — authoritative application/request/access-information URL;
- `accessInstructions` — human explanation of eligibility/process;
- `restrictionBasis` — legal/policy basis when known.

### 9.1 DSpace managed metadata

Managed fields:

- `crr.access.mechanism`;
- `crr.access.url`;
- `crr.access.instructions`;
- `crr.access.restrictionbasis`.

These fields participate in DSpace APPLY/DIFF reconciliation with the same no-invention behavior as existing `crr.*` managed fields.

### 9.2 LEHD restricted fixture

The existing `lehd-microdata-restricted` fixture is the primary restricted-access verification record.

Expected semantics:

- resource type: DATASET;
- access level: RESTRICTED;
- access mechanism: FSRDC;
- access URL: authoritative Census FSRDC information/application workflow page;
- restriction basis: Title 13 where already explicitly recorded;
- zero public file downloads;
- citation remains available;
- research-package relations remain available;
- metadata remains searchable and exportable;
- no protected records are stored by CRR.

---

## 10. Export service boundary and API contract

Introduce a backend `ResearchMetadataExportService` whose input is the assembled `ResearchMetadataProfile`.

Responsibilities:

- build profile from canonical research identity;
- render DataCite 4.7-oriented JSON;
- render Schema.org JSON-LD;
- render DCAT-US 3.0 when applicable;
- render canonical human citation;
- render BibTeX;
- render RIS.

Format-specific logic must not leak into Angular components.

### 10.1 Exact API paths

The implementation uses these explicit endpoints:

```text
GET /research/{researchId}/metadata-profile
GET /research/{researchId}/exports/datacite
GET /research/{researchId}/exports/schema-org
GET /research/{researchId}/exports/dcat-us
GET /research/{researchId}/exports/citation
GET /research/{researchId}/exports/bibtex
GET /research/{researchId}/exports/ris
```

Response media types:

- metadata profile: `application/json`;
- DataCite: `application/json`;
- Schema.org: `application/ld+json`;
- DCAT-US: `application/json`;
- citation: `text/plain; charset=UTF-8`;
- BibTeX: `application/x-bibtex; charset=UTF-8` where supported by Spring content negotiation, otherwise documented `text/plain; charset=UTF-8` fallback;
- RIS: `application/x-research-info-systems; charset=UTF-8` where supported, otherwise documented `text/plain; charset=UTF-8` fallback.

API behavior:

- the profile is assembled once through one backend authority path;
- all renderers consume that profile;
- `/exports/dcat-us` returns HTTP `409` with a typed `EXPORT_NOT_APPLICABLE` problem response for non-DCAT resource types rather than returning a misleading document;
- DataCite export remains available for non-registration-ready records and carries its readiness state without inventing mandatory values;
- malformed research IDs retain current 400 behavior;
- unknown objects retain current 404 behavior.

The OpenAPI contract must model these endpoints and typed error behavior explicitly.

---

## 11. Citation formats

### 11.1 Human citation

The preferred human citation is the authoritative retained citation when the repository/source already supplies one.

If a deterministic fallback is needed, it is built from normalized fields with a documented algorithm. The fallback must never assert an author, year, DOI, or version that is unknown.

### 11.2 BibTeX

BibTeX generation is backend-owned.

Type mapping must be conservative. Examples:

- PUBLICATION → an appropriate article/misc form only when publication metadata supports it;
- DATASET → `@misc` when no more precise interoperable type is supported by the chosen BibTeX contract;
- CODE → `@software` only if the chosen BibTeX contract supports it; otherwise documented fallback;
- PROJECT/METHODOLOGY/SUPPORTING_MATERIAL → documented conservative fallback.

### 11.3 RIS

RIS generation follows the same normalized citation object.

BibTeX and RIS must not have separate metadata business rules.

---

## 12. Angular user experience

Both Angular experiences consume the backend export model.

### 12.1 Discovery UI

Add a compact `Cite / Export` area to research detail.

Functions:

- show canonical human citation;
- copy citation;
- expose DataCite JSON;
- expose Schema.org JSON-LD;
- expose DCAT-US only for applicable dataset records;
- expose BibTeX;
- expose RIS;
- preserve DOI and ORCID as native links;
- retain restricted-access guidance near access metadata.

### 12.2 Mobile-first Census UI

Use the same backend export data with a mobile-appropriate presentation:

- compact action group/disclosure;
- copy citation;
- format links/actions large enough for touch;
- no horizontally overflowing JSON preview requirement;
- source/access guidance remains prominent for restricted objects.

### 12.3 Accessibility contract

Copy/export behavior must provide:

- native buttons/links;
- keyboard operation;
- visible focus;
- status announcement after successful copy;
- alert/status announcement after copy failure;
- no color-only success signal;
- reflow at narrow viewport / 400% zoom-equivalent conditions;
- meaningful link names including format;
- JSON-LD script excluded from accessibility tree/visual reading order;
- no focus loss after copy action.

---

## 13. Search projection restraint

The complete export/profile document must **not** be indexed wholesale into Solr or OpenSearch.

Only discovery-useful fields already justified by the search experience may be projected, such as:

- research-object type;
- DOI/PID;
- authors;
- citation;
- access level;
- release/version label where actually useful for display/faceting.

Any new indexed field requires a concrete discovery use case and parity across supported search engines.

The export service must continue working if Solr/OpenSearch are rebuilt from zero.

---

## 14. Verification strategy

Verification is a product requirement for #115, not a final cleanup task.

Every implementation PR includes tests that prove both positive behavior and the important negative truth boundaries.

### 14.1 Verification layers

#### Layer A — normalized profile unit tests

Representative records:

- public DATASET;
- DOI-bearing PUBLICATION;
- CODE;
- METHODOLOGY;
- PROJECT;
- restricted DATASET;
- partial-metadata object;
- object with observed two-version DSpace lineage.

Assertions include:

- no fabricated DOI;
- no fabricated creator;
- no fabricated publication year;
- no source/repository authority conflation;
- restricted object retains metadata with zero downloadable files;
- version adjacency is derived only from observed lineage;
- optional missing metadata remains absent/unknown.

#### Layer B — DSpace sync and idempotence

For new `crr.access.*` fields:

1. APPLY writes explicitly supplied values;
2. repository readback returns those values;
3. DIFF immediately settles to `SKIP_ITEM`;
4. unrelated repository-added metadata is tolerated according to managed-field policy;
5. missing source access field does not erase repository evidence unless the existing reconciliation contract explicitly says it should;
6. restricted object remains fileless.

#### Layer C — DataCite mapping tests

Required cases:

- actual DOI maps to DataCite primary identifier;
- missing DOI produces `MISSING_DOI`, never a fake primary identifier;
- creator/ORCID mapping;
- mandatory-property readiness;
- publication year derived only from an observed supported date;
- resource-type mapping for all CRR types;
- abstract/description mapping;
- rights/license mapping;
- version mapping;
- DSpace-native `IsVersionOf` / previous-new-version relations where supported;
- `hasPart`, `documents`, `isDerivedFrom` mappings;
- generic `uses` remains intentionally unmapped by default;
- partial metadata produces a truthful non-registration-ready result.

#### Layer D — Schema.org tests

Required cases:

- correct `@context` and truthful `@type`;
- dataset distribution output for public files;
- DOI/identifier distinction;
- ORCID creator identity;
- version field from observed version semantics;
- restricted dataset emits `conditionsOfAccess` and no fake `DataDownload`;
- JSON serialization escapes text safely;
- JSON-LD on page matches backend export semantics.

#### Layer E — DCAT-US 3.0 tests

Required cases:

- public DATASET emits Dataset record;
- public files become valid Distributions;
- restricted DATASET emits access/restriction guidance without download URL;
- PUBLICATION returns not-applicable;
- CODE returns not-applicable;
- METHODOLOGY returns not-applicable;
- PROJECT returns not-applicable;
- generated dataset document validates against pinned DCAT-US 3.0 JSON Schema 2020-12;
- obsolete v1.1-only assumptions are not introduced as v3.0 core semantics.

#### Layer F — citation formatter tests

Required cases:

- retained authoritative citation preserved;
- deterministic fallback with complete metadata;
- fallback with missing author/date does not invent placeholders presented as facts;
- BibTeX escaping;
- RIS line formatting;
- DOI included only when real;
- version included only when observed and useful.

#### Layer G — OpenAPI/client drift

CI must prove:

- OpenAPI lint passes;
- Java generated contract compiles;
- TypeScript generated client is current;
- no uncommitted generated drift remains;
- response schemas represent applicability/readiness explicitly.

#### Layer H — Angular component/NgRx tests

Required states:

- export/profile load success;
- partial metadata;
- restricted object;
- DCAT applicable;
- DCAT unavailable/not applicable;
- copy success;
- copy failure;
- network/export failure;
- JSON-LD insertion/update;
- route change replaces old JSON-LD rather than accumulating scripts.

#### Layer I — Storybook + axe

Stories required for:

- public dataset;
- DOI-bearing publication;
- restricted dataset;
- partial metadata;
- history available;
- citation copied status;
- copy error status;
- export unavailable/error.

Axe must remain green for all required stories.

#### Layer J — browser evidence

Chromium, Firefox, WebKit:

- tab to Cite / Export controls;
- activate copy with keyboard;
- verify semantic success status;
- activate format links/actions;
- restricted access guidance readable and reachable;
- narrow viewport/reflow;
- no keyboard trap;
- no focus loss;
- no horizontal overflow caused by export controls;
- machine-readable JSON-LD exists without visible UI noise.

#### Layer K — live-stack evidence

Against the real local/CI service stack:

- fetch an actual DSpace-backed research detail;
- fetch DataCite export;
- fetch Schema.org export;
- fetch applicable DCAT-US export;
- verify restricted record remains fileless;
- verify a publication returns DCAT not-applicable;
- verify native DSpace version 2/1 lineage survives into relevant export relations;
- verify Solr/OpenSearch rebuild is not required to generate full exports.

#### Layer L — existing regression gates

No #115 PR merges without:

- normal repository CI;
- repository API tests;
- frontend lint/unit/build;
- Storybook + axe;
- live Solr/OpenSearch;
- Chromium/Firefox/WebKit evidence;
- required MapLibre regression;
- DSpace provenance/version-lineage regression.

The export work is not allowed to weaken #114 evidence.

### 14.2 Deterministic/golden-output verification

Structured exports and citation formats must be deterministic for identical profile input.

Tests must prove:

- stable array ordering where order is semantic or exposed in committed evidence;
- stable object construction/serialization sufficient for golden-file review;
- no current timestamp is injected merely by rendering;
- no random identifier is introduced by rendering;
- golden examples are regenerated only when a reviewed semantic change occurs.

---

## 15. Dedicated standards validation command

The required repository-level command is:

```text
pnpm metadata:validate
```

Its responsibility is to validate representative generated metadata independently of Angular rendering.

Validation sequence:

1. produce canonical representative profile fixtures;
2. render DataCite-oriented JSON;
3. validate CRR DataCite readiness invariants;
4. render Schema.org JSON-LD and validate structural invariants;
5. render DCAT-US for applicable fixtures;
6. validate DCAT-US documents with the pinned official JSON Schema 2020-12 definition;
7. verify non-applicable resource types do not emit DCAT documents;
8. verify restricted fixture has no public distribution download;
9. verify golden outputs are deterministic;
10. fail non-zero on any violation.

This command becomes a required CI gate rather than an optional developer utility.

External schemas used in CI must be pinned or vendored with provenance/version documentation so builds are deterministic and do not silently change when an upstream `latest` URL changes.

---

## 16. Three-PR implementation sequence

### PR 1 — Metadata profile foundation

Branch: `feat/open-census-metadata-profile`

Scope:

- normalized `ResearchMetadataProfile` boundary;
- structured `crr.access.*` model;
- DSpace mapping/reconciliation;
- restricted LEHD fixture enhancement;
- verbose canonical crosswalk documentation;
- profile tests and DSpace idempotence evidence.

Exit criteria:

- representative profile tests green;
- restricted object reads back structured access metadata;
- APPLY → DIFF settles;
- no fake files or access workflow;
- existing #114 lineage regression remains green;
- documentation explains every normalized field and authority source.

### PR 2 — Structured export engine

Branch from merged PR 1: `feat/open-census-metadata-exports`

Scope:

- DataCite 4.7 renderer/readiness;
- Schema.org JSON-LD renderer;
- DCAT-US 3.0 dataset renderer;
- citation model;
- BibTeX;
- RIS;
- OpenAPI export boundary;
- `metadata:validate` CI gate.

Exit criteria:

- schema/profile tests green;
- DataCite no-fake-DOI tests green;
- DCAT-US JSON Schema validation green;
- relation/version mapping tests green;
- deterministic golden exports green;
- generated clients drift-free;
- live API evidence for representative records.

### PR 3 — Cite / Export UX and browser evidence

Branch from merged PR 2: `feat/open-census-cite-export-ui`

Scope:

- Discovery UI Cite / Export UX;
- Census mobile Cite / Export UX;
- copy status/error behavior;
- Schema.org JSON-LD page injection;
- Storybook states;
- browser evidence;
- final documentation/demo narrative.

Exit criteria:

- component/NgRx tests green;
- Storybook + axe green;
- copy success/failure semantically announced;
- JSON-LD DOM assertion green;
- cross-browser keyboard/reflow evidence green;
- live Solr/OpenSearch green;
- MapLibre regression green;
- DSpace provenance/version regression green;
- #115 crosswalk and operational docs complete.

Issue #115 closes only after PR 3 and all issue-level exit criteria pass.

---

## 17. Documentation deliverables

Documentation is a first-class output of #115.

At completion the repository contains, at minimum:

### 17.1 `documentation/open-census-metadata-profile.md`

A durable implementation reference containing:

- architecture and authority model;
- supported standards and exact versions;
- complete field crosswalk;
- requirement/cardinality notes;
- resource-type mapping;
- relation mapping;
- version semantics;
- restricted-access mapping;
- known lossy mappings;
- examples for each major CRR object type;
- distinction between DataCite-compatible export and DOI registration;
- distinction between Schema.org web discoverability and repository authority;
- why DCAT-US is intentionally dataset-scoped.

### 17.2 `documentation/metadata-export-verification.md`

Operational verification guide containing:

- commands;
- representative fixture IDs;
- expected DataCite readiness states;
- DCAT validation command;
- JSON-LD inspection instructions;
- restricted-object assertions;
- browser accessibility evidence;
- expected CI jobs/artifacts;
- troubleshooting boundaries.

### 17.3 Existing architecture/status documentation

Update repository architecture/status/demo documents so they accurately state:

- DSpace/application authority;
- structured export availability;
- standards and versions;
- search projection restraint;
- restricted-object behavior;
- no DOI minting;
- no official Open Census implementation claim.

### 17.4 Generated examples

Keep committed, deterministic examples for:

- public dataset;
- DOI-bearing publication;
- restricted dataset;
- versioned repository dataset;
- methodology/project relation example.

Examples should be generated by production renderers where practical to prevent documentation drift.

---

## 18. CI evidence and artifact retention

CI uploads a small metadata-evidence artifact analogous to the DSpace provenance artifact.

Required artifact contents:

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

`validation-summary.json` records:

- exact standards versions;
- fixture identifiers;
- DataCite readiness state;
- DCAT applicability state;
- schema validation result;
- restricted-download assertion;
- deterministic-output assertion;
- build SHA.

No confidential or restricted microdata enters the artifact. Only metadata about the existing metadata-only restricted fixture is allowed.

---

## 19. Failure and error semantics

The export layer fails explicitly rather than silently downgrading truth.

Examples:

- missing DOI → DataCite readiness reports missing DOI, not generated DOI;
- missing creator → non-registration-ready DataCite result;
- publication requested as DCAT-US → HTTP 409 typed `EXPORT_NOT_APPLICABLE` response;
- malformed canonical ID → 400;
- unknown object → 404;
- inaccessible repository history → profile can still expose current observed detail but must not synthesize version relationships;
- copy API unavailable in browser → visible/announced failure, citation remains selectable manually;
- DCAT validator failure → CI fails;
- JSON-LD serialization failure → test/CI failure, not empty script injection.

---

## 20. Security, privacy, and restricted-data boundary

This remains a public demo repository, but metadata correctness around restricted resources is security-relevant because bad metadata could imply access that does not exist.

The design forbids:

- storing confidential LEHD microdata;
- fabricating restricted-resource download links;
- simulating an FSRDC/SAP authorization workflow;
- emitting credentials/tokens in exports;
- implying that a metadata record grants access;
- converting an application-information URL into a direct download;
- exposing internal-only operational endpoints as dataset distributions.

The restricted object is a citable metadata record describing a resource and its legitimate access path, nothing more.

---

## 21. Performance and caching

Exports are small metadata documents.

Initial implementation uses deterministic on-demand generation from the normalized profile rather than introducing a separate export persistence/cache subsystem.

Reasons:

- one authority path remains easier to verify;
- documents are small;
- stale export invalidation is avoided;
- search indexes remain decoupled;
- premature caching adds little demo value.

If profiling later demonstrates a real problem, HTTP caching/ETag behavior can be added without changing the profile contract.

---

## 22. Non-goals

Issue #115 does not include:

- DOI minting or DataCite registration APIs;
- claiming CRR is an official U.S. Census Bureau Open Census implementation;
- replacing `crr.*` metadata with DataCite/DCAT fields;
- implementing every DataCite optional property;
- universal DCAT export for every research object;
- full RDF triple-store architecture;
- graph database adoption;
- generic ontology reasoning;
- storing confidential data;
- fake access authorization;
- search-index copies of entire export documents;
- inferred author identities/ORCIDs;
- inferred version history;
- inferred legal restriction classifications.

---

## 23. Design risks and mitigations

### Risk: standards become a second domain model

Mitigation: render only from `ResearchMetadataProfile`, which itself is assembled from the existing canonical detail/version authority path.

### Risk: DataCite export looks registration-ready when no DOI exists

Mitigation: explicit readiness state and mandatory `MISSING_DOI` test coverage.

### Risk: DCAT is over-applied

Mitigation: applicability policy is type-gated and tested negatively for publications/code/methodology/projects.

### Risk: restricted metadata implies downloadable data

Mitigation: structured access model, zero-file assertions, browser tests, and DCAT/Schema.org negative distribution assertions.

### Risk: relation semantics are distorted for standards compliance

Mitigation: relation mappings are allowlisted. Unknown/imperfect mappings remain unmapped and documented.

### Risk: version semantics regress into inferred chronology

Mitigation: #114 DSpace lineage tests remain required regression gates for all #115 PRs.

### Risk: docs drift from implementation

Mitigation: examples are generated from production renderers where practical; validation evidence is emitted by CI; the crosswalk is reviewed in each implementation PR.

### Risk: external schemas change under CI

Mitigation: pin exact standards versions and vendor/cache deterministic validation artifacts with provenance.

---

## 24. Definition of done for issue #115

Issue #115 is complete only when all statements below are proven with automated evidence:

1. One normalized metadata profile drives all structured exports.
2. DSpace/application authority remains intact.
3. DataCite 4.7-oriented metadata is produced without inventing a DOI.
4. DOI-bearing representative records can be assessed for registration readiness.
5. Schema.org JSON-LD is generated and embedded on public detail pages.
6. DCAT-US 3.0 is generated only for applicable data resources.
7. DCAT-US output validates against the pinned official 3.0 JSON Schema.
8. Restricted metadata exposes legitimate access guidance and zero fake downloads.
9. Relations map only where semantically truthful.
10. Observed DSpace-native version lineage survives into export semantics without reconstructed history.
11. Human citation, BibTeX, and RIS share one normalized citation authority.
12. Both Angular experiences provide accessible Cite / Export behavior.
13. Copy success and failure are semantically announced.
14. OpenAPI/generated clients are drift-free.
15. Search remains a derived projection rather than export authority.
16. Storybook + axe passes required states.
17. Chromium/Firefox/WebKit evidence passes.
18. Live Solr/OpenSearch evidence passes.
19. MapLibre regression remains green.
20. DSpace APPLY/DIFF provenance/version-lineage regression remains green.
21. Verbose standards/crosswalk/verification documentation is committed and consistent with production behavior.
22. Structured exports and evidence examples are deterministic for identical authoritative input.

The user-facing and machine-facing result must answer:

> What is this research object, who/what is authoritative for its metadata, how can it be cited or accessed, what version evidence is actually known, and how is that same truth represented for external standards consumers?

without manufacturing an identifier, relationship, access path, version, or provenance fact.
