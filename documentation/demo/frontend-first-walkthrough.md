# Frontend-First Demo Walkthrough

Audience: frontend, Angular, accessibility, public-sector modernization, and stakeholder reviewers.

Timing: **5–8 minutes**. Use the deeper [`demo-script.md`](demo-script.md) when the audience wants repository/search internals.

## Positioning

Open with one sentence:

> This is an independent federal Open Science reference implementation focused on the public research experience: Angular 22, NgRx/RxJS, generated API contracts, accessible discovery and mapping, and reviewable evidence over a certified million-record search projection.

Do not lead with Solr/OpenSearch. The engines are supporting architecture and research evidence, not the user experience.

## Stop 1 — Discovery and URL-owned state (~2 minutes)

**URL:** `http://localhost:4200/discovery`

Search for:

```text
North Dakota workforce
```

Show, in this order:

1. search + current corpus identity;
2. data-driven facets;
3. query/filter state reflected in the URL;
4. provenance/source badges and authoritative-source links;
5. paging and visible result range;
6. the geography-aware link into Maps.

**Say:**

> Angular owns the interaction and URL state; NgRx owns the async search workflow. Components consume the generated application contract rather than talking to Solr or DSpace directly. The same page renders curated DSpace records and federated publisher metadata while keeping origin and authority visible.

If useful, change one facet and point out that paging resets while the rest of the query remains intact.

## Stop 2 — Research-object detail and provenance (~1 minute)

Open a representative result through `/research/:id`.

Show:

- object type/title/provenance;
- authors/citation/DOI/access data where available;
- authoritative-source links;
- relationships/files for curated objects;
- explicit external/federated behavior when the content is not preserved locally.

**Say:**

> The route is authority-neutral. Angular renders one typed research-object contract; Spring decides whether the identity resolves to curated DSpace content or retained federated metadata. The frontend does not know DSpace internals.

## Stop 3 — Maps with an equivalent semantic experience (~1–2 minutes)

Open the workforce map from Discovery.

Show:

- MapLibre visual layers;
- geography/layer controls;
- accessible list/table equivalents;
- shared selection or synchronized context;
- methodology/provenance text.

**Say:**

> The WebGL canvas is not the accessibility model. The map and semantic representation consume the same application state, so research values and meaningful tasks remain available without perceiving the canvas.

Keep the explanation at the frontend/state level unless the audience asks about TIGER/LODES ingestion.

## Stop 4 — Evidence as a product surface (~1 minute)

**URL:** `http://localhost:4200/evidence`

Show accessibility evidence first, then Search comparison briefly.

Highlight:

- automated evidence versus manual AT status;
- real-browser/axe/Storybook evidence;
- Historical C2 and Adversarial C2.1 as separate layers;
- the scoped claim boundary.

**Say:**

> Evidence is part of the UI contract. The application distinguishes what automation actually proved from what still requires a human AT run, and it presents search-performance results without turning a scoped local experiment into a universal engine claim.

## Stop 5 — Search Lab only as supporting engineering depth (~1 minute)

**URL:** `http://localhost:4200/search-lab`

Show one side-by-side comparison and point to projection parity before timing.

**Say:**

> Search Lab is an engineering diagnostic, not the product homepage. Angular consumes one typed comparison response; engine query syntax, projection checks and failures stay behind Spring. The C2.1 experiment gives us deeper evidence that the public discovery architecture is operating over a real million-record projection.

## Close

Finish with the frontend ownership boundary:

```text
Angular / NgRx / RxJS / MapLibre
        |
        | generated OpenAPI contract
        v
Spring repository API
        |
        +--> DSpace
        +--> PostgreSQL
        +--> Solr / OpenSearch
```

Suggested closing sentence:

> The main engineering story is the browser experience: reproducible discovery state, clear provenance, accessible maps, resilient async states and generated contracts. The repository/search work underneath demonstrates that the frontend is not a mock—it has been exercised against production-scale shapes and adversarial evidence.

## What to skip in the short walkthrough

Unless asked, do not spend the 5–8 minute path on:

- DSpace internal PostgreSQL/Solr ownership;
- harvest cursor/checkpoint mechanics;
- Gold Master archive mechanics;
- raw C2/C2.1 statistical methodology;
- container topology details;
- admin synchronization internals.

Those remain available in the deeper demo and architecture documents for technical follow-up.