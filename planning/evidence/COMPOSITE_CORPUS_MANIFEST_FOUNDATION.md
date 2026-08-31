# Composite Corpus Manifest Foundation Evidence

This file tracks the validation boundary for the first composite-corpus identity PR.

## Scope

The foundation PR adds deterministic multi-source corpus identity without activating a mixed-source search projection.

Implemented evidence primitives:

- explicit per-source quotas,
- immutable bounded snapshot references,
- source provenance retention,
- deterministic composition SHA-256,
- exact profile-target validation,
- duplicate-source rejection,
- durable insert-once composite manifest history,
- separation of composite corpus identity from derived search projection identity.

## Required validation before merge

- repository API unit/integration tests pass,
- composite identity remains stable when source request order changes,
- composite identity remains stable when equivalent source snapshots are supported by different run IDs or capture times,
- `federated-composition/v1` canonical bytes are pinned by a golden SHA-256 test vector,
- quota/snapshot mismatches fail closed,
- duplicate sources fail closed,
- profile total mismatch fails closed,
- JDBC store round-trips all fields,
- repeated identical composition capture is idempotent and does not replace first durable evidence,
- conflicting evidence cannot reuse an existing composition SHA,
- workspace formatting/lint/build gates pass,
- `git diff --check` is clean.

## Deliberate exclusions

This PR does not yet:

- expose composite evidence through Admin/OpenAPI,
- bind a search projection to `compositionSha256`,
- activate `FEDERATED_1M`,
- harvest the 500K Data.gov / 500K DOE OSTI recipe,
- make performance claims about a mixed-source corpus.

Those are subsequent evidence stages after this identity primitive is green.
