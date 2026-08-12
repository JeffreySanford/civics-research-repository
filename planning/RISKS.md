# Risks

## DSpace Docker Complexity

Risk: DSpace, Solr, PostgreSQL, initialization, and indexing can take more time than the Angular/API prototype.

Mitigation: start from DSpace-supported Docker examples, keep local overrides small, and seed one dataset first.

## OpenAPI Drift

Risk: frontend types, backend DTOs, and controllers can diverge as implementation speeds up.

Mitigation: both sides are now generated from the contract. The frontend regenerates and is diffed by `openapi:check` inside `quality:all`; the Java side generates inside the Gradle build, with `compileJava` depending on it, so a breaking contract change fails compilation.

Remaining exposure: only the Java types actually migrated to generated DTOs are protected. `/maps/census-areas` is migrated; the rest still use hand-written records, and drift in those is invisible until they move. The migration order and the per-type decisions are tracked as P6 in TODO.md.

## Angular 22 and NgRx RC

Risk: NgRx `22.0.0-rc.0` is a release candidate, chosen because the stable NgRx 21 line peers with Angular 21 rather than 22. It carries the state for search, dataset detail, maps, and admin sync — the core data flows — so a breaking change between RC and stable would land in the parts of the app most expensive to re-test.

Mitigation: keep NgRx usage conventional and avoid experimental APIs. Upgrade to stable NgRx 22 as soon as it exists, and treat that upgrade as a task in its own right rather than folding it into a feature branch.

## Dependency Upgrade Policy

This project deliberately runs a bleeding-edge frontend (Angular 22, NgRx 22 RC) and a current backend (Java 21, Spring Boot 4.1). That is defensible for a reference implementation and indefensible without rules. The rules:

1. **Exact pins, no ranges, for anything pre-stable.** Every `@ngrx/*` package is pinned to `22.0.0-rc.0` with no caret, so a fresh `pnpm install` in a new container cannot silently resolve a different RC. Same for Angular, Nx, and the DSpace and Solr image tags.
2. **The lockfile is authoritative.** Container installs run `--frozen-lockfile`. An install that would change the lockfile fails rather than drifting.
3. **One concern per upgrade.** Framework upgrades, RC-to-stable moves, and security patches are separate commits with `quality:all` green on each. Never bundle a version bump with a feature.
4. **Upgrade the RC lines before adding breadth.** Moving to stable NgRx 22 outranks new adapters and new UI, because the cost of the move grows with the amount of state built on it.
5. **A dedicated security patch pass before leaving PI 1.** Triage the outstanding Dependabot findings, upgrade what upgrades cleanly, and record an explicit accepted risk with a reason and a revisit date for anything that cannot move.
6. **No transitive pin without a comment.** The `pnpm.overrides` block is a liability if nobody remembers why an entry is there; each one needs a reason and a removal condition.

## Retired Upstream Data Sources

Risk: building adapters against data formats the publisher has retired. USGS retired the National Hydrography Dataset on 1 October 2023 in favor of the 3D Hydrography Program, and the National Map evaluation originally kept legacy NHD as a fallback or comparison source.

Mitigation: legacy NHD is removed as a fallback. Any hydrography overlay targets 3HP specifications from the start, so layer toggles, legends, and the geospatial metadata schema are not built twice. More generally: before writing an adapter, confirm the publisher still considers the source current, and record the check with a date.

## Map Accessibility

Risk: interactive maps pass axe checks while remaining unusable with a screen reader. The current feature list renders the same data as the map but shares no state with it, so a non-visual user can read the events and still not know which one the map is showing, or move the map to the one they are reading about. Automated tooling cannot see this: the markup is valid and the equivalent content is present.

Mitigation: two-way selection synchronization between map and feature list, specified in documentation/mapping-visualization.md. Until it exists, the honest claim is "an accessible equivalent is present", not "the map is accessible". Manual Checklist 4 is what settles the question, and it cannot pass convincingly before this lands.

## Public Data Size and Rate Limits

Risk: Census and USGS data can be large or subject to service limits.

Mitigation: ingest metadata and source links first, use small fixtures for local development, and avoid committing large datasets.

## DSpace/Solr Schema Coupling

Risk: discovery fields may require DSpace/Solr configuration work beyond simple item creation.

Mitigation: define only the first slice fields initially and document each Solr field/configuration change.

## Nx Migration Warnings

Risk: existing Nx warnings about inferred targets and Analog/Vitest configuration can become CI failures during upgrades.

Mitigation: address these warnings before broad feature work and keep commands routed through `pnpm nx`.

## Compose Volume Mounts Silently Not Persisting

Risk: a named volume mounted at a path the image does not use looks correct in `docker-compose.yml` and in `docker volume ls`, while the real data sits in the container's writable layer and dies with the container. The DSpace database was in exactly this state — mounted at `/pgdata` while the image's `PGDATA` is `/var/lib/postgresql/data` — so the entire seeded repository was lost the first time the container was removed.

Mitigation: fixed for `dspace-postgres`, and the application `postgres`, both Solr services, and the DSpace assetstore were checked against their images. When adding a stateful service, verify persistence by removing the container and confirming the data survives, not by observing that a volume exists.

## Seed Idempotence Keyed On The Wrong Signal

Risk: the DSpace seed treated a mapfile in the assetstore volume as proof the item had been imported. That volume outlives the database volume, so after a database reset the seed skipped the import forever and left an empty repository that no amount of reseeding would fix. It also masked a broken SAF package for several commits, because the import that would have failed was never re-run.

Mitigation: the seed now verifies that the item referenced by the mapfile still exists in DSpace, and re-imports when it does not. Idempotence checks should assert the desired end state, not the fact that an earlier attempt was made.

## Unauthenticated Admin Sync Endpoint

Risk: `POST /api/admin/sync` performs real DSpace writes in `APPLY` mode and has no authentication. CORS restricts browser origins but does not stop direct clients.

Mitigation: accepted for the localhost-only demo and recorded in DECISIONS.md ("Admin API Authentication"). Add Spring Security and a recorded requesting principal before the stack runs anywhere shared, and raise it explicitly during the demo walkthrough rather than waiting to be asked.

## Flaky Playwright Web Server Between Suites

Risk: `quality:all` runs three Playwright suites in sequence, each starting its own web server. Twice on 2026-08-12 the second suite failed immediately with `Process from config.webServer was not able to start. Exit code: 1`, and passed on an unchanged rerun. The previous suite's server has not released its port when the next one binds.

Impact today is a spurious gate failure that a rerun clears. Impact once this runs unattended is worse: a green build becomes a coin flip, and the natural response to a flaky gate is to stop trusting it.

Mitigation: not yet fixed. Options are to reuse one web server across the tagged suites rather than starting three, to add a readiness wait or retry in `tools/scripts/start-discovery-ui-web-server.mjs`, or to run the accessibility suites as tag filters within a single Playwright invocation. Worth fixing before the gate runs anywhere unattended.

## Sync Job Store Coverage Gap

Risk: `JdbcSyncJobStore` uses PostgreSQL-native `insert ... on conflict do update`, which H2 cannot parse, so the store's SQL has no automated coverage. A typo in that statement surfaces only when the Compose stack runs.

Mitigation: cover it with Testcontainers against real PostgreSQL. That requires the `repository-api:test` target to move off `docker build`, which cannot host a Docker daemon. Until then, treat changes to that SQL as requiring a manual `pnpm run sync:apply` check.

## Dependency Vulnerabilities

Risk: advisories reaching the workspace through transitive dependencies.

Status: reviewed 2026-08-12. Four of the five reported advisories are already mitigated by version overrides; one has no fix at any published version and is accepted with the reasoning below.

### Reading `pnpm audit` here

`pnpm audit` reports an advisory when **any** package in the graph _requests_ a vulnerable range, even when an override resolves it to a patched version. The raw count is therefore misleading, and the number that matters is the resolved version. Verified on 2026-08-12:

| Advisory                           | Vulnerable range | Patched from | Resolved here | Status                  |
| ---------------------------------- | ---------------- | ------------ | ------------- | ----------------------- |
| `uuid` bounds check                | `<11.1.1`        | 11.1.1       | **11.1.1**    | Mitigated by override   |
| `@hono/node-server` path traversal | `<2.0.5`         | 2.0.5        | **2.0.10**    | Mitigated by override   |
| `postcss` incomplete fix           | `<=8.5.22`       | 8.5.23       | **8.5.26**    | Mitigated by override   |
| `brace-expansion` DoS              | `>=4.0.0 <5.0.9` | 5.0.9        | **5.0.9**     | Mitigated by override   |
| `image-size` ICNS/JXL/HEIF DoS     | `<=2.0.2`        | none         | 0.5.5         | **Accepted, see below** |

Do not remove the overrides on the strength of the audit output alone. Removing all four was tested on 2026-08-12 and immediately reintroduced every one of those four advisories with vulnerable resolved versions, so each override is currently load-bearing.

### Accepted risk: `image-size` (high, no fix available)

Path: `@analogjs/vite-plugin-angular` -> `@angular-devkit/build-angular` -> `less` -> `image-size`.

No patched version exists. The latest published `image-size` is 2.0.2 and the advisory covers `<=2.0.2`, so there is nothing to upgrade to and an override cannot help. Upgrading Analog to 2.7.0 was tried and does not change the path.

Accepted because the exposure is effectively nil:

- It is build-time only. Nothing from this path is shipped to the browser.
- `less` never executes. The application is SCSS-only (`inlineStyleLanguage: scss`); `less` arrives as a transitive dependency of the Angular build tooling and is not invoked.
- The vulnerable code is `less`'s image inlining for ICNS, JXL, and HEIF files. The build reads only repository-controlled assets, so triggering it would require commit access, at which point a denial of service in a local build is not the interesting attack.

Revisit when `image-size` publishes a patched release, or when Analog or `@angular-devkit/build-angular` drops its `less` dependency. Re-check at the next dependency pass regardless.

### Removed rather than patched

- `@angular/animations`: deprecated upstream and unused; nothing imported it.
- `@angular-devkit/build-angular`: declared directly but no executor referenced it. Still present transitively via Analog, so this removed a redundant direct dependency rather than a code path.

### Deferred, tracked separately

Major upgrades are not security work and were not bundled here: jsdom 27 to 30, `@types/node` 22 to 26, and `eslint-plugin-playwright` 1 to 2. Prettier 3.6 to 3.9 is also deferred, because a formatter bump reformats the tree and would bury any real change.

### TypeScript 7 is blocked, not deferred

Checked 2026-08-12 against the installed peer ranges, which are the authoritative answer:

| Package                        | Declared TypeScript range |
| ------------------------------ | ------------------------- |
| `@angular/compiler-cli` 22.1.1 | `>=6.0 <6.1`              |
| `typescript-eslint` 8.67.0     | `>=4.8.4 <6.1.0`          |

Two independent ceilings, and both stop below 6.1 — so TypeScript 7 is not a deferred upgrade, it is unavailable until Angular widens its range. TypeScript 6.0.3 is already the newest release in the 6.0 line, so there is no movement available on TypeScript at all right now.

Do not attempt this upgrade before `@angular/compiler-cli` declares support. Re-check its peer range at each Angular major.

### ESLint 10 is applied

Applied on 2026-08-12. Every consumer already declared support, checked the same way:

| Package                          | Declared ESLint range              |
| -------------------------------- | ---------------------------------- |
| `typescript-eslint` 8.67.0       | `^8.57.0 \|\| ^9.0.0 \|\| ^10.0.0` |
| `angular-eslint` 22.1.0          | `^9.0.0 \|\| ^10.0.0`              |
| `@nx/eslint` 23.1.1              | `^9.0.0 \|\| ^10.0.0`              |
| `eslint-plugin-playwright` 1.8.3 | `>=8.40.0`                         |
| `eslint-config-prettier` 10.1.8  | `>=7.0.0`                          |

ESLint 9 to 10 proceeded independently of TypeScript, moving `@eslint/js` 9.39.5 to 10.0.1 with
it. `eslint` is now 10.8.1 and `quality:all` passes with no new findings — the five remaining
`playwright/no-conditional-in-test` warnings predate the upgrade. `eslint-plugin-playwright`
stays on 1.x: its own 1-to-2 major is a separate change and ESLint 10 does not require it.

NgRx remains on `22.0.0-rc.0`: checked on 2026-08-12, and no stable 22 release exists yet. The latest published versions are 21.1.1 and the 22 pre-releases.

### Version pinning already in force

- Every `@ngrx/*` package is pinned exactly to `22.0.0-rc.0` with no range, so a fresh container install cannot resolve a different RC.
- Angular, Nx, TypeScript, and the DSpace, Solr, PostgreSQL, Gradle, and Node image tags are all pinned exactly.
- Container installs run `--frozen-lockfile`, so an install that would change the lockfile fails instead of drifting.

## Closed

### Java Tooling Gap

Was: no local Maven install, and a wrapper strategy undecided.

Closed by running Gradle inside the `gradle:9.6-jdk21` image. No local Java or build-tool install is required, and the toolchain is pinned by image tag.

### Java Version Choice

Was: Java 17 versus 21 undecided against unknown federal runtime availability.

Closed on Java 21. Revisit only if a concrete deployment constraint appears.

### Datastore Role Ambiguity

Was: two PostgreSQL databases both named `dspace`, inviting the reading that the application writes into DSpace's own schema.

Closed by renaming the application database to `civics_ops` with the role `civics`, and by documenting the four datastore roles in both architecture documents and in `docker-compose.yml` comments.

### Demo Startup Fragility

Was: no single command produced a demonstrable system, so a live demo depended on running several commands in the right order.

Closed by `pnpm run demo:up`, verified from a cold `docker:reset:everything` and on a warm restart. `start:all` remains the DSpace-free development path and no longer destroys a running DSpace stack.

### Fixture Data Masking an Unfinished Integration

Was: discovery and dataset detail were served from generated fixtures while DSpace held the synchronized item, so the missing read path was invisible in a demo.

Closed by making DSpace the read source for search, facets, dataset detail, and related research. The fixture catalog remains only as a fallback, and every response carries `resultSource` / `source` so a fallback is disclosed in the UI rather than mistaken for repository content.

### Analog/Vitest Angular Library Warning

Was: `tsconfig.app.json` warnings for non-buildable Angular libraries.

Closed during workspace setup.
