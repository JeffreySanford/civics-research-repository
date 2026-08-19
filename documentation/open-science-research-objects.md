# Open Science Research Objects

The repository holds research objects, not only datasets. A dataset is one kind of research object; a
publication, a methodology report, and the project that ties a body of work together are others, and
they carry different metadata because they are different things.

This document describes that model and the one worked example the repository contains.

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

| Field       | Metadata                     | Notes                                                                                                                                                                                                 |
| ----------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type        | `crr.resource.type`          | `DATASET`, `PUBLICATION`, `CODE`, `METHODOLOGY`, `SUPPORTING_MATERIAL`, `PROJECT`. Absent means `DATASET` — a fact, not a guess: the catalog held nothing else before this.                           |
| Access      | `crr.rights.access`          | `PUBLIC`, `RESTRICTED`, `METADATA_ONLY`, `EMBARGOED`. Unreadable values fall back to `RESTRICTED`, never `PUBLIC`.                                                                                    |
| Access note | `crr.rights.accessnote`      | How to legitimately obtain a restricted object. Present only when access is not public.                                                                                                               |
| License     | `crr.rights.license`         | Stated rather than assumed. Federal works are public domain under 17 U.S.C. 105, and saying so is what makes an object reusable rather than merely downloadable.                                      |
| DOI         | `crr.identifier.doi`         | Omitted rather than emitted blank. A present-but-empty field asserts that no DOI exists, which is a claim.                                                                                            |
| Researchers | `crr.contributor.researcher` | One JSON entry per author: name, and ORCID where the researcher has a public one. Authors are also written to `dc.contributor.author`, the field every harvester and citation exporter already reads. |
| Relations   | `crr.relation.edge`          | One JSON entry per typed edge: verb, target source identifier, note.                                                                                                                                  |

### Relationships

Edges are directional and stored as `{verb, target, note}` — everything a curator can assert, and
nothing more. The target's title, type and access level belong to the target and are resolved from it
at read time by `ResearchRelationResolver`. Copying them into the edge would let the two drift: rename
a paper, and every relation pointing at it would still show the old name.

| Verb            | Meaning                                    |
| --------------- | ------------------------------------------ |
| `hasPart`       | A project to its members.                  |
| `uses`          | Research to the data it ran on.            |
| `documents`     | Methodology to what it describes.          |
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

| Collection                  | SAF group      | Holds |
| --------------------------- | -------------- | ----- |
| TIGER/Line Geospatial Files | `datasets`     | 177   |
| Research Publications       | `publications` | 2     |
| Methodology and Code        | `methodology`  | 1     |
| Research Projects           | `projects`     | 1     |

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

## Known gaps

- **Replication packages and code remain unmodelled in practice.** `CODE` is in the enum and nothing
  uses it. Neither working paper ships a replication package, and authoring one would be the same
  fabrication problem the rest of this design avoids.
- **ORCID coverage is thin.** One of the six authors would need a verified public ORCID before the
  field earns its place; absent is currently correct for all of them.
- **Live sync is still dataset-centric.** `PublicDatasetMetadata` and the DSpace payload mapper do not
  carry resource type, access, license, DOI, researchers or relations. The catalog and SAF path model
  them fully; the harvest path does not. Generalising it to `ResearchObjectMetadata` would close the
  loop.
