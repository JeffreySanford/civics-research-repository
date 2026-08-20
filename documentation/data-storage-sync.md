# Data Storage and Sync Plan

## Position

This project should store and synchronize repository research objects, metadata, documentation links, file manifests, checksums where available, and small fixtures. It should not mirror large public datasets into git or treat Solr as a raw-data warehouse.

DSpace remains the system of record for repository objects. Solr indexes searchable discovery fields. PostgreSQL stores DSpace repository state. External public data sources remain authoritative for public-use files even when selected artifacts are preserved locally. Docker volumes provide local persistence for DSpace, PostgreSQL, Solr, and budgeted mirrored source files.

## Source Coverage

The planning baseline covers the public resources mentioned for the demo:

- Census American Community Survey Public Use Microdata Sample.
- Census Survey of Income and Program Participation.
- Census Current Population Survey public-use datasets.
- Census LEHD Origin-Destination Employment Statistics / LODES.
- Census TIGER/Line geospatial files.
- USGS earthquake feeds and catalog data.
- USGS National Map reference layers, such as hydrography, elevation, and topographic context.

Optional federation candidates mentioned for later expansion:

- NOAA Climate Data Online.
- NASA POWER.
- Additional USGS public science datasets beyond the initial overlay use case.

## Storage Layers

### Git Repository

Store:

- OpenAPI schemas.
- Source adapters and typed DTOs.
- Seed metadata fixtures.
- Small representative GeoJSON or JSON fixtures.
- Documentation, diagrams, and accessibility evidence.

Do not store:

- Large Census ZIP/CSV microdata downloads.
- Full TIGER/Line shapefile archives.
- Large generated Solr indexes.
- DSpace/PostgreSQL volume data.

### DSpace

Store:

- Communities and collections.
- Dataset, publication, code, methodology, and supporting-material items.
- Metadata fields.
- Version relationships.
- Citations.
- Source and documentation links.
- File manifests for authoritative external files.
- Mirrored public source files selected under the configured total preservation budget.
- Checksums/fixity metadata for preserved bitstreams.

Possible later storage:

- Additional preservation copies as the deployment storage tier grows.
- Selected documentation PDFs not already represented by source manifests.
- Additional fixity/provenance metadata for external files.

### PostgreSQL

Store:

- DSpace repository metadata.
- DSpace workflow state.
- DSpace relationships.
- DSpace access and item state.

### Solr

Index:

- Title.
- Abstract.
- Publisher.
- Program.
- Collection.
- Content type.
- Topics.
- Geography.
- Geographic level.
- Vintage year.
- Release date.
- File formats.
- Documentation text where practical.
- Source URL.
- Citation.
- Version.
- Related-object references.
- Accessibility evidence status.

Do not index:

- Every row from ACS PUMS, CPS, SIPP, or LODES.
- Full raw microdata records.
- Large binary files.

### Docker Volumes

Use Docker named volumes for persistent local service state:

- DSpace asset store.
- PostgreSQL data.
- Solr cores/index data.
- Optional mirrored source artifacts.

These volumes should survive `docker compose restart` and normal app startup. Reset scripts should make destructive cleanup explicit.

### Local Cache

Use a local ignored cache for downloaded source metadata and small development extracts:

```text
.cache/public-data/
```

The cache should be disposable and reproducible from source URLs.

## Sync Model

Each source adapter should support:

- Discover: list candidate public datasets and releases.
- Normalize: map source metadata into repository DTOs.
- Diff: compare source metadata with current DSpace item state.
- Dry run: print intended creates, updates, and skipped items.
- Apply: create or update DSpace items.
- Verify: confirm DSpace item availability and Solr indexing.

## Sync Triggers

The platform should support three sync paths:

- Startup sync: runs when the Docker app starts and reconciles the seed repository objects.
- Admin UI sync: a button in the Angular admin workflow triggers sync, shows status, and displays dry-run/diff/apply results.
- Script sync: a command-line entry point runs the same sync flow for repeatable local and CI/demo use.

### Startup Sync Behavior

Startup sync defaults to `APPLY`, not `DRY_RUN`, and it runs only when DSpace is actually reachable.

The earlier default ran a dry run unconditionally, which meant that in the default Compose profile — where DSpace is not started — the log filled with `UPSERT_*` actions planned against a repository that was not running. In a demo that reads as repository work succeeding. Two changes make the log match reality:

- If no DSpace endpoint is configured, or the configured endpoint does not answer, startup sync is skipped and says so, naming the endpoint and the command that starts it. The repository is left untouched.
- If DSpace does answer, startup applies real, persisted changes. Apply is idempotent, so a second boot reports `found current metadata` and writes nothing.

`DRY_RUN` remains available as an explicit mode for the CLI and the admin UI, which is where planning without writing is genuinely useful. It is no longer the thing that happens automatically when nobody asked.

Set `CIVICS_SYNC_MODE=DRY_RUN` in `.env` to restore planning-only startup behavior, or `CIVICS_SYNC_STARTUP_ENABLED=false` to disable startup sync entirely.

### File Manifest Reconciliation

Every research object carries a file manifest describing its authoritative source files. Some of those files are also mirrored into the assetstore as real bitstreams; most are not. The manifest is the record either way, which is what makes the two cases interchangeable to everything downstream.

The manifest predates mirroring. It exists because the item originally carried no bitstreams at all, and it is the reason `sync:diff` could never report `SKIP_ITEM` before it: the source payload always described files the repository had no way to hold.

The manifest is now reconciled as repeatable `crr.file.manifest` metadata, one compact JSON entry per source file recording id, label, bundle, format, URL, and size where known. JSON rather than a delimited string because a source URL may contain any delimiter worth choosing. The field is registered in `tools/dspace/crr-types.xml` and written by the same idempotent apply path as every other managed field.

Two consequences worth knowing:

- `sync:diff` compares only the fields synchronization owns, listed in `DspaceManagedFields`. DSpace's own bookkeeping metadata is left alone. Comparing whole items against fields DSpace maintains is why the diff previously always reported `UPDATE_ITEM`.
- Dataset detail builds its file list from the manifest, falling back to the item's source and documentation URLs for items seeded without one.

### Mirrored Bitstreams

The currently committed assetstore snapshot holds **76 files, 1.00 GiB**, mirrored from the publishers by `tools/scripts/mirror-source-files.mjs`. That snapshot was produced under the earlier 1 GiB total / 120 MiB per-file policy.

The active policy now uses a **5 GiB total mirror budget with no independent per-file cap**. Any source file that reports a measurable size is eligible when its declared size fits inside the remaining total budget. Large legitimate geospatial or scientific artifacts are therefore not excluded merely because one file is hundreds of megabytes. Files that do not report a positive `Content-Length` remain external references rather than being downloaded blindly.

Selection uses publisher-reported size, while the downloader counts actual streamed bytes and aborts/removes partial output if a response crosses the remaining run budget. That makes the total budget the hard safety boundary even if a publisher's size metadata is imperfect. Downloads are cached in `tools/dspace/mirror-cache/`, outside the SAF tree, because `generate-saf.mjs` deletes and rewrites that tree on every run.

Bitstreams are appended alongside the manifest rather than replacing it. The manifest describes the authoritative source, which remains true whether or not a copy exists locally — a mirrored file is a preservation copy, not a new system of record.

Two failures are worth recording, because both were silent:

- The seed ran with `--exclude-bitstreams`, correct while every `contents` file was empty and catastrophic afterwards. Items imported cleanly, handles looked right, and the assetstore stayed at 6.7 kB.
- `contents` began with a blank line, which DSpace reads as a malformed first entry and stops on.

Neither produced an error. The check that catches them is the assetstore size, which the API now reports as `storedBitstreamCount` and `storedBytes` on the DSpace overview, and the Evidence page shows on its Data pipeline tab.

### Research Objects Through Sync

The harvest path used to be dataset-shaped. `PublicDatasetMetadata` carried a title, a program, a
geography and a file list, and nothing else — so a harvested object was structurally poorer than a
seeded one, and the two paths described different repositories.

`ResearchObjectMetadata` closes that. It adds resource type, access level, access note, licence,
DOI, researchers and typed relations, and all seven are reconciled through `DspaceManagedFields`
like any other managed field.

Two properties make widening it safe:

- **A missing source value is "no opinion", not "clear it".** The reconciliation skips fields the
  payload does not supply, so a dataset adapter that knows nothing about DOIs cannot erase one a
  seeded item carries.
- **The JSON encoding is shared.** `ResearchObjectJson` writes researcher and relation values in the
  exact shape `generate-saf.mjs` writes them, including omitting an absent ORCID rather than
  emitting null. A key-order difference would make `sync:diff` report a change on every run and
  never settle — the failure the file manifest had before its encoding was shared.

Verified against the live repository: apply, then diff reports `SKIP_ITEM`, and the harvested
TIGER/Line item carries `crr.resource.type=DATASET` and `crr.rights.access=PUBLIC`.

What remains is adapter coverage rather than model capability: only TIGER/Line reconciles live.

### Seeding Breadth

The repository is seeded from [tools/dspace/catalog.json](../tools/dspace/catalog.json), a data table of geographies and programs. `tools/scripts/generate-saf.mjs` expands it into DSpace SAF packages, which `pnpm run dspace:seed` regenerates before importing.

The current table produces **181 research objects across 15 programs**: TIGER/Line, LODES, and ACS PUMS per state and territory, eleven national program objects, and the five objects of the research package described in [open-science-research-objects.md](open-science-research-objects.md). Changing breadth or program mix is a change to the table, not to the repository tree. Set `enabled: false` on a program to drop it, or pass `--areas N` for a faster local loop.

By type: 177 datasets, 2 publications, 1 methodology report, 1 project.

Three details worth knowing:

- **Generated packages are git-ignored.** Committing 181 directories whose only differences are a state name and a FIPS code would bury the actual source of truth.
- **Packages are grouped by target collection.** `dspace import` takes one collection per run, so the generator writes `saf/<collection>/<item-id>` and the seed walks the groups, each with its own mapfile. A shared mapfile would make the second group's `--resume` believe the first group's items were its own and skip everything.
- **Directories are named by source identifier, not position.** The seed mapfile records `<directory> <handle>` and `--resume` skips directories already imported, so positional names would shift whenever the program mix changed and re-import existing items under new handles.
- **The generator writes `crr.file.manifest` in the same encoding the Java side uses.** A freshly seeded item therefore already matches the normalized source payload, and `sync:diff` reports `SKIP_ITEM` without needing an apply first.

Seeding is a bootstrap, not the ingestion strategy. It exists so a cold `demo:up` has content before anything is harvested. Live harvesting replaces the static adapter constants and writes through the same idempotent sync path; it does not replace the seed.

### Repository Read Caching

Dataset detail needs the whole item set to compute related research, which at 181 items means paging through all of DSpace discovery on every page view, around a second per request. `RepositoryCatalog` now caches the item list for a short window (`civics.repository.cache-ttl-seconds`, default 60) and drops it outright whenever the discovery projection is rebuilt, so staleness is bounded and never survives a synchronization. Dataset detail serves in roughly 5ms once warm.

This is a cache of repository reads, not a second source of truth: nothing is written to it, and it is discarded rather than reconciled.

### When DSpace Is Unreachable

Being unable to reach DSpace is reported as unavailability, never as "the item does not exist":

- `DIFF` returns a `FAILED` job whose `SYNC_FAILED` action names the endpoint and the fix. It previously reported `CREATE_ITEM`, confidently describing an item it had never actually looked for.
- `APPLY` fails the same way rather than surfacing a bare transport error.
- Both are returned as normal job responses, so the admin UI shows the reason instead of an HTTP 500.

CLI sync commands:

```bash
pnpm run sync:dry-run
pnpm run sync:diff
pnpm run sync:apply
```

These commands build the local Java API image, start required Docker Compose dependencies, run Spring Boot without the web server, execute the configured sync job, and exit. Diff mode compares the normalized DSpace item payload with repository item state and emits `CREATE_ITEM`, `UPDATE_ITEM`, or `SKIP_ITEM` actions before any apply behavior exists. The admin HTTP sync path remains available when the API is already running:

```bash
pnpm run sync:api:dry-run
pnpm run sync:api:diff
pnpm run sync:api:apply
```

## Sync State

Track sync state in the Java API persistence layer and expose it through typed API responses:

- Source system.
- Source URL.
- Source identifier.
- Last observed source update.
- Last successful sync timestamp.
- Last sync status.
- Source checksum or ETag where available.
- DSpace item ID.
- Solr indexed timestamp where available.

The current Java API persists each sync job as `RUNNING` before action execution, then updates that same job to `DRY_RUN_COMPLETE`, `APPLIED`, or `FAILED`. Failed runs are returned through the same typed API response with a `SYNC_FAILED` action so the admin UI and CLI/script paths can display the failure without losing job history.

Diff jobs complete with `DIFF_COMPLETE`. The production DSpace state reader now uses public DSpace discovery in read-only mode. It searches by source identifier first, falls back to the normalized item title, and maps discoverable item metadata into the same typed payload used by the sync planner. When DSpace is unavailable, diff mode safely reports no discovered item instead of failing local development startup.

Because DSpace discovery does not expose the full bitstream manifest in the same response, the first seeded TIGER/Line item can legitimately plan `UPDATE_ITEM` when the DSpace metadata or file manifest differs from the normalized source payload. Unit tests cover missing, matching, changed, and discovery-mapped repository payload states.

Apply mode now performs conservative DSpace writes for supported Dublin Core metadata and project-specific `crr.*` metadata. The DSpace seed process loads the Civics Research Repository metadata registry with fields for source identifier, program, geography level, vintage, source URL, and documentation URL. For the TIGER/Line seed item, the Java API authenticates to DSpace REST with the local demo administrator, finds the item by source identifier or normalized title, and reconciles normalized `dc.*` and `crr.*` metadata fields. This makes source-based diff lookup idempotent while leaving bitstream manifest writes for the next DSpace apply slice.

The diff and apply CLI targets start the DSpace profile non-destructively, run the idempotent DSpace seed job so required repository structure and metadata registries exist, and wait for `http://localhost:8081/server/api` before running the Java CLI. This avoids cold-start races without changing the default service ports.

## Initial Sync Scope

The first vertical slice should favor a visual geospatial dataset while still preserving repository metadata depth:

```text
2025 TIGER/Line - Census Tracts - North Dakota
or
2023 LODES - North Dakota Workplace Area Characteristics
```

Current implementation starts with the 2025 TIGER/Line Census Tracts dataset for North Dakota. The Java API includes a typed metadata adapter that normalizes the repository ID, title, program, publisher, geography, geographic level, vintage, release date, source ZIP URL, Census documentation URL, citation, and file manifest entries.

The normalized metadata is mapped into an internal DSpace item payload before sync actions are planned. The payload currently includes the DSpace object name/type, Dublin Core metadata fields, project-specific `crr.*` metadata fields for source tracking, and `ORIGINAL` bundle bitstream manifest entries that retain authoritative source URLs whether or not a preservation copy is mirrored into DSpace.

The first sync should create:

- DSpace community: Census Public Research Data.
- DSpace collection: TIGER/Line Geospatial Files.
- DSpace item: 2025 TIGER/Line - Census Tracts - North Dakota.
- File manifest entries for source files, documentation, and methodology.
- Solr discovery fields for search and facets.
- Map layer metadata for the Angular map tab.
- USGS overlay metadata for contextual map display.

## Expansion Order

1. TIGER/Line or LODES for the first visual geospatial slice.
2. ACS PUMS for a metadata-rich repository dataset.
3. SIPP.
4. CPS.
5. Additional LEHD/LODES and TIGER/Line coverage.
6. USGS earthquake overlay.
7. USGS National Map reference layer.
8. Optional NOAA Climate Data Online.
9. Optional NASA POWER.

## Operational Rules

- Keep mirroring budgeted; source links and manifests remain authoritative whether or not a local preservation copy exists.
- Use checksums, ETags, or source update timestamps when available.
- Keep sync jobs idempotent.
- Never make Solr the source of truth.
- Keep destructive sync behavior disabled until manual review exists.
- Add rate-limit and retry policies before scheduled syncs.
- Log every create, update, skip, and failure.
