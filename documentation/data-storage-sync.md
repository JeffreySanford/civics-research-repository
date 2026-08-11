# Data Storage and Sync Plan

## Position

This project should store and synchronize repository research objects, metadata, documentation links, file manifests, checksums where available, and small fixtures. It should not mirror large public datasets into git or treat Solr as a raw-data warehouse.

DSpace remains the system of record for repository objects. Solr indexes searchable discovery fields. PostgreSQL stores DSpace repository state. External public data sources remain authoritative for large public-use files unless a later sprint explicitly chooses to mirror selected artifacts.

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

## Sync State

Track sync state as repository metadata or a small application table once the Java API exists:

- Source system.
- Source URL.
- Source identifier.
- Last observed source update.
- Last successful sync timestamp.
- Last sync status.
- Source checksum or ETag where available.
- DSpace item ID.
- Solr indexed timestamp where available.

## Initial Sync Scope

The first vertical slice should sync one dataset:

```text
2024 ACS 1-Year PUMS - North Dakota
```

The first sync should create:

- DSpace community: Census Public Research Data.
- DSpace collection: American Community Survey PUMS.
- DSpace item: 2024 ACS 1-Year PUMS - North Dakota.
- File manifest entries for README, data dictionary, CSV downloads, and methodology.
- Solr discovery fields for search and facets.

## Expansion Order

1. ACS PUMS.
2. SIPP.
3. CPS.
4. LEHD/LODES.
5. TIGER/Line.
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
