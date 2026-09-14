# DSpace-native artifact version lineage

Artifact history is repository evidence, not a chronology inferred from names, vintage years, URLs, or neighboring records.

This document defines the Phase C implementation of issue #114: how Civics Research Repository observes first-class DSpace item versions, when the API may claim `HISTORY_AVAILABLE`, and how repository lineage stays separate from source provenance.

## Claim boundary

The production rule is intentionally strict:

- zero accessible DSpace versions: do not manufacture lineage;
- one observed DSpace version: retain `OBSERVED_CURRENT_ONLY` and the current source/repository provenance record;
- two or more archived DSpace versions: `HISTORY_AVAILABLE` is permitted;
- a newer DSpace draft prevents the newest archived record from being labeled current;
- `vintageYear`, titles, filenames, directory names, and source URL patterns never create an earlier or later version;
- `supersedes` is asserted only from adjacency in the observed DSpace version history.

The repository can therefore answer “what versions are actually known?” without turning a plausible chronology into a factual claim.

## DSpace authority chain

Phase C follows DSpace 9's first-class versioning resources:

```text
current DSpace item UUID
        ↓
GET /api/core/items/{uuid}/version
        ↓
linked VersionHistory
        ↓
GET /api/versioning/versionhistories/{historyId}/versions
        ↓
versions ordered by DSpace version number, newest first
        ↓
GET /api/versioning/versions/{versionId}/item
        ↓
archived item metadata for that specific repository version
```

The application does not reconstruct this chain from application-owned tables. `DspaceRestClient` owns the REST traversal, `RepositoryCatalog` owns the authority decision, and `RepositoryArtifactVersionMapper` maps observed repository facts into the public contract.

When DSpace administrative credentials are configured, read-only history traversal uses them so metadata on withdrawn historical items remains visible. Repositories that expose version history publicly do not require credentials; failed optional read authentication falls back to anonymous reads rather than changing the claim model.

## Repository lineage versus source provenance

These are separate evidence domains.

A DSpace repository version can establish:

- repository version identity;
- repository version number;
- repository version creation date;
- DSpace version summary/change note;
- current archived version state;
- membership in one DSpace version history;
- adjacency-backed `supersedes` lineage.

It cannot by itself establish:

- a new publisher/source version label;
- a source SHA-256 digest;
- a source capture timestamp;
- a DOI that was never recorded;
- source-level supersession outside the evidence held on the archived item.

For each DSpace version, source URL, DOI, fixity, capture time, and release facts are read only from the archived item for that version. Missing historical source facts remain missing; they are not copied backward from the current item.

## Public version contract

For genuine DSpace multi-version history, the public `ResearchArtifactVersion` mapping is:

| Public field                          | Evidence basis                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------- |
| `id`                                  | `dspace-version:{DSpace version id}`                                               |
| `versionLabel`                        | `Repository version {DSpace version number}`                                       |
| `versionDate`                         | DSpace Version `created` date                                                      |
| `changeNote`                          | DSpace Version `summary`                                                           |
| `current`                             | newest archived DSpace version only when the VersionHistory reports no newer draft |
| `isVersionOf`                         | canonical CRR research-object identity                                             |
| `supersedes`                          | immediately preceding observed DSpace version                                      |
| DOI/source URL/fixity/capture/release | archived item metadata for that specific version, when present                     |

For zero or singleton history, the API deliberately preserves the Phase B current-record representation, including an observed source release such as `TIGER2025`. Seeing one DSpace version is not proof that broader history exists.

## Cache and projection behavior

Solr and OpenSearch remain derived discovery projections and are never version-history authority.

The repository item catalog is briefly cached for normal page performance. When the real DSpace integration proof creates and archives a new version, it waits until DSpace discovery exposes the new current item and then calls the existing projection rebuild endpoint. `DiscoveryProjectionService` invalidates `RepositoryCatalog` before rebuilding, so the subsequent public history read cannot be satisfied from the pre-version cache.

No fixed cache-expiry sleep is used as correctness evidence.

## Real DSpace proof

The required Phase C CI scenario extends the existing Phase B DSpace 9 replay job:

1. Phase B APPLY persists the observed TIGER provenance.
2. Phase B DIFF proves reconciliation settles to `SKIP_ITEM`.
3. The public version endpoint proves the baseline remains `OBSERVED_CURRENT_ONLY`.
4. CI authenticates to the real DSpace 9 REST API.
5. It creates a new DSpace version from the current item using `/api/versioning/versions`.
6. It accepts the WorkspaceItem license when required.
7. It completes the WorkspaceItem through `/api/workflow/workflowitems`; the demo collection has no approval workflow, so the version is archived immediately.
8. It waits for the new item to become archived and visible in DSpace discovery.
9. It rebuilds the active application projection, which also invalidates the repository item cache.
10. It reads `/research/{id}/versions` and requires `HISTORY_AVAILABLE` with at least two DSpace-native versions.
11. It requires the newest record to be current, the prior record not current, and `supersedes` to match observed adjacency.
12. It requires the DSpace version summary to survive as the public change note.
13. It runs DIFF again and requires `SKIP_ITEM` with no CREATE/UPDATE action, proving lineage discovery is read-only with respect to managed source metadata.
14. It writes machine-readable evidence to `browser-evidence-artifacts/dspace-version-lineage.json`.

This is intentionally stronger than a mocked integration test: DSpace itself creates the version history that the application later claims.

## UI evidence semantics

The Versions view names the evidence domain rather than presenting one generic timeline.

For `OBSERVED_CURRENT_ONLY` it shows a **Source version** and **Current observed record** when those facts exist.

For `HISTORY_AVAILABLE` it shows:

- **Lineage authority: DSpace native item version history**;
- **Repository version** labels;
- **Current repository version** for the newest archived version;
- prior repository versions without a current badge;
- explicit `Version of` and `Supersedes` facts;
- a different observation statement for prior versions;
- independent fixity and capture statements that remain “not established” when their evidence is absent.

Storybook interaction/axe and Playwright/axe exercise both positive multi-version history and negative/partial provenance states. The browser evidence remains required across Chromium, Firefox, and WebKit, with the normal MapLibre regression gate unchanged.

## What closes issue #114

Phase C is complete only when all of the following are green on the same PR head:

- zero/singleton/multi-version repository tests;
- negative no-inference tests;
- real DSpace 9 multi-version read-back;
- post-observation idempotence/replay proof;
- Angular rendered tests;
- Storybook interaction + axe;
- Chromium/Firefox/WebKit Playwright + axe;
- OpenAPI/generated-client drift checks;
- repository API tests;
- live Solr/OpenSearch evidence;
- MapLibre regression evidence;
- normal workspace CI.

Until then, the Phase C pull request remains draft and issue #114 remains open.
