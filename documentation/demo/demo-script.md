# Demo Script

Ordered walkthrough for a Census Bureau / technical interview demo. Assumes a cold or warm machine with Docker running and network access to federal data hosts.

**Timing:** about 15–20 minutes with questions; 12 minutes if you move quickly.

## Prerequisites

1. From the repository root:

   ```bash
   pnpm run start:all
   ```

   Equivalent: `pnpm run demo:up`. This starts the DSpace profile, application stack, seeds when needed, runs startup sync, reindexes discovery, and prints URLs.

2. Wait until startup reports **The stack is running.** If the projection warns about FIXTURE data, run `pnpm run dspace:verify:seed` before presenting repository-backed search.

3. Open these services if you need to cite infrastructure during Q&A:

   | Service        | URL                              |
   | -------------- | -------------------------------- |
   | Discovery UI   | http://localhost:4200            |
   | Repository API | http://localhost:8080/api        |
   | DSpace REST    | http://localhost:8081/server/api |
   | Discovery Solr | http://localhost:8983/solr       |

## Stop 1 — Discovery search and facets (~4 min)

**URL:** http://localhost:4200/discovery

**Show:** keyword search, program facet (TIGER/Line, LODES, ACS selected by default), geography and vintage filters, result cards with publisher and source links.

**Say:** Discovery reads from DSpace through the Java API and Solr projection—not from hand-coded UI lists. One hundred sixty-four research objects across fourteen programs and fifty-two geographies are searchable here. Facets reflect what is actually in the repository; selecting a program does not hide the others, so filters stay reversible. If DSpace were down, the UI would disclose FIXTURE data explicitly rather than masquerading as repository content.

**Optional drill-down:** open the browser network tab on `/api/search` and point out `resultSource: REPOSITORY`.

## Stop 2 — North Dakota dataset detail (~3 min)

**URL:** http://localhost:4200/datasets/tiger-line-north-dakota-2025

**Show:** metadata summary, file manifest with source URLs, citation copy, versions tab, related research scoped by shared geography, Map tab link. Files that were mirrored also exist as real bitstreams in the assetstore; the manifest names the publisher source either way.

**Say:** This item is the geospatial vertical slice: TIGER/Line tract boundaries for North Dakota. Large Census archives stay at census.gov; the repository stores metadata, manifests, and provenance links per the no-bitstream-mirroring policy. Related research is computed from the repository catalog, not hard-coded filler.

## Stop 3 — Maps workspace (~4 min)

**URL:** http://localhost:4200/maps

**Show:** three layer toggles (TIGER/Line boundary, LODES sample, USGS earthquakes), legend with non-color-only labels, accessible feature list beside the map, area selector changing both viewport and layers.

**Say:** Every map visualization has an accessible non-map representation—the feature list is keyboard-reachable and synchronized with map selection. USGS earthquakes load live when the feed responds; otherwise the UI shows fallback state with attribution and freshness metadata. See [mapping-usgs-walkthrough.md](mapping-usgs-walkthrough.md) for layer and worker details.

## Stop 4 — Admin sync (~3 min)

**URL:** http://localhost:4200/admin/sync

**Show:** sync job history, dry-run and apply actions for TIGER/Line, action log with CREATE, UPDATE, SKIP, and VERIFY entries.

**Say:** The Java API owns sync orchestration—startup sync, admin UI, and CLI entry points share the same adapters. Dry-run plans work without writing; diff compares normalized metadata including the file manifest field so idempotent apply reaches SKIP_ITEM. DSpace remains the system of record; sync updates items there, then reindex rebuilds Solr from repository state.

**CLI equivalent (optional):** `pnpm run sync:api:diff` or `pnpm run sync:api:apply`.

## Stop 5 — Accessibility evidence (~2 min)

**URL:** http://localhost:4200/evidence

**Show:** automated WCAG and Section 508 baseline status, dated evidence entry, link to manual checklists.

**Say:** Accessibility is treated as a release artifact, not a checkbox. Automated axe and Playwright scans cover primary routes; manual keyboard, NVDA, JAWS, and map-equivalence checklists are documented with known open items called out honestly. The automated baseline is recorded under `documentation/accessibility-evidence/`.

## Closing (~2 min)

Summarize the four datastore roles (application PostgreSQL, DSpace PostgreSQL, discovery Solr projection, DSpace Solr). Point to [tradeoffs.md](tradeoffs.md) for deliberate limits—catalog curation vs harvest, fixture fallback, no separate harvester service—and [architecture.md](../architecture.md) for the full model.

**Stop the stack:**

```bash
pnpm run demo:down
```
