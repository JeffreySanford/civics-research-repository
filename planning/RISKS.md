# Risks

## DSpace Docker Complexity

Risk: DSpace, Solr, PostgreSQL, initialization, and indexing can take more time than the Angular/API prototype.

Mitigation: start from DSpace-supported Docker examples, keep local overrides small, and seed one dataset first.

## OpenAPI Drift

Risk: frontend types, backend DTOs, and controllers can diverge as implementation speeds up.

Mitigation: keep OpenAPI as the source of truth, keep `openapi:check` in `quality:all`, and add Java DTO generation to the same quality gate once backend exists.

## Angular 22 and NgRx RC

Risk: NgRx 22 is currently an RC line selected for Angular 22 compatibility.

Mitigation: keep NgRx usage conventional, avoid experimental APIs unless needed, and upgrade to stable NgRx 22 when available.

## Map Accessibility

Risk: interactive maps can pass axe checks while still being inaccessible.

Mitigation: require feature-list/table equivalence, keyboard-operable controls, source attribution, non-color-only legends, and manual screen-reader review.

## Public Data Size and Rate Limits

Risk: Census and USGS data can be large or subject to service limits.

Mitigation: ingest metadata and source links first, use small fixtures for local development, and avoid committing large datasets.

## DSpace/Solr Schema Coupling

Risk: discovery fields may require DSpace/Solr configuration work beyond simple item creation.

Mitigation: define only the first slice fields initially and document each Solr field/configuration change.

## Nx Migration Warnings

Risk: existing Nx warnings about inferred targets and Analog/Vitest configuration can become CI failures during upgrades.

Mitigation: address these warnings before broad feature work and keep commands routed through `pnpm nx`.

## Fixture Data Masking an Unfinished Integration

Risk: discovery and dataset detail are served from an in-memory seed list and hard-coded fixtures, while DSpace holds the synchronized item. The UI looks complete, so the missing read path is invisible in a demo — and a reviewer who discovers it independently will reasonably question what else is fixture-backed.

Mitigation: close it as near-term priority 1. Until then, state it plainly rather than letting it be found: the Known Seams section of the architecture diagrams lists it first, and any fallback response should be identifiable as fallback in the API surface itself, not only in documentation.

## Datastore Role Ambiguity

Risk: two PostgreSQL databases both named `dspace`, plus two Solr instances, invite the reader to assume the application writes into DSpace's own schema. That misreading undermines the "DSpace is the system of record" claim the architecture rests on.

Mitigation: rename the application database to `civics_ops` and document the four datastore roles in one table. The documentation half is done; the rename is pending and requires a volume reset.

## Demo Startup Fragility

Risk: no single command brings up a demonstrable system. `start:all` excludes the DSpace profile, so a live demo depends on running several commands in the right order — the exact conditions under which demos fail.

Mitigation: `start:all` is now scoped to the active Compose profile and no longer destroys a running DSpace stack, which removed the sharpest edge. A single `demo:up` remains near-term priority 3. Rehearse it from a cold `docker:reset:everything` rather than from a warm machine.

## Compose Volume Mounts Silently Not Persisting

Risk: a named volume mounted at a path the image does not use looks correct in `docker-compose.yml` and in `docker volume ls`, while the real data sits in the container's writable layer and dies with the container. The DSpace database was in exactly this state — mounted at `/pgdata` while the image's `PGDATA` is `/var/lib/postgresql/data` — so the entire seeded repository was lost the first time the container was removed.

Mitigation: fixed for `dspace-postgres`, and the application `postgres`, both Solr services, and the DSpace assetstore were checked against their images. When adding a stateful service, verify persistence by removing the container and confirming the data survives, not by observing that a volume exists.

## Seed Idempotence Keyed On The Wrong Signal

Risk: the DSpace seed treated a mapfile in the assetstore volume as proof the item had been imported. That volume outlives the database volume, so after a database reset the seed skipped the import forever and left an empty repository that no amount of reseeding would fix. It also masked a broken SAF package for several commits, because the import that would have failed was never re-run.

Mitigation: the seed now verifies that the item referenced by the mapfile still exists in DSpace, and re-imports when it does not. Idempotence checks should assert the desired end state, not the fact that an earlier attempt was made.

## Unauthenticated Admin Sync Endpoint

Risk: `POST /api/admin/sync` performs real DSpace writes in `APPLY` mode and has no authentication. CORS restricts browser origins but does not stop direct clients.

Mitigation: accepted for the localhost-only demo and recorded in DECISIONS.md ("Admin API Authentication"). Add Spring Security and a recorded requesting principal before the stack runs anywhere shared, and raise it explicitly during the demo walkthrough rather than waiting to be asked.

## Sync Job Store Coverage Gap

Risk: `JdbcSyncJobStore` uses PostgreSQL-native `insert ... on conflict do update`, which H2 cannot parse, so the store's SQL has no automated coverage. A typo in that statement surfaces only when the Compose stack runs.

Mitigation: cover it with Testcontainers against real PostgreSQL. That requires the `repository-api:test` target to move off `docker build`, which cannot host a Docker daemon. Until then, treat changes to that SQL as requiring a manual `pnpm run sync:apply` check.

## Dependency Vulnerabilities

Risk: GitHub reported moderate Dependabot findings after initial dependency push.

Mitigation: review Dependabot alerts before production-style demo delivery, update safe packages, and document accepted temporary risk if any package cannot be upgraded immediately.

## Closed

### Java Tooling Gap

Was: no local Maven install, and a wrapper strategy undecided.

Closed by running Gradle inside the `gradle:9.6-jdk21` image. No local Java or build-tool install is required, and the toolchain is pinned by image tag.

### Java Version Choice

Was: Java 17 versus 21 undecided against unknown federal runtime availability.

Closed on Java 21. Revisit only if a concrete deployment constraint appears.

### Analog/Vitest Angular Library Warning

Was: `tsconfig.app.json` warnings for non-buildable Angular libraries.

Closed during workspace setup.
