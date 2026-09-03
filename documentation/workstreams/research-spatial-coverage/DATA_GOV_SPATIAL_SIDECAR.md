# Data.gov spatial sidecar

## Purpose

The Data.gov spatial sidecar turns the Data.gov spatial source evidence measured in the nationwide geometry and source-semantics work into durable repository data without changing the certified C2 federated corpus.

The sidecar is intentionally independent of `federated_research_objects`. C2 remains the research-object identity and metadata corpus. The sidecar stores spatial evidence for those retained identities and can be rebuilt from a newer Data.gov source snapshot without rewriting C2.

## Source semantics

The sidecar preserves three Data.gov spatial signals with different meanings:

- `spatial_shape` is the canonical publisher geometry when present. It is retained as full publisher GeoJSON and is the only source used to derive canonical query bounds.
- `spatial_centroid` is preserved as Data.gov source-derived point evidence. Current Data.gov behavior represents it as a `geo_point` and derives it from the source geometry; the repository records the method as `DATA_GOV_VERTEX_MEAN` rather than relabeling it as a mathematical polygon centroid.
- `dcat.spatial` is preserved raw as provenance. The repository does not assume that a four-number value is a canonical west/south/east/north envelope and does not repair or reorder it during sidecar ingestion.

The sidecar therefore distinguishes source evidence from repository rendering semantics. A Data.gov source point is not automatically the repository's rendering point.

## Retained population

A Data.gov record can be present in the sidecar only when the same `(source_system, source_identifier)` exists in `federated_research_objects`.

A rebuild traverses Data.gov's current geospatial source population, but persistence is conditionally filtered against the retained C2 Data.gov identities. The traversal cannot add a new research object to C2 and cannot change C2 metadata.

The sidecar retains all C2-intersected Data.gov geospatial evidence, not only records with `spatial_shape`.

This distinction is deliberate:

- a **matching** record is a retained C2 Data.gov object present in the Data.gov geospatial source population;
- a **mapped** record has publisher geometry that is structurally usable for the bounded spatial API;
- an **unmapped** record has spatial source evidence but no queryable publisher geometry.

The bounded API reports these populations explicitly rather than treating missing geometry as a missing research object.

## Geometry states

Each sidecar row has one conservative geometry state:

- `VALID` — publisher geometry is structurally valid, uses coordinates inside the WGS84 longitude/latitude domain, and has an ordinary normalized longitude envelope.
- `ANTIMERIDIAN_CANDIDATE` — publisher geometry is structurally valid but its naive longitude span exceeds 180 degrees. The publisher coordinates are preserved; ingestion does not sort, wrap, or otherwise repair them.
- `NO_PUBLISHER_GEOMETRY` — the retained Data.gov geospatial match has no `spatial_shape`. Source centroid and raw `dcat.spatial` evidence can still be retained, but the row has no canonical geometry, canonical bounds, or repository render point.
- `QUARANTINED` — publisher geometry is present but is structurally invalid or contains coordinates outside the WGS84 domain. It remains evidence but is not queryable geometry.

Only `VALID` and `ANTIMERIDIAN_CANDIDATE` rows can expose queryable publisher geometry. The bounded API gives antimeridian candidates explicit handling rather than treating their naive min/max longitude envelope as an ordinary viewport box.

## Rendering points

For ordinary valid geometry, the sidecar derives a deterministic `SHAPE_BOUNDS_CENTER` point for later clustering/rendering workflows.

For an antimeridian candidate, a conventional bounds center can be misleading. When a valid Data.gov source point is available, the sidecar can retain that point as the rendering anchor using `DATA_GOV_SOURCE_POINT_FOR_ANTIMERIDIAN_CANDIDATE` while keeping the source-point provenance explicit.

`NO_PUBLISHER_GEOMETRY` and `QUARANTINED` rows do not receive a repository render point merely to force them onto a map.

## Versioned build and activation

A rebuild writes a new versioned build. It never refreshes the active rows in place.

Each build records:

- sidecar schema version;
- source snapshot/capture time;
- source system;
- active C2 composition SHA-256;
- active discovery projection ID;
- build status and retained row count.

The rebuild can begin only when the exact `FEDERATED_1M` corpus is active, its composition-to-projection evidence is available, and exactly 500,000 Data.gov identities are retained in C2. A full source traversal also requires a personal Data.gov API key rather than `DEMO_KEY` or a placeholder.

The activation sequence is:

```text
new RUNNING build
        |
        v
Data.gov geospatial traversal
        |
        v
C2 identity-filtered sidecar rows
        |
        v
full traversal completes
        |
        v
mark COMPLETE + atomically activate
```

If traversal or persistence fails, the new build is marked `FAILED`. The previously active complete build remains active. Partial replacement data therefore cannot silently become the Maps source.

## Operator API

The local operator contract exposes:

```text
GET  /admin/spatial/datagov/status
POST /admin/spatial/datagov/rebuild
```

The rebuild endpoint accepts optional `pageSize` and `maxPages` controls, with server defaults of 1000 and 2000. The service enforces its own ranges and corpus/API-key preconditions.

The rebuild response reports source pages/rows, publisher-shape rows, retained sidecar rows, and source-level quarantined-shape rows. These are evidence counters, not a claim that every retained sidecar row can be rendered.

## Storage and scaling boundary

The sidecar stores the full publisher geometry because the nationwide geometry census showed that the Data.gov geometry population is overwhelmingly tiny. The current architecture therefore does not add geometry simplification tiers or PostGIS solely for storage.

The scalability boundary is the query API, not ingestion:

```text
~440K retained spatial evidence rows
                |
                v
active versioned sidecar
                |
                v
criteria + viewport bounded query
                |
                +--> matching / mapped / unmapped counts
                |
                +--> bounded feature set
                v
MapLibre + semantic HTML equivalent
```

The browser must never receive the complete sidecar population.

## Bounded query layer

The read boundary is implemented by `GET /maps/research-coverage` and documented in [BOUNDED_RESEARCH_SPATIAL_API.md](BOUNDED_RESEARCH_SPATIAL_API.md).

That layer:

- pins each request to one active build and returns its composition/projection identity;
- accepts the shared Discovery criteria shape plus WGS84 viewport constraints;
- reports matching, mapped, unmapped, quarantined, antimeridian, viewport, returned, and omitted counts;
- enforces a deterministic feature limit with a hard maximum of 500;
- handles antimeridian candidates separately from ordinary numeric envelope filtering;
- returns full publisher GeoJSON only for the bounded features selected for the current request;
- carries semantic research metadata needed by the accessible Maps equivalent.

## Next slice

The remaining visible work is the Maps Research Coverage UI: add the category/layer, connect Discovery criteria and viewport changes to the bounded endpoint, render only the returned features in MapLibre, and expose equivalent semantic summary/table content with Storybook, axe, keyboard/focus, and Playwright evidence.
