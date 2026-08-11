# Data Storage and Sync Plan

## Position

This project should store and synchronize repository research objects, metadata, documentation links, file manifests, checksums where available, and small fixtures. It should not mirror large public datasets into git or treat Solr as a raw-data warehouse.

DSpace remains the system of record for repository objects. Solr indexes searchable discovery fields. PostgreSQL stores DSpace repository state. External public data sources remain authoritative for large public-use files unless a later sprint explicitly chooses to mirror selected artifacts. Docker volumes provide local persistence for DSpace, PostgreSQL, Solr, and small-to-medium mirrored demo files.

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
- Small bitstreams where useful for the demo.
- Small-to-medium mirrored public files where they improve the local demo.
- File manifests for large external files.

Possible later storage:

- Mirrored small public files.
- Selected documentation PDFs.
- Checksums or fixity metadata for external files.

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

- Startup sync: runs when the Docker app starts and ensures seed/demo repository objects exist.
- Admin UI sync: a button in the Angular admin workflow triggers sync, shows status, and displays dry-run/apply results.
- Script sync: a command-line entry point runs the same sync flow for repeatable local and CI/demo use.

CLI sync commands:

```bash
pnpm run sync:dry-run
pnpm run sync:apply
```

These commands build the local Java API image, start required Docker Compose dependencies, run Spring Boot without the web server, execute the configured sync job, and exit. The admin HTTP sync path remains available when the API is already running:

```bash
pnpm run sync:api:dry-run
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

## Initial Sync Scope

The first vertical slice should favor a visual geospatial dataset while still preserving repository metadata depth:

```text
2025 TIGER/Line - Census Tracts - North Dakota
or
2023 LODES - North Dakota Workplace Area Characteristics
```

The first sync should create:

- DSpace community: Census Public Research Data.
- DSpace collection for the selected geospatial source.
- DSpace item for the selected North Dakota geospatial dataset.
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

- Prefer source links and manifests over full mirroring in early sprints.
- Use checksums, ETags, or source update timestamps when available.
- Keep sync jobs idempotent.
- Never make Solr the source of truth.
- Keep destructive sync behavior disabled until manual review exists.
- Add rate-limit and retry policies before scheduled syncs.
- Log every create, update, skip, and failure.
