# USGS National Map Evaluation

## Purpose

Evaluate USGS National Map services as later reference overlays for the Civics Research Repository map workspace. The first implemented USGS overlay remains the earthquake event feed because it is simple, visibly demonstrable, and already normalized in the API contract.

## Official Sources Reviewed

- [The National Map](https://www.usgs.gov/programs/national-geospatial-program/national-map)
- [The National Map Services FAQ](https://www.usgs.gov/faqs/where-can-i-find-a-list-urls-national-map-services)
- [Download Data & Maps from The National Map](https://www.usgs.gov/tools/download-data-maps-national-map)
- [Access National Hydrography Products](https://www.usgs.gov/national-hydrography/access-national-hydrography-products)
- [National Hydrography Dataset](https://www.usgs.gov/national-hydrography/national-hydrography-dataset)

## Service Compatibility

USGS describes The National Map Services as a source for REST, WMS, WMTS, WFS, WCS, and related service links. For this Angular and MapLibre workspace:

- WMTS or raster tile services are the safest first integration for visual reference layers.
- WMS can work as raster tiles if CORS and parameter templates are stable.
- WFS is useful for accessible feature lists and filtering, but it needs tighter schema handling and paging limits.
- WCS and elevation image services are better for later analysis workflows than for the first demo overlay.

## Candidate Layers

### USGS Topo Base Map

Use case: optional basemap comparison for a polished map demo.

Assessment: useful later, but not needed now because the current OpenStreetMap base layer is sufficient and keeps the demo simple.

### 3D Hydrography Program And National Hydrography

Use case: streams, rivers, lakes, and watershed context around Census geographies.

Assessment: strong follow-on overlay. USGS notes that NHD was retired on October 1, 2023 and the most current direction is 3D Hydrography Program data. Treat legacy NHD as available but not the preferred long-term source.

### Watershed Boundary Dataset

Use case: watershed boundary context alongside Census boundaries.

Assessment: useful if the demo needs environmental geography. It should be added only after the UI can explain why Census and watershed boundaries differ.

### 3DEP Elevation

Use case: terrain or elevation context.

Assessment: useful for a later advanced demo, but less directly tied to repository discovery than hydrography. Avoid until raster service behavior, attribution, and accessibility summaries are proven.

## Recommendation

Defer National Map implementation until after the core Census, LODES, and USGS earthquake story is stable. When added, implement one hydrography reference overlay first:

- Preferred source family: 3D Hydrography Program, with legacy NHD only as fallback or comparison.
- Preferred rendering path: raster/WMTS or WMS visual layer first, then WFS feature summaries if needed.
- Required metadata: source, source URL, attribution, update/freshness note, service type, layer identifier, and fallback status.
- Required accessibility: visible legend, non-color-only label, feature-list or textual summary outside the canvas, and source attribution in the accessible content.

## Follow-On Implementation Tasks

- Add a `USGS_REFERENCE` map-layer fixture for one hydrography reference layer.
- Add OpenAPI metadata fields for service type and layer identifier if the current `MapLayer` DTO is not enough.
- Add a MapLibre raster source path for WMS or WMTS templates.
- Add storyboard checks that the reference overlay can be toggled independently from the earthquake overlay.
- Add accessibility copy explaining that hydrography context is environmental geography and not Census geography.
