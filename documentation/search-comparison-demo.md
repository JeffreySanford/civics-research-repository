# Solr and OpenSearch Comparison Demo

## Purpose

The comparison demo should make the tradeoffs between Solr and OpenSearch visible without turning either engine into the repository source of truth. DSpace remains the system of record. The Java API owns projections into search engines, and the Angular discovery UI presents a typed, accessible comparison of query behavior, result scope, request shape, response timing, and facet or aggregation output.

OpenSearch is part of `pnpm run start:all` because the demo should work from the same local Docker baseline as the rest of the platform.

## User Experience

The main experience belongs in Discovery, not only in a modal. A dedicated Discovery comparison view or panel should show two result columns:

- Solr results and facets.
- OpenSearch results and aggregations.

Each scenario should support:

- `Run Solr`.
- `Run OpenSearch`.
- `Run Both`.
- A timing and scope summary.
- A collapsible technical details region with endpoint, request body or query params, normalized response count, engine-native count, and notes.

Use a Material dialog for scenario explanations and examples. The modal should explain what the scenario demonstrates and why the result can differ. It should not hide the primary side-by-side output.

## Initial Scenarios

The first implementation should focus on examples that can be explained honestly with the current repository catalog and public metadata.

1. Faceted search: Solr field facets compared with OpenSearch aggregations for program, geography, content type, and vintage year.
2. Full-text relevance: weighted title, summary, publisher, program, and geography fields.
3. Phrase search: exact dataset, citation, and program title matching.
4. Filtering at scale: program, geography, vintage year, publisher, content type, access level, and DOI presence.
5. Highlighting: matched snippets from title, summary, publisher, and citation fields.
6. Query timing and scope: elapsed time, total hits, returned hits, applied filters, and whether each engine used the same normalized document set.

These scenarios show performance and scope reach without requiring new geospatial indexing work first.

## Follow-on Scenarios

Add these after the first side-by-side path is stable:

- Geo search: bounding box, distance, intersects, and geography filters.
- Autocomplete and suggest: Solr suggesters compared with OpenSearch completion or search-as-you-type fields.
- Synonyms: tract, census tract, boundary, TIGER, workplace, jobs, employment.
- Nested or object search: file manifests, evidence records, authors, and relationship metadata.
- Hybrid and vector search: semantic discovery against titles, abstracts, methods, and citations.

## API Shape

The API should stay strongly typed and contract first.

- Add OpenAPI schemas before frontend implementation.
- Generate frontend types from OpenAPI.
- Return a normalized comparison response plus engine-native diagnostic blocks.
- Keep DTOs explicit: request scenario, engine selection, normalized query, filters, timing, hits, facets or aggregations, highlights, and warning notes.
- Keep backend implementation behind interfaces so Solr and OpenSearch clients can be tested independently.

Proposed endpoints:

- `GET /api/search/comparison/scenarios`
- `POST /api/search/comparison/run`
- `POST /api/admin/search-projections/reindex`
- `GET /api/admin/search-projections/status`

## Data and Indexing

Both engines should index the same normalized research object projection built from DSpace items. Any difference in result count should therefore be caused by query behavior, analyzer configuration, or engine capability, not by different source data.

The projection should include:

- identity: repository UUID and source identifier,
- title, summary, publisher, program, geography, vintage year,
- content type, access level, DOI and citation fields,
- source and documentation URLs,
- file manifest summary,
- spatial metadata when present,
- provenance and last projection timestamps.

OpenSearch persistence uses the `opensearch-data` Docker volume. The index remains disposable: deleting it should be recoverable through the projection rebuild command.

## Measurement

The first timing should be simple elapsed API time measured around the engine request, not a full benchmark. The UI should label it as local demo timing.

Good demo metrics:

- request elapsed milliseconds,
- total hits,
- returned hits,
- facet or aggregation bucket count,
- highlighted fields returned,
- applied filter count,
- index document count,
- last projection time.

Avoid presenting local Docker timings as production benchmarks.

## Accessibility

The comparison view needs the same evidence standard as the rest of Discovery.

- Keyboard access for engine selection, scenario selection, run buttons, result tabs or columns, and technical details.
- Announced loading and completion states.
- Tables or lists for result and facet differences.
- No color-only difference indicators.
- Storyboard and WCAG/Section 508 Playwright coverage once the UI exists.
