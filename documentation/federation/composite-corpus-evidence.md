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

## Initial 1M composition

The first planned mixed-source evidence-grade profile is:

```text
500,000 Data.gov records
500,000 DOE OSTI.GOV records
+ curated DSpace repository objects during projection
```

The composite manifest covers the 1,000,000 federated records. Curated DSpace objects are linked during projection and are not used to inflate or alter the federated composition digest.

## Persistence behavior

Composite evidence is insert-once by `compositionSha256`.

- Capturing the same semantic composition again is idempotent.
- The original durable evidence row is retained.
- A request that attempts to associate an existing composition SHA with different source composition is rejected.

This behavior prevents a research identifier from quietly changing meaning over time.

## Scale continuity

The same model is intended to extend to 10M and 100M research tiers. Large-scale source transports may switch from live REST APIs to publisher snapshots, bulk files or partition manifests, but each source contribution must still resolve to a deterministic normalized-record snapshot before it can participate in composite evidence.
