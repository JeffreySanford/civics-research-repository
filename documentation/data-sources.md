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

### National Map

USGS National Map resources can provide basemap or reference overlays where licensing and service compatibility allow.

Potential use:

- Hydrography.
- Elevation.
- Topographic context.

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
