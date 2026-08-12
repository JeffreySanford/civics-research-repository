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

Fourteen programs, 167 repository objects. Three are seeded per state and territory; the rest are national objects.

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

TIGER/Line, LODES, and ACS PUMS use file-level URLs, because their naming patterns are documented and stable (`tl_{year}_{fips}_tract.zip`, `{st}_wac_S000_JT00_{year}.csv.gz`, `csv_p{st}.zip`).

The eight programs added later link their authoritative data or program page instead. A fabricated deep link looks authoritative and fails silently, which is worse than a correct link one level up. Replacing them with verified file-level URLs is tracked in the backlog.

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
