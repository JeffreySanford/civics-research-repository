# Open Science Research Objects

The repository holds research objects, not only datasets. A dataset is one kind of research object; a
publication, a methodology report, and the project that ties a body of work together are others, and
they carry different metadata because they are different things.

This document describes that model and the one worked example the repository contains. The current
post-#113 Open Census alignment sequence is planned separately in
[open-census-alignment-roadmap.md](open-census-alignment-roadmap.md).

## Why this exists

An open-data portal publishes files. An Open Science repository describes the research: the
publication, the scientific data underneath it, the methodology that produced that data, the
provenance and citation of each, and the relationships between them. The Census Bureau's own framing
of Open Science covers peer-reviewed manuscripts and the scientific data supporting them, alongside
statistical code and replication packages.

The repository modelled datasets well and everything else not at all. `ResearchObjectType` existed in
the contract with the right values, and `contentType_s` was already indexed into Solr — but it was
hardcoded to `DATASET` in two places, so the machinery was built and capped. The gap was semantic,
not architectural.

## The object model

| Field | Metadata | Notes |
| --- | --- | --- |
| Type | `crr.resource.type` | `DATASET`, `PUBLICATION`, `CODE`, `METHODOLOGY`, `SUPPORTING_MATERIAL`, `PROJECT`. Absent means `DATASET` — a fact, not a guess: the catalog held nothing else before this. |
| Access | `crr.rights.access` | `PUBLIC`, `RESTRICTED`, `METADATA_ONLY`, `EMBARGOED`. Unreadable values fall back to `RESTRICTED`, never `PUBLIC`. |
| Access note | `crr.rights.accessnote` | How to legitimately obtain a restricted object. Present only when access is not public. |
| License | `crr.rights.license` | Stated rather than assumed. Federal works are public domain under 17 U.S.C. 105, and saying so is what makes an object reusable rather than merely downloadable. |
| DOI | `crr.identifier.doi` | Omitted rather than emitted blank. A present-but-empty field asserts that no DOI exists, which is a claim. |
| Researchers | `crr.contributor.researcher` | One JSON entry per author: name, and ORCID where the researcher has a public one. Authors are also written to `dc.contributor.author`, the field every harvester and citation exporter already reads. |
| Relations | `crr.relation.edge` | One JSON entry per typed edge: verb, target source identifier, note. |
| Source version | `crr.version.label` | Source-provided release/version identity only. A vintage year is not silently promoted to a version label. |
| Version date | `crr.version.date` | Version-specific date only when observed from the source or repository evidence. |
| Fixity | `crr.provenance.sha256` | SHA-256 only when supplied or computed from retained source bytes; never inferred from a URL, file name, or byte count. |
| Capture time | `crr.provenance.capturedat` | Timestamp of an actual retained observation. The current sync clock is not substituted because that would create false provenance and perpetual diff churn. |
| Version identity | `crr.version.isversionof` | Stable artifact identity this observed version belongs to, when evidenced. |
| Supersession | `crr.version.supersedes` | Earlier observed version superseded by this version, when evidenced. |
| Change note | `crr.version.changenote` | Source/repository change note associated with the observed version. |

### Relationships

Edges are directional and stored as `{verb, target, note}` — everything a curator can assert, and
nothing more. The target's title, type and access level belong to the target and are resolved from it
at read time by `ResearchRelationResolver`. Copying them into the edge would let the two drift: rename
a paper, and every relation pointing at it would still show the old name.

| Verb | Meaning |
| --- | --- |
| `hasPart` | A project to its members. |
| `uses` | Research to the data it ran on. |
| `documents` | Methodology to what it describes. |
| `isDerivedFrom` | A public product to its restricted source. |

`generate-saf.mjs` refuses to emit an edge whose target is not a catalog object, and the resolver drops
one whose target is not present at read time. A dangling relation is worse than no relation: it renders
as a working link and tells the reader the repository does not know its own contents.

Typed edges do not replace `relatedResearch`, which stays a same-geography heuristic for the objects
that declare no edges. The distinction is worth keeping visible in the UI: one is asserted about the
objects themselves, the other is inferred.

## The worked example

One research package, six objects, all real Census material. Nothing is synthetic — a fabricated paper
with an invented author would be the most off-brand object in a repository that already refuses to seed
a program/area pair whose source URL 404s.

```
PROJECT  Spatial mismatch and workplace location in US labor markets
   │
   ├── hasPart ─→ PUBLICATION  CES-WP-25-23  Re-assessing the Spatial Mismatch Hypothesis
   │                           Card, Rothstein, Yi (2025) · DOI 10.3386/w32252
   │
   ├── hasPart ─→ PUBLICATION  CES-WP-25-22  Size Matters: Matching Externalities and the
   │                           Advantages of Large Labor Markets · Moretti, Yi (2025)
   │
   ├── hasPart ─→ METHODOLOGY  CES-WP-25-52  LODES Design and Methodology Report v7
   │                           Foote, Graham, Kutzbach (2025) · documents ─→ LODES
   │
   ├── hasPart ─→ DATASET      2023 LODES Workplace Area Characteristics (public)
   │
   └── hasPart ─→ DATASET      LEHD microdata · RESTRICTED · no files
```

The methodology edge is a fact rather than a curatorial guess: CES-WP-25-52 _is_ the methodology for
the LODES processing system that produced the WAC files the repository holds.

### The restricted object

`lehd-microdata-restricted` is the point of the access-level model. The LEHD microdata is Title 13
protected and available only through a Federal Statistical Research Data Center. It is described so
that research depending on it stays citable and traceable, and it carries **zero files** — the
repository holds no confidential records and can hold none.

This is why the access level is not decoration. `RepositoryObjectMapper.files()` falls back to
synthesising file entries from an item's landing-page URLs when no manifest exists, which for a
restricted object would offer downloads for records that cannot be released. It now returns nothing
when access is not `PUBLIC`.

Open Science at a statistical agency is not "everything is public". A repository that can only say
`PUBLIC` cannot describe its own holdings.

## Where objects live

Type is carried twice, on purpose.

`crr.resource.type` is what discovery facets on. The four DSpace collections are what DSpace's own
interfaces, its administrative tools, and its OAI-PMH sets organise by — a repository whose only notion
of type lives in a project-specific metadata field looks structureless to everything except this
application.

| Collection | SAF group | Holds |
| --- | --- | --- |
| TIGER/Line Geospatial Files | `datasets` | 177 |
| Research Publications | `publications` | 2 |
| Methodology and Code | `methodology` | 1 |
| Research Projects | `projects` | 1 |

## How it surfaces

- **Discovery** gains a `Type` facet beside Program and Geography, filterable via `?type=PUBLICATION`.
  Selecting the type already chosen clears it, so a reader who filters to publications is not stuck
  there without also discarding their query and geography.
- **Result cards** show the type, and an access badge only when access is not public — the badge means
  something precisely because most objects do not carry one.
- **Detail** is type-aware. A publication shows authors with ORCID links where one exists, its DOI,
  license and access, and a Research Package tab listing its typed edges. It does not show Map Layers:
  a working paper has no geometry, and an empty map workspace reads as a failure to load rather than
  as nothing to draw.
- **Versions and provenance** is an evidence view, not a generated timeline. It displays observed
  source-version identity, dates, fixity, capture time, artifact identity, supersession, and change
  notes only when those facts are present. The same screen explicitly distinguishes
  `OBSERVED_CURRENT_ONLY`, `HISTORY_AVAILABLE`, and `UNAVAILABLE`.

## Synchronization status

The live synchronization boundary is research-object capable and Phase B of #114 now extends that
same boundary to artifact provenance.

`ResearchObjectMetadata` can carry resource type, access level/note, license, DOI, researchers/ORCID,
typed relations, and one optional `ResearchArtifactProvenance` record. `DspaceItemPayloadMapper` writes
the observed provenance fields through `DspaceManagedFields`; `RepositoryCatalog` reads the same DSpace
item back into the public `ResearchArtifactVersion` contract. There is no second provenance store.

A missing harvested value remains **no opinion**, not an instruction to erase richer seeded metadata.
This is particularly important for provenance: a source adapter that knows a release label but does not
compute a checksum writes the label and leaves SHA-256 absent. It does not manufacture fixity merely to
make the record look complete.

TIGER/Line demonstrates that boundary conservatively. The path itself explicitly identifies the source
family as `TIGER2025`, so the representative object can persist that label. The HTTP source probe can
observe `Last-Modified` and byte size but does not download/hash the archive, so the adapter does not
claim SHA-256 or a retained capture timestamp. Its compiled fallback release date is useful for detail
when the publisher is unreachable, but is not promoted into `crr.version.date` as if it were observed.

The Phase B CI gate uses a real DSpace 9 profile rather than a mock: seed the repository and custom
metadata registry, APPLY TIGER metadata, run DIFF again, require `SKIP_ITEM` with no create/update, then
read `/research/{id}/versions` through the running API and require the persisted `TIGER2025` value to
come back while unsupported SHA/capture facts remain absent. This is the replay/idempotence proof for
the authority path.

The remaining synchronization gap is **adapter breadth**: the normalized model can represent richer
research objects, but live publisher/source coverage is still narrow. A future non-dataset adapter
should prove the generalized path with a real CODE/replication object rather than rebuild the model.

## Version-history phases

#114 deliberately separates three claims that are easy to conflate:

1. **Phase A — truthful history contract (merged in #121).** Synthetic `vintageYear - 1` history was
   removed. The API/UI now distinguishes current-only knowledge, actual history, and unavailable
   provenance, with unit, Storybook+axe, Playwright+axe, cross-browser, live-search, and MapLibre
   evidence.
2. **Phase B — authoritative current provenance (this slice).** Observed version/provenance facts are
   persisted through DSpace, read back from DSpace, rendered in the main Angular application, and
   subjected to a real DSpace APPLY→DIFF replay test. Phase B still returns
   `OBSERVED_CURRENT_ONLY`; richer metadata does not magically establish earlier versions.
3. **Phase C — genuinely observed multi-version lineage.** `HISTORY_AVAILABLE`, `supersedes`, and
   multiple records become a production claim only after an adapter/repository source can supply
   distinct observed versions and their lineage. Negative tests must continue proving that vintage,
   naming, or UI fixtures cannot promote themselves into history.

## Known gaps

- **Multi-version history is not yet a production fact.** Phase B can describe the current observed
  artifact more precisely, but Phase C of #114 still owns genuinely observed earlier/later versions
  and the production transition to `HISTORY_AVAILABLE`.
- **Replication packages and code remain unmodelled in practice.** `CODE` is in the enum and nothing
  uses it yet. Issue #118 will use a genuine Census public research-code/replication repository rather
  than fabricate an object merely to exercise the type.
- **Interoperability is not profiled explicitly.** The internal metadata model is rich, but the
  repository does not yet publish one documented crosswalk/export profile for DataCite, Schema.org,
  DCAT-US, and DSpace/Dublin Core. Issue #115 owns that boundary.
- **Relationships are not yet presented as a complete reproducibility trail.** Typed package relations
  exist and must remain distinct from heuristic `relatedResearch`; issue #116 will make their
  provenance/version/access semantics easier to follow without adding a graph database.
- **ORCID coverage is thin.** Missing ORCID remains unknown and must not be fabricated merely to make
  an export/profile look complete.

See [Open Census Alignment Roadmap](open-census-alignment-roadmap.md) for the ordered #114–#119 plan,
validation boundaries, and intentionally deferred work.
