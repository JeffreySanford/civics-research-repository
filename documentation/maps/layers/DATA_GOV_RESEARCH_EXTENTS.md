# Data.gov research extents

Issue: #66

## Goal

Replace the current same-color polygon carpet with a bounded visualization that is visually useful and semantically faithful to Data.gov metadata.

## What the source means

The active spatial sidecar retains publisher-supplied Data.gov `spatial_shape` geometry for retained C2 Data.gov identities. It also preserves source-derived points and raw `dcat.spatial` evidence with separate provenance.

The layer therefore means:

> spatial extent declared by the Data.gov publisher metadata for this retained research object

It does **not** automatically mean:

- where observations were collected;
- where a sensor was located;
- where a publisher, laboratory, author, or institution is located;
- that every location inside a broad polygon was scientifically studied at equal intensity.

## Current UX problem

The browser currently renders ordinary publisher polygons with one fill color and one outline color. When many coarse or overlapping extents are returned for a viewport, repeated translucent polygons visually accumulate into a uniform teal/green field.

That behavior is technically faithful to the source shapes but communicates almost no comparative information and can look more precise than the metadata warrants.

## Planned interaction model

### Default multi-record view

- Rename the layer to **Data.gov research extents**.
- Render bounded records through their safe deterministic/source-derived render anchors.
- Use modest points and MapLibre clustering when feature density warrants it.
- Do not display the full filled polygon set by default.
- Cluster count means number of returned matching research objects represented by the cluster; it does not mean research intensity.

### Selected-record view

When a user selects or focuses a research object:

- highlight its point/cluster member;
- render only that object's publisher-declared polygon/multipolygon or safe antimeridian representation;
- use an outline as the primary footprint mark;
- use only a very light fill, if any;
- synchronize selection with the semantic Research Coverage table/detail affordance.

Selection should be stable in NgRx/URL state only where that behavior is already consistent with Maps interaction patterns; transient hover must not become the only way to inspect a feature.

## Copy

Recommended layer label:

> Data.gov research extents

Recommended explanation:

> Shows spatial extents declared in Data.gov metadata for matching research objects. These indicate where a resource says it applies, not necessarily where observations were collected.

The existing no-substitution rule remains explicit: missing research geometry is not replaced by publisher, laboratory, author, or institution locations.

## Architecture

Reuse:

- the versioned Data.gov spatial sidecar;
- `GET /maps/research-coverage`;
- bounded viewport/criteria requests;
- existing matching/mapped/unmapped/quarantined/antimeridian/truncation counts;
- existing semantic Research Coverage component.

Prefer extending the bounded feature payload only if selection/cluster rendering lacks a required stable property. Do not duplicate spatial truth in the frontend.

The browser remains unaware of Data.gov traversal, sidecar rebuilds, raw source repair policy, or C2 internals.

## MapLibre direction

Likely layer stack:

```text
repository-research-coverage-clusters
repository-research-coverage-cluster-count
repository-research-coverage-points
repository-research-coverage-selected-fill
repository-research-coverage-selected-line
```

The selected fill/line layers should be filtered to one stable research-object identifier. Antimeridian candidates continue to use explicit safe rendering behavior rather than a naive world-spanning envelope.

## Accessibility

The semantic Research Coverage component remains the authoritative nonvisual equivalent for the bounded set.

Required behavior:

- point/cluster rendering never hides records from semantic HTML;
- selection from the map has a keyboard-accessible equivalent;
- selection from the semantic table can reveal the same footprint;
- selected object, publisher, declared-extent semantics, source/provenance, viewport/truncation state remain available without WebGL;
- no information is encoded only by polygon color.

## Tests

### Unit/component

- render-anchor conversion for ordinary valid geometry;
- antimeridian safe-anchor behavior;
- selected-feature filtering;
- no default multi-feature polygon fill;
- semantic selection state and accessible status.

### Storybook

- clustered/populated;
- selected footprint;
- empty viewport;
- truncated bounded result;
- no publisher geometry;
- antimeridian candidate;
- API failure/no response.

### Playwright

- default Research Coverage view does not create/show the old polygon carpet;
- point/cluster layers register and respect layer visibility;
- selecting a research object reveals exactly one declared footprint;
- semantic table and map selection identify the same object;
- Discovery criteria and viewport continue to reach the bounded API;
- no-WebGL semantic fallback remains useful.

## Non-goals

- do not create a conventional heat map from polygon centers and call it research density;
- do not infer observation density from overlapping extents;
- do not mutate the spatial sidecar merely for presentation;
- do not rerun accepted C2/C2.1 timing evidence.

## Exit criteria

- the normal viewport no longer becomes a uniform green/teal field;
- users can understand what the layer represents from its label/help text;
- the default view communicates record locations/availability without implying false coverage precision;
- selecting one record reveals its declared publisher extent;
- visual and semantic representations stay synchronized;
- all normal Maps accessibility/browser gates pass.
