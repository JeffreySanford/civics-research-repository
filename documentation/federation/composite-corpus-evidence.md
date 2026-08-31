# Composite Corpus Evidence

Composite corpus evidence gives a mixed-source federated profile a reproducible identity before search projection begins, then links that exact identity to the search projection derived from it.

## Why this exists

A document count such as `1,000,000` is not enough to identify a research corpus. Two one-million-record runs can differ radically if their source mix, bounded source snapshots or normalization outputs differ.

Civics Research Repository therefore composes evidence from deterministic bounded source snapshots. Each source snapshot already has a normalized-record SHA-256. The composite layer records the exact source quotas and snapshot identities and derives one higher-level SHA-256 for the mixed corpus.

A named profile is not a substitute for that evidence. `FEDERATED_1M` by itself means a target count; it does not prove that the active million records are the intended source mix.

## Identity versus provenance

The composition SHA is intentionally stable across operational recapture. It is based on:

- composition version,
- corpus profile,
- source system,
- exact requested record count,
- bounded snapshot ID,
- bounded snapshot SHA-256.

The durable evidence also records harvest run IDs, adapter versions and capture timestamps. Those fields explain how the evidence was produced, but they do not cause an otherwise identical normalized corpus to receive a new composition identity merely because it was harvested later.

## Projection linkage

A composite manifest identifies federated input. Solr and OpenSearch remain derived discovery state.

Projection identity references the composite SHA rather than being included in it. This keeps these questions separate:

1. **What exact mixed-source corpus did we select?** — composite corpus evidence.
2. **What exact search projection was derived from it?** — composition-to-projection evidence.
3. **Did both engines receive the same projection?** — projection-target parity evidence.

The linkage path does not call the ordinary count-bounded `reindex(profile)` path and then attach a SHA afterward. Instead it streams each source independently from its stable namespaced ID range and projects exactly the quota recorded by the composition manifest.

Before projection starts and again after projection completes, each source's bounded snapshot is regenerated from retained normalized metadata using the original run and exact quota. The projection relationship is not persisted if source system, retained count, snapshot ID or snapshot SHA no longer match the composition.

After those checks, normal activation parity validation still requires every enabled projection target to complete with the same deterministic `projectionId` and document count before the composition-to-projection relationship is saved.

That separation follows the repository's existing authority model: DSpace and external publishers remain authoritative; search indexes are disposable projections.

## Admin evidence surface

Composite identity is exposed through:

- `GET /api/admin/federation/compositions?corpusProfile=FEDERATED_1M&limit=20` — recent immutable manifests for one named profile.
- `GET /api/admin/federation/compositions/{compositionSha256}` — one exact composition identity.
- `POST /api/admin/federation/compositions` — explicit composition capture from existing bounded source snapshots.

Projection linkage is exposed through:

- `POST /api/admin/federation/compositions/{compositionSha256}/project` — rebuild discovery from the exact composed source quotas and persist the relationship only if source stability and target parity succeed.
- `GET /api/admin/federation/compositions/{compositionSha256}/projection` — newest projection evidence for one exact composition.
- `GET /api/admin/federation/compositions/projections?corpusProfile=FEDERATED_1M&limit=20` — recent composition-to-projection evidence for a named profile.

Capture is intentionally guarded. The composition endpoint cannot perform a live publisher scan and cannot accept an arbitrary document count as evidence. Every requested source must resolve to an already-persisted bounded snapshot, the requested quota must exactly equal that snapshot's retained record count, duplicate sources are rejected and source quotas must sum to the selected profile target.

The projection endpoint is also guarded. It cannot silently reinterpret a composition as the first N rows of the retained federated catalog. It must be able to regenerate the same source snapshots and stream the exact source quotas named by the manifest.

## Initial 1M composition

The first planned mixed-source evidence-grade profile is:

```text
500,000 Data.gov records
500,000 DOE OSTI.GOV records
+ curated DSpace repository objects during projection
```

The composite manifest covers exactly the 1,000,000 federated records. Curated DSpace objects remain part of the public discovery projection but are not used to inflate or alter the federated composition digest.

For that reason, projection evidence records both:

- `federatedRecordCount` — the composition-controlled federated count, expected to be exactly 1,000,000 for this recipe, and
- `projectionObjectCount` — the actual full search projection count, including curated DSpace records.

The same federated composition can legitimately produce a different full `projectionId` later if the curated DSpace slice changes. Projection history is therefore preserved rather than replacing a composition with one permanent projection value.

This PR establishes the linkage mechanism but does **not** perform the live 500K + 500K harvest/composition/projection evidence run. The live 1M run remains an explicit operational evidence step after the code path is merged.

## Persistence behavior

Composite manifests remain insert-once by `compositionSha256`.

Composition-to-projection evidence is historical by `(compositionSha256, projectionId)`:

- re-linking the identical composition and identical deterministic projection is idempotent,
- a later valid projection ID for the same composition is retained as another historical relationship,
- newest linkage can be resolved without deleting earlier evidence,
- no linkage row is written if source stability or projection-target parity fails.

This behavior prevents a research identifier from quietly changing meaning over time while still acknowledging that the repository-owned curated projection slice may evolve independently of the federated composition.

## Evidence coverage

The composite identity/Admin slice is covered at multiple boundaries:

- Spring MVC tests cover guarded composition capture, profile-scoped history, exact-SHA lookup, malformed SHA rejection, unknown SHA handling and history bounds.
- API-client tests cover profile/limit query serialization, exact identity lookup and the explicit bounded-snapshot capture request.
- Browser evidence covers both a populated two-source composition and the truthful pre-composition empty state on `/admin/sync`, including the existing WCAG and Section 508 browser gates.

The projection-linkage slice adds focused backend evidence for:

- source-scoped stable-ID traversal,
- exact composition projection rather than count-only profile projection,
- before/after bounded-snapshot stability checks,
- rejection without persisted linkage when a source changes,
- durable projection history for one composition identity.

## Scale continuity

The same model is intended to extend to 10M and 100M research tiers. Large-scale source transports may switch from live REST APIs to publisher snapshots, bulk files or partition manifests, but each source contribution must still resolve to a deterministic normalized-record snapshot before it can participate in composite evidence. Projection remains bounded-memory because each source range is streamed in fixed-size batches.
