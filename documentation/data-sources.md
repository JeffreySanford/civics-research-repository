# Data Sources

## Source Selection Criteria

Public resources should be selected when they support a repository-style research object:

- Clear title and publisher.
- Stable source URL.
- Release or vintage date.
- Documentation or methodology.
- File formats and download links.
- Program, subject, geography, and version metadata.
- Reasonable public access terms.

## Vintage Currency

`pnpm run verify:vintages` reports where the catalog's vintage is behind what the publisher offers.

This is the useful half of "harvest the catalog from live publishers", and it is worth being precise
about which half is achievable:

**Discoverable.** Census publishes bulk files on an autoindexed host, so which vintages exist can be
read directly — `/geo/tiger/` lists TIGER2020 through TIGER2025, LEHD lists one file per year.
Where a program's listing exists, the check reads it and compares.

**Not discoverable.** `api.census.gov/data.json` catalogs the Census _Data API_, not the file server.
All 1,798 datasets carry a `distribution` block, but its `accessURL` points at api.census.gov and
`downloadURL` is absent throughout. So the file naming inside a vintage — `jan26pub.zip`,
`tl_2025_38_tract.zip`, `csv_pnd.zip` — still has to be curated, and lives as a URL template in
`catalog.json`.

**The check reports; it does not rewrite.** A new vintage does not guarantee the file names carry
over, and a script that bumped the year automatically would produce a catalog full of plausible URLs
that 404 — precisely the failure this repository has spent its effort removing. A person reads the
report and edits the template.

Where a program has a `vintageIndex`, it sits beside the program in `catalog.json` rather than in
the checking script. A second table is the drift this repository keeps deleting: the CPS adapter
spent months pinned to a vintage the catalog never seeded, and nothing compared the two.

Eight of the fourteen programs have no listing to check yet, and the report names them rather than
passing over them silently.

## Census Collections

### American Community Survey PUMS

ACS Public Use Microdata Sample is the preferred first collection. It supports realistic metadata for program, vintage, geography, person/housing files, documentation, and methodology.

Repository item example:

```text
2024 ACS 1-Year PUMS - North Dakota
Program: American Community Survey
Product: Public Use Microdata Sample
Geography: North Dakota
Dataset Type: Person and Housing Microdata
Publisher: U.S. Census Bureau
Access: Public
Files: README, data dictionary, CSV downloads, methodology
```

### SIPP

Survey of Income and Program Participation provides longitudinal social and economic public-use data. It is useful for demonstrating research topics such as income, employment, poverty, benefits, and program participation.

### CPS

Current Population Survey public-use datasets support recurring releases, supplements, version browsing, and related methodology documents.

### LEHD / LODES

LEHD Origin-Destination Employment Statistics and LODES support geospatial employment discovery and map-based previews.

Useful facets:

- State
- Year
- Job type
- Dataset component
- Workplace or residence characteristics
- Origin-destination files

### TIGER/Line

TIGER/Line provides geospatial boundaries and reference layers such as states, counties, tracts, roads, districts, and ZIP Code Tabulation Areas.

Useful facets:

- Vintage
- Geography
- Geographic level
- File format
- State

## USGS Overlay Candidates

### Earthquakes

USGS earthquake feeds and catalog data can provide a visible overlay for hazard and event context.

Potential use:

- Recent earthquake points over Census geography.
- Time-filtered overlays.
- Magnitude-based styling.

Initial normalized overlay fields:

- Source label.
- Source URL.
- Attribution.
- Update timestamp.
- Stale-after timestamp.
- Fallback fixture flag.
- Query filters: minimum magnitude, day window, and bounding box.
- Event fields: ID, place, magnitude, occurrence time, latitude, and longitude.

Attribution requirement: display `U.S. Geological Survey Earthquake Hazards Program` with the overlay and keep the public source URL available from the accessible feature list.

### National Map

USGS National Map resources can provide basemap or reference overlays where licensing and service compatibility allow.

Potential use:

- Hydrography.
- Elevation.
- Topographic context.

Evaluation result: defer National Map implementation until the current Census, LODES, and USGS earthquake story is stable. The strongest follow-on option is a single hydrography reference overlay from the **3D Hydrography Program (3HP)**.

Legacy NHD is not a fallback and must not be implemented. USGS retired it on 1 October 2023. Keeping it as a "comparison or fallback" invites an adapter, a layer toggle, a legend, and a metadata mapping built against a dead format, all of which would then need rebuilding. Any hydrography work targets 3HP raster and vector specifications from the first line of code.

See [USGS National Map Evaluation](usgs-national-map-evaluation.md).

## Programs Currently Seeded

Fourteen programs, 164 repository objects. Three are seeded per state and territory, less the three LODES areas the publisher does not cover; the rest are national objects.

| Program                                                                                                     | Scope    | Items |
| ----------------------------------------------------------------------------------------------------------- | -------- | ----- |
| TIGER/Line                                                                                                  | Per area | 52    |
| LODES                                                                                                       | Per area | 52    |
| ACS PUMS                                                                                                    | Per area | 52    |
| SIPP, CPS, USGS earthquakes                                                                                 | National | 3     |
| Economic Census, County Business Patterns, Building Permits, Population Estimates, SAIPE, Business Dynamics | National | 6     |
| USGS 3DEP, USGS 3HP                                                                                         | National | 2     |

TIGER/Line, LODES, and ACS PUMS are selected by default in discovery, because they carry the geospatial demo story. The other eleven are one click away and their facet counts stay visible whatever is selected.

Programs are defined in [tools/dspace/catalog.json](../tools/dspace/catalog.json). Adding one means a row there plus a `ResearchProgram` enum value in the OpenAPI contract — without the enum value an item is reported as `OTHER`, which is honest but useless for faceting.

### Source URL accuracy

Every program now uses a file-level source URL, and every one of them has been requested and answered. The eight programs added later previously linked their program page, on the reasoning that a fabricated deep link looks authoritative and fails silently. That reasoning still holds; the links are file-level now because they were checked, not guessed.

Checked with:

```bash
pnpm run verify:sources:all
```

[tools/scripts/verify-source-urls.mjs](../tools/scripts/verify-source-urls.mjs) walks the generated SAF packages and requests every source and documentation URL. The default `verify:sources` checks one item per program, which is enough to catch a template that has gone stale; `--all` checks all of them. It exits non-zero on any failure, so it can gate a catalog change.

It is deliberately not part of `quality:all`. It depends on federal hosts being reachable, and a Census outage must not read as a broken build.

Last full run on 2026-08-12: 328 URLs across 181 items, all resolving. It found five broken links that had been in the catalog unnoticed — three dead Census documentation pages, and a SIPP source template pointing at `pu{vintage}.csv.gz` when the published file is `pu{vintage}_csv.zip`. The two USGS documentation pages answer 403 to a default user agent while serving a browser normally, so the checker sends a browser user agent; without that it reports live pages as broken.

### What is harvested and what is curated

Two different things get called "source metadata", and they are handled differently.

**Curated.** Which programs exist, which files each one has, and what they are called. These are decisions, they change rarely, and a wrong one is visible. They live in [tools/dspace/catalog.json](../tools/dspace/catalog.json).

**Harvested.** How large a file is, and when the publisher last issued it. These are facts about the file that change without notice, so a compiled value is wrong the moment the Bureau reissues the archive. [HttpSourceFileProbe](../apps/repository-api/src/main/java/org/civicsrepo/sources/HttpSourceFileProbe.java) reads them from the response headers with a HEAD request, and the metadata adapter uses them in place of constants.

Both facts were previously compiled in: every file reported no size at all, and the TIGER/Line release date was a literal. The first live run corrected that date from 2025-09-23 to 2025-09-22, which is what `Last-Modified` actually says.

A dry run shows both, so the harvest is visible without reaching into DSpace:

```
Prepare DSpace item payload with 17 metadata fields and 3 file manifest entries, published 2025-09-22.
Track 3 source files: source-zip=ZIP (1825199 bytes), technical-documentation=PDF (4598419 bytes), source-landing-page=OTHER.
```

An unreachable publisher is an expected condition, not an error. The probe returns nothing, the adapter falls back to its compiled release date, and sizes stay absent — a sync must not fail, or hang, because census.gov is slow. Timeouts are 3 seconds to connect and 6 to respond. Unit tests use an offline probe, so they neither depend on nor wait for a federal host.

Still curated, and worth being plain about: the catalog is not discovered from the Census and USGS APIs. Harvesting _which_ datasets exist is a larger piece of work; `verify:sources` is the interim guard that what the catalog claims still resolves.

### How much data this is, and where it lives

The repository subscribes to public files rather than copying them. `pnpm run sources:inventory` asks every distinct source URL for its length, aggregates by program, and writes `apps/repository-api/src/main/resources/source-inventory.json` with the date it was taken. The API serves that at `GET /admin/sources/inventory`, and the evidence page's **Data pipeline** tab shows it beside the DSpace and Solr figures.

Measured on 2026-08-17: **1.72 GiB across 191 distinct files and 181 research objects**, of which 167 files reported a length and 8 did not answer. Files are counted once per URL — several objects reference the same national file, and counting it per reference would inflate the total into fiction.

Three numbers, three different things:

| Stage      | What it counts                                                  | Order of magnitude                      |
| ---------- | --------------------------------------------------------------- | --------------------------------------- |
| Subscribed | Bytes held by the publishers, at the URLs the catalog points at | ~1.7 GiB                                |
| Stored     | The DSpace assetstore                                           | ~7 KB — it holds no source bytes at all |
| Indexed    | Documents Solr serves to discovery                              | 183 documents                           |

The gap between the first two is the design, not an omission: DSpace holds metadata, links, and file manifests. The container footprint people notice (several GB) is images and `node_modules`, not research data — `postgres-data` is ~48 MB and `dspace-postgres-data` ~72 MB.

Sizes are an as-of figure. Agencies reissue files, so the inventory is a measurement with a date rather than a live number, and the UI shows the date next to the total. Like `verify:sources`, it is deliberately outside `quality:all`: it depends on federal hosts being reachable, and an agency outage must not read as a broken build.

### Areas a program does not cover

LODES is published for 49 of the 52 areas, not all of them:

| Area        | Reason                                                                |
| ----------- | --------------------------------------------------------------------- |
| Alaska      | Does not participate in LEHD; no WAC file exists for any vintage.     |
| Michigan    | Withdrew from LEHD after the 2021 vintage; the last WAC file is 2021. |
| Puerto Rico | Not covered by LODES8 WAC.                                            |

These are recorded as `unavailableAreas` on the program in the catalog, with the reason, and the generator skips them and reports what it skipped. Seeding them anyway would give the repository three research objects whose source URL 404s — which reads as provenance and is not. That is why the seeded total is 164 rather than 167.

## Metadata Model

Initial metadata fields:

- Title
- Abstract
- Publisher
- Program
- Collection
- Content type
- Topics
- Geography
- Geographic level
- Vintage year
- Release date
- File formats
- Source URL
- Documentation URL
- Citation
- Version
- Related objects
- Accessibility evidence status

## Ingestion Policy

Early iterations should avoid copying large public datasets into the repo. The first implementation can store metadata, documentation links, checksums where available, and source URLs. File mirroring can be added later for selected small artifacts.
