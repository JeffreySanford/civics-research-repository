# Demo Script

Audience: Census/Open Science, repository modernization, accessibility, or technical architecture reviewers.

Timing: 15–20 minutes with questions; 10–12 minutes when compressed.

## Prerequisites

```bash
pnpm run start:all
```

Wait for the launcher to print the healthy service URLs. Before presenting repository-backed behavior, confirm the UI/API report repository content rather than the labelled fixture fallback.

Useful endpoints:

| Service        | URL                                |
| -------------- | ---------------------------------- |
| Discovery UI   | `http://localhost:4200`            |
| Repository API | `http://localhost:8080/api`        |
| DSpace REST    | `http://localhost:8081/server/api` |
| Discovery Solr | `http://localhost:8983/solr`       |
| DSpace Solr    | `http://localhost:8984/solr`       |

The current generated counts and evidence date are in [../platform-status.md](../platform-status.md). Use that document instead of memorizing numbers from this script.

## Opening — what this is (~1 minute)

**Say:**

> This is an independent federal Open Science reference implementation. DSpace is the repository system of record, the application owns a rebuildable public discovery index, and Angular provides accessible discovery, research-object, synchronization, evidence, and geospatial workflows. The important distinction is that this is not only a dataset catalog: publications, methodology, projects, access restrictions, citations, researchers, and typed relationships are first-class repository objects.

Show the architecture summary in the root README or [architecture-diagrams.md](../architecture-diagrams.md).

## Stop 1 — discover a research topic (~3 minutes)

**URL:** `http://localhost:4200/discovery`

Search for:

```text
North Dakota workforce
```

Show:

- relevance-ranked results rather than alphabetical catalog output,
- Program, Geography, Type, and Year facets,
- paging and stated result range,
- public/restricted access badges where applicable,
- result provenance (`REPOSITORY` versus explicitly disclosed `FIXTURE`),
- the link into the workforce map when a geographic research context is available.

**Say:**

> The UI does not search a hand-coded list. DSpace items are projected into the application-owned discovery index, and Solr uses repository metadata such as title, geography, subjects, authors, citation, DOI, type, access, and vintage. An empty program parameter means all programs; the platform does not hide the Open Science package through an implicit default filter.

Optional technical proof: open the `/api/search` response and point out paging, facets, and `resultSource`.

## Stop 2 — move from discovery to the workforce map (~4 minutes)

Open the area-focused workforce link from discovery or navigate to the map with the relevant geography selected.

Show:

- TIGER/Line boundaries,
- LODES workplace employment circles,
- LODES commuting-flow lines,
- the accessible workplace/commuting tables,
- SAIPE and optional USGS reference layers,
- layer information controls and methodology descriptions,
- selection synchronization between the table/list and the map,
- the link back to the research context.

**Say:**

> The map is a downstream research view, not a separate source of truth. Workplace jobs and commuting flows answer two different questions and are presented together. The map and tables are driven from shared NgRx state, so selection, URL state, announcements, and layer visibility cannot drift into separate experiences. Someone who never perceives the WebGL canvas can still obtain the research values and operate the workflow.

Be precise about provenance: some areas can be aggregated from public LODES source files within the request; a stored sample or fallback must be labelled as such rather than being reported as live aggregation.

## Stop 3 — inspect a research object and package (~3 minutes)

Open a dataset result, then show a publication or methodology result from the LEHD/LODES research package.

Show:

- type-aware detail rather than treating every object as a dataset,
- authors, DOI, citation, access level and license,
- typed relationships to supporting datasets, methodology, project, or restricted microdata,
- public files and authoritative source links,
- the absence of downloadable files for restricted microdata,
- mirrored bitstreams where the bounded preservation policy selected the file.

**Say:**

> Open Science is not “everything is downloadable.” Restricted research can remain discoverable and citable while the files stay protected and access instructions are explicit. DSpace records the research package; the discovery index makes those relationships searchable.

## Stop 4 — show synchronization and repository identity (~3 minutes)

**URL:** `http://localhost:4200/admin/sync`

Show:

- source selection,
- dry-run, diff, apply, and reindex actions,
- sync job history and planned actions,
- DSpace and Solr overview tabs,
- the difference between repository state and discovery projection.

**Say:**

> Spring Boot owns all synchronization. Registered adapters normalize catalog-backed publisher metadata as `ResearchObjectMetadata`; dry-run and diff stop before writes; apply changes only synchronization-owned fields and is idempotent. The public Solr core is disposable—reindex rebuilds it from DSpace. DSpace's own PostgreSQL and Solr remain internal to DSpace.

Mention that curated publications/methodology/project relationships are intentionally not fabricated as publisher-derived adapter facts.

## Stop 5 — show preservation and pipeline evidence (~2 minutes)

**URL:** `http://localhost:4200/evidence`

Open the Data pipeline tab.

Show:

- subscribed source bytes,
- mirrored/stored bitstreams,
- curated research objects,
- indexed objects,
- snapshot dates.

**Say:**

> These are four different measures. The platform does not imply that every public byte is stored locally. Mirroring is bounded by file and total-size budgets; authoritative links and manifests remain for everything else. The dates matter because publisher files can change.

## Stop 6 — accessibility evidence (~3 minutes)

Open the accessibility tab and, if useful, the generated evidence files.

Show:

- the recorded automated evidence date and commit,
- component-state and browser evidence,
- WCAG/Section 508-oriented entries,
- known manual gaps,
- the manual keyboard/NVDA/JAWS/map-equivalence checklists.

**Say:**

> Accessibility is a release artifact. Template lint prevents common regressions, component tests cover loading/failure/restricted states, and Playwright covers real-browser semantics, axe, contrast, reflow, zoom, forced colors, dark mode, keyboard preconditions, and map equivalence. A failing refresh does not replace the last known-good evidence. We do not call this Section 508 certified; manual assistive-technology evidence is tracked separately.

If discussing Safari, explain that raw Tab traversal depends on Full Keyboard Access and is recorded manually rather than inferred from Playwright WebKit.

## Closing — architecture and tradeoffs (~2 minutes)

Summarize:

```text
DSpace = repository truth
DiscoveryIndex/Solr = rebuildable public search
civics_ops PostgreSQL = operational sync state
Angular/NgRx/MapLibre = accessible public workflows
```

Name the deliberate tradeoffs:

- curated repository composition plus publisher verification, rather than unsafe automatic catalog edits,
- bounded preservation rather than mirror-everything or metadata-only extremes,
- one Java integration boundary rather than a second Node harvester runtime,
- equivalent nonvisual map data rather than claiming the WebGL canvas itself is the accessible information model,
- explicit fixture/fallback provenance.

Close with the remaining work from [../../planning/ROADMAP.md](../../planning/ROADMAP.md): manual AT evidence, browser-evidence CI/governance, infrastructure-as-code, provenance hardening, and limited product-language cleanup.

## Shutdown

```bash
pnpm run demo:down
```
