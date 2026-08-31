# Composite Corpus Evidence

Composite corpus evidence gives a mixed-source federated profile a reproducible identity before search projection begins.

## Why this exists

A document count such as `1,000,000` is not enough to identify a research corpus. Two one-million-record runs can differ radically if their source mix, bounded source snapshots or normalization outputs differ.

Civics Research Repository therefore composes evidence from deterministic bounded source snapshots. Each source snapshot already has a normalized-record SHA-256. The composite layer records the exact source quotas and snapshot identities and derives one higher-level SHA-256 for the mixed corpus.

## Identity versus provenance

The composition SHA is intentionally stable across operational recapture. It is based on:

- composition version,
- corpus profile,
- source system,
- exact requested record count,
- bounded snapshot ID,
- bounded snapshot SHA-256.

The durable evidence also records harvest run IDs, adapter versions and capture timestamps. Those fields explain how the evidence was produced, but they do not cause an otherwise identical normalized corpus to receive a new composition identity merely because it was harvested later.

## Projection boundary

A composite manifest identifies federated input. Solr and OpenSearch remain derived discovery state.

Projection identity must reference the composite SHA rather than being included in it. This keeps these questions separate:

1. **What exact mixed-source corpus did we select?** — composite corpus evidence.
2. **What exact search projection was derived from it?** — projection evidence.
3. **Did both engines receive the same projection?** — parity evidence.

That separation follows the repository's existing authority model: DSpace and external publishers remain authoritative; search indexes are disposable projections.

## Admin and OpenAPI evidence surface

Composite evidence is exposed to operators without changing the projection boundary:

- `GET /api/admin/federation/compositions?corpusProfile=FEDERATED_1M&limit=20` lists recent immutable manifests for one named profile.
- `GET /api/admin/federation/compositions/{compositionSha256}` resolves one exact composition identity.
- `POST /api/admin/federation/compositions` is the explicit capture operation. It accepts source system, exact quota and bounded snapshot ID for each source and delegates all snapshot/quota validation to the composite manifest service.

Capture is intentionally guarded. The endpoint cannot perform a live publisher scan and cannot accept an arbitrary document count as evidence. Every requested source must resolve to an already-persisted bounded snapshot, the requested quota must exactly equal that snapshot's retained record count, duplicate sources are rejected and source quotas must sum to the selected profile target.

The `/admin/sync` operator screen presents the resulting identity and source-level provenance in a read-only accessible table. It shows the composition version and SHA plus source quota, bounded snapshot, harvest run, adapter version and snapshot capture time. An empty state explains the evidence prerequisites rather than implying that the planned 1M composition already exists.

The canonical OpenAPI contract and generated TypeScript client describe the same request and evidence shapes. The Angular client aliases those generated schemas instead of maintaining a parallel hand-written model.

## Initial 1M composition

The first planned mixed-source evidence-grade profile is:

```text
500,000 Data.gov records
500,000 DOE OSTI.GOV records
+ curated DSpace repository objects during projection
```

The composite manifest covers the 1,000,000 federated records. Curated DSpace objects are linked during projection and are not used to inflate or alter the federated composition digest.

The Admin/OpenAPI surface does **not** activate this profile. A valid `FEDERATED_1M` composition exists only after the two exact 500,000-record bounded snapshots have actually been captured and explicitly composed. Projection linkage to `compositionSha256` is a later delivery slice.

## Persistence behavior

Composite evidence is insert-once by `compositionSha256`.

- Capturing the same semantic composition again is idempotent.
- Concurrent identical capture is race-safe through the database primary key.
- The original durable evidence row is retained.
- A request that attempts to associate an existing composition SHA with different source composition is rejected.

This behavior prevents a research identifier from quietly changing meaning over time.

## Evidence coverage

The Admin/OpenAPI slice is covered at multiple boundaries:

- Spring MVC tests cover guarded capture, profile-scoped history, exact-SHA lookup, malformed SHA rejection, unknown SHA handling and history bounds.
- API-client tests cover profile/limit query serialization, exact identity lookup and the explicit bounded-snapshot capture request.
- Browser evidence covers both a populated two-source composition and the truthful pre-composition empty state on `/admin/sync`, including the existing WCAG and Section 508 browser gates.

## Scale continuity

The same model is intended to extend to 10M and 100M research tiers. Large-scale source transports may switch from live REST APIs to publisher snapshots, bulk files or partition manifests, but each source contribution must still resolve to a deterministic normalized-record snapshot before it can participate in composite evidence.
