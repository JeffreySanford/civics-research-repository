# Open Census Alignment Roadmap

Status: active planning baseline after PR #113

Last reconciled: 2026-09-12

## Purpose

This document is the post-#113 implementation plan for aligning Civics Research Repository with the public Open Science direction the U.S. Census Bureau has described for **Open Census**.

It is a planning and architecture document for an **independent reference implementation**. It does not claim that this repository is an official Census Bureau product, that it implements an internal Census architecture, or that the author's specific contractor assignment is the Open Census project.

The repository has already demonstrated enough mapping, search, Angular, accessibility, and scale engineering that the highest-value next work is no longer "add another layer." The next coherent story is:

```text
metadata
   ↓
identity
   ↓
versioning
   ↓
provenance
   ↓
reproducibility
   ↓
stewardship
```

That sequence keeps the existing architecture intact while making the repository much closer to a real Open Science research repository rather than a dataset/search portal with rich demonstration records.

## Public Census direction used as the alignment source

The roadmap is grounded in public Census material, not inferred internal requirements.

### Open Census

The Census Bureau describes Open Census as providing infrastructure, guidance, and **standardized metadata** so researchers can share research articles, code, and data.

- Census Research Transparency and Public Access: <https://www.census.gov/topics/research/research-transparency-public-access.html>

### Metadata, identity, versioning, and AI-readable research

The Census Scientific Advisory Committee recommended using existing metadata/documentation standards where possible and clarifying how metadata advances discoverability and reproducibility. Census accepted those recommendations.

The Census response specifically identifies:

- persistent identifiers;
- source citations;
- artifact versioning;
- DOI/ORCID links connecting research, code, and underlying data;
- metadata that improves discoverability, usability, and reusability;
- metadata that can improve how AI reads and captures research and data.

- CSAC Fall 2024 recommendations and Census responses: <https://www2.census.gov/about/partners/cac/sac/meetings/2024-09/csac-fall-2024-recommendations.pdf>

### Open Code and reproducibility

Census now explicitly presents GitHub as a channel for statistical and research code and describes transparency, reproducibility, reusability, documentation, and README quality as Open Census concerns.

- Open Code: <https://www.census.gov/topics/research/research-transparency-public-access/open-code.html>

### Restricted-use data remain part of the scientific record

Open Science does not mean pretending protected data are public. Census guidance says restricted-use data should still be cited so readers can identify what underlies the research and how qualified researchers may seek legitimate access.

- Restricted-use data citation guidance: <https://www.census.gov/topics/research/guidance/restricted-use-microdata/citations-for-restricted-use-data.html>

This aligns with the repository's existing decision to describe restricted LEHD microdata while exposing no protected files.

## Current repository baseline

The following capabilities are **already delivered** and should not be rebuilt merely to satisfy a roadmap label.

### Research-object domain model

The repository already models:

- `DATASET`;
- `PUBLICATION`;
- `CODE` as a supported type, though not yet exercised by a real object;
- `METHODOLOGY`;
- `SUPPORTING_MATERIAL`;
- `PROJECT`;
- access levels;
- licenses/reuse statements;
- DOI;
- researchers and optional ORCID;
- citations;
- typed research-object relations;
- restricted-use metadata without protected bitstreams.

### Generalized synchronization model

The old dataset-only live-sync limitation has already been removed.

`ResearchObjectMetadata` replaced the old dataset-shaped model and carries research-object type, access level/note, license, DOI, authors/ORCID, and typed relations through the synchronization boundary. `DspaceManagedFields` and the payload mapper reconcile those fields into DSpace.

The remaining live-sync gap is **adapter breadth**, not model capability: only a narrow source slice currently reconciles live.

Do not create a future issue whose primary purpose is to rename `PublicDatasetMetadata` to `ResearchObjectMetadata`; that work is already present on `main`.

### Authority model

The architectural boundary remains a strength:

- DSpace owns curated repository objects, repository metadata, relationships, access statements, versions, and bitstreams;
- application PostgreSQL retains federated metadata, sync/checkpoint/evidence state, and other application-owned operational facts;
- Solr/OpenSearch are disposable discovery projections, not the authoritative relation/provenance graph;
- the generated OpenAPI boundary is the browser contract;
- both Angular frontends consume the same typed backend authority.

Future Open Science work should reinforce this boundary rather than denormalize every field into the search engines.

### Two user experiences over one authority model

The repository already has the architecture needed to demonstrate the user-segmentation direction Census accepted from CSAC:

- `apps/discovery-ui` can serve the denser research/power-user workflow;
- `apps/census-mobile-frontend` can emphasize progressive disclosure, concise explanations, and small-screen evidence;
- both consume the same API, search infrastructure, provenance rules, and research-object semantics.

This should be described as **two experiences over one authority model**, not as desktop/mobile duplication.

### Search, explainability, accessibility, and scale

The repository already proves:

- Solr/OpenSearch search projection engineering;
- server-owned ranking/relevance evidence;
- explainability (`Why this matched`);
- million-record corpus behavior;
- URL-owned discovery state;
- Storybook + axe;
- Playwright cross-browser evidence;
- reflow/forced-colors/reduced-motion engineering;
- semantic alternatives for map information;
- explicit separation between automated accessibility evidence and unperformed manual AT/Trusted Tester work.

These remain important, but they are no longer the primary architectural gap.

### Geospatial capability after PR #113

PRs #107, #109, #111, and #113 together now demonstrate:

- compact mobile Research Coverage preview;
- lazy interactive MapLibre research map;
- semantic mapped-research equivalents;
- map/list/detail selection synchronization;
- Census-area context without mutating repository search intent;
- authoritative county geometry;
- Census Population Estimates context;
- source and geometry vintages;
- source provenance links;
- `sourceSha256` / capture evidence in the Population Estimates contract;
- non-WebGL semantic county values;
- accessibility and 320px evidence.

That is enough to prove the geospatial skill. More thematic layers are deferred unless a concrete product question requires them.

## Confirmed architectural gaps

### Gap 1 — Version history is not authoritative

The strongest current defect is the dataset version service: it manufactures a previous release from `vintageYear` rather than reading observed repository/source version facts.

A provenance-aware repository must prefer **unknown** over an invented historical version.

This is the first implementation target.

### Gap 2 — Interoperability is implicit rather than profiled

The repository has rich internal metadata but does not yet expose one documented standards crosswalk or structured research-object export profile.

The next step is not replacing `crr.*`; it is mapping the existing authority model to established standards.

Planned standards:

- Dublin Core / DSpace for repository-native descriptive metadata;
- DataCite Metadata Schema 4.7 for scholarly/research-resource identity and relationships;
- Schema.org JSON-LD for web/machine discoverability;
- DCAT-US 3.0 for datasets/APIs/data services where the model fits.

References:

- DataCite metadata schema: <https://support.datacite.org/docs/datacite-metadata-schema>
- DCAT-US 3.0: <https://resources.data.gov/resources/dcat-us3/>

DCAT-US is **not** a universal representation for publications, code, methodology, and projects. Use it for data resources rather than forcing every research object into a dataset catalog vocabulary.

### Gap 3 — Relationships are present but not yet a reproducibility narrative

The repository already distinguishes asserted Research Package relations from heuristic `relatedResearch`. Preserve that distinction.

The useful next step is a semantic reproducibility trail showing what is actually asserted, for example:

```text
publication
    ↓
underlying data
    ↓
methodology
    ↓
statistical/research code
    ↓
replication/supporting material
```

Every node should retain PID/version/citation/access/provenance semantics. Restricted nodes remain traceable without becoming downloadable.

### Gap 4 — Stewardship validates operations, not Open Science metadata quality

`/steward` already exposes repository/search/sync/evidence health. It should next identify deterministic metadata defects such as missing citations, malformed identifiers, missing access pathways, dangling relations, or unsupported version claims.

Do not create a meaningless aggregate quality score.

### Gap 5 — `CODE` is supported but not exercised by a real object

The enum/model supports code but the repository does not yet have a genuine CODE object.

A strong real candidate is the Census Bureau's public `uscensusbureau/recon_replication` repository. Its README documents a real replication package, public and confidential inputs, data provenance, Title 13 constraints, AWS computational requirements, and reproducibility limits.

The integration must preserve source truth: no invented DOI, authorship, release, top-level license, or CITATION file.

### Gap 6 — Map provenance exists but is not yet a reconstructable analytical context

PR #113 already carries source vintage, checksum, capture date, geometry vintage, geography, measure, and semantic values.

The final map-oriented increment should make those facts shareable/reconstructable through typed state rather than add more visual layers.

## Ordered implementation sequence

The issues are deliberately small enough to review independently while building on one another.

### #114 — Make artifact version identity and provenance authoritative

Issue: <https://github.com/JeffreySanford/civics-research-repository/issues/114>

**Primary outcome:** remove synthetic prior-version behavior and establish observed artifact version/provenance semantics.

Core acceptance:

- version facts come from repository/source evidence;
- `vintageYear` does not manufacture a previous version;
- unknown history is represented as unknown;
- version/PID/source/fixity/capture semantics survive the application boundary;
- any search-index projection remains discovery-focused;
- detail UI explains observed vs unavailable history.

This is the foundation for every later issue.

### #115 — Define Open Census metadata profile and structured exports

Issue: <https://github.com/JeffreySanford/civics-research-repository/issues/115>

**Primary outcome:** one documented CRR → DSpace/DataCite/Schema.org/DCAT-US crosswalk and one normalized export boundary.

Core acceptance:

- internal `crr.*` authority remains intact;
- DataCite 4.7 mapping is explicit;
- Schema.org JSON-LD is emitted on research detail;
- DCAT-US 3.0 is dataset/data-service scoped;
- Cite/Export is available to users;
- restricted access mechanisms can be expressed without simulated authorization;
- no DOI-minting claim is made.

### #116 — Expose a reproducibility trail across related research artifacts

Issue: <https://github.com/JeffreySanford/civics-research-repository/issues/116>

**Primary outcome:** turn asserted package relationships into an understandable publication/data/methodology/code/supporting-material trail.

Core acceptance:

- asserted edges and heuristic related research remain separate;
- relation targets resolve current metadata at read time;
- PID/version/access/citation/provenance are visible per node;
- restricted-use dependencies remain in the scientific trail but expose no prohibited download;
- semantic HTML is authoritative; no graph database or canvas-only visualization is required.

### #117 — Add Open Science metadata-quality findings to Steward

Issue: <https://github.com/JeffreySanford/civics-research-repository/issues/117>

**Primary outcome:** deterministic, actionable metadata findings in the read-only Steward experience.

Core acceptance:

- stable rule IDs and severities;
- rule evidence and remediation are reviewable;
- missing DOI/ORCID is not blindly treated as an error when the source does not establish one;
- restricted-download mistakes and dangling relations can be flagged;
- version claims must have evidence;
- no opaque percentage score or auto-repair workflow.

### #118 — Integrate a real Census CODE object and replication package

Issue: <https://github.com/JeffreySanford/civics-research-repository/issues/118>

**Primary outcome:** exercise the complete research-object path with a genuine Census code/replication artifact.

Selected candidate: <https://github.com/uscensusbureau/recon_replication>

Core acceptance:

- CODE survives source → sync → DSpace → API → search → Angular;
- observed commit/release facts use #114 semantics;
- exports use #115 semantics;
- public/restricted dependencies appear through #116 semantics;
- #117 can validate the real object;
- no confidential data are downloaded or mirrored;
- no source facts are fabricated.

### #119 — Make analytical and map context shareably reproducible

Issue: <https://github.com/JeffreySanford/civics-research-repository/issues/119>

**Primary outcome:** reconstruct research search + geography + measure + data vintage + geometry vintage + source evidence from typed shareable state.

Core acceptance:

- research-search intent remains separate from analytical context;
- source facts are verified from authoritative returned data, not trusted solely from URL values;
- current Population Estimates/geometry provenance is visible as semantic evidence;
- non-WebGL use remains complete;
- no new thematic layer is required.

## Dependency shape

```text
#114 authoritative version/provenance
   |
   v
#115 metadata profile + exports
   |
   +--------------------+
   |                    |
   v                    v
#116 reproducibility   #119 reproducible analysis context
   |
   v
#117 steward quality
   |
   v
#118 real CODE/replication object
```

The implementation order remains #114 → #115 → #116 → #117 → #118 → #119 even though #119 has fewer dependencies, because the repository should first complete the core Open Science narrative before returning to map work.

## PR planning standard

Each implementation issue should normally become one focused PR unless the issue itself proves too large during implementation.

Every PR description should contain:

1. **Problem statement** — the observed repository defect/gap, not merely the requested UI.
2. **Authority statement** — which system/source owns the facts being changed.
3. **Scope** — exact contract/domain/UI changes.
4. **Non-goals** — technologies and adjacent features intentionally excluded.
5. **Migration/compatibility** — especially for OpenAPI routes and generated clients.
6. **Accessibility behavior** — keyboard, focus, reflow, non-color meaning, semantic fallbacks.
7. **Evidence** — focused tests plus repository-wide gates.
8. **Truth boundary** — facts the PR still cannot claim after merge.
9. **Follow-on** — the single next issue in the ordered sequence.

### Standard merge gates

Unless a PR is documentation-only, require the existing repository evidence stack appropriate to the change:

- formatting/generated-contract checks;
- affected lint/unit/build suites;
- Storybook interactions + axe where UI changes;
- focused browser evidence at the relevant responsive widths;
- cross-browser accessibility/comparison matrix;
- live Solr/OpenSearch projection/search smoke where contracts/search fields change;
- required MapLibre regression even when the PR does not modify maps, while that remains a repository merge gate;
- DSpace apply/diff idempotency where managed repository metadata changes.

Do not weaken timeouts or accessibility assertions merely to make CI green. The #111 cross-browser fix is the model: fix the unnecessary repeated work in the test harness while preserving the assertion and product behavior.

## Explicitly deferred work

Do **not** promote these merely because they are technically interesting:

- SAIPE/County Business Patterns/LODES/USGS thematic map expansion;
- issue #69 mapping parking-lot ideas;
- Kubernetes/search clustering;
- AWS/IaC deployment work unrelated to a demonstrated requirement;
- Neo4j or another graph database;
- vector/hybrid/semantic search experiments;
- generative-AI features;
- another frontend;
- another corpus-scale milestone;
- fake RBAC around Title 13 data the repository does not possess.

They may become valid later if a real role/product requirement creates a concrete question that the current architecture cannot answer.

## Positioning after this roadmap

Keep the existing independent-reference-implementation disclaimer.

The stronger product description after the sequence is:

> Civics Research Repository is an independent federal Open Science reference implementation demonstrating how publications, scientific data, statistical code, methodology, supporting materials, and restricted-use metadata can be discovered, cited, versioned, related, and traced through one typed application boundary.

The important interview/demo story is not "look at all the technologies." It is:

> The repository can explain what a research artifact is, who/what identifies it, which version was used, where the fact came from, what other artifacts it depends on, what a researcher may legitimately access, and what metadata needs stewardship—while preserving search and accessibility as first-class application behavior.

## Evidence and claim boundaries

Continue the repository's existing restraint:

- automated axe/Playwright/Storybook evidence is not manual NVDA/JAWS/VoiceOver or Trusted Tester certification;
- metadata export compatibility is not DOI registration;
- a restricted-data access link is not authorization;
- an asserted repository relation is not proof of scientific causality beyond its source/curator meaning;
- a source checksum/capture proves the observed artifact, not that a mutable upstream URL will never change;
- DataCite/DCAT/Schema.org mappings are interoperability mappings, not replacement systems of record;
- contract/job alignment is a portfolio/engineering rationale, not proof that this repository mirrors a specific internal Census production system.

## Definition of roadmap completion

This roadmap is complete when the repository can demonstrate, with real source-backed research objects and reviewable evidence:

1. **Identity** — what artifact is this and how is it persistently identified?
2. **Version** — which observed version/release/commit is represented?
3. **Citation** — how should the artifact and its data/code dependencies be referenced?
4. **Provenance** — where did each material fact come from and when was it observed?
5. **Relationships** — what publication/data/methodology/code/supporting artifacts are asserted to belong together?
6. **Access** — what is public, restricted, metadata-only, or embargoed, and what is the legitimate access path?
7. **Interoperability** — how can a person, web crawler, citation tool, or machine consumer understand the metadata?
8. **Stewardship** — what concrete metadata defects require attention?
9. **Reproducible context** — can discovery/analysis state be shared without losing source/version meaning?
10. **Accessibility** — can those answers still be obtained without relying on color, WebGL, pointer input, or an inaccessible visualization?

That is the target architecture for the post-#113 phase.
