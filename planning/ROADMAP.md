# Roadmap

This roadmap contains future work only. Delivered phases and major architectural decisions are summarized in [documentation/history/platform-evolution.md](../documentation/history/platform-evolution.md). Current verified facts live in the generated [documentation/platform-status.md](../documentation/platform-status.md). The executable checklist is [TODO.md](TODO.md).

## 1. Complete manual accessibility evidence

The highest-priority gap is evidence quality, not UI breadth.

- Run the full keyboard-only checklist without a mouse.
- Record NVDA evidence with Firefox and Chrome.
- Record JAWS evidence where a license is available, or record an explicit N/A reason.
- Complete the trusted map-click to accessible-list focus check and the rest of the map-equivalence review.
- Record the cognitive/workflow review.
- Decide whether a `contentinfo` landmark improves the application shell.

Completion means dated, commit-bound artifacts exist under `documentation/accessibility-evidence/`; it does not mean changing a manually unverified status to pass.

## 2. Make browser evidence enforceable

The repository has a substantial browser evidence suite, but the normal CI workflow does not yet enforce the complete matrix.

- Add a dedicated accessibility/browser workflow or a scheduled full-matrix run.
- Persist Playwright traces and reports on failure.
- Decide which evidence jobs must block merges.
- Decide whether `main` receives branch protection and required checks.
- Keep the local `evidence:refresh` behavior: a failed run must never replace the prior known-good evidence.

## 3. Build the Solr/OpenSearch comparison demo

OpenSearch should be a first-class local demo service, but it should not change the repository ownership model.

- Keep OpenSearch in the default `start:all` Docker stack with persistent storage.
- Index the same normalized DSpace research object projection into Solr and OpenSearch.
- Add OpenAPI-first comparison endpoints with generated Angular types.
- Build a Discovery comparison view with `Run Solr`, `Run OpenSearch`, `Run Both`, timing, scope, highlights and technical details.
- Start with faceting/aggregations, weighted full-text relevance, phrase search, filtering, highlighting, and simple elapsed timing.
- Add geo search, autocomplete/suggest, synonyms, nested/object search and vector/hybrid comparison only after the basic side-by-side path is stable.
- Cover the comparison view with storyboard, WCAG and Section 508 checks.

Completion means the demo can explain observable differences between the two search mechanisms using the same source data, not that local Docker timings are presented as production benchmarks.

## 4. Harden provenance and repository identity

Repository identity is recorded for publisher-backed objects; the next step is a more explicit chain from publisher state through DSpace and discovery.

- Record source freshness per research object.
- Record projection/index timestamps and make them visible where useful.
- Distinguish live aggregation, stored sample, fixture fallback, stale response, and unavailable source with a typed provenance model.
- Review route handling so UUID-backed and source-identifier-backed research links remain stable.
- Add regression tests for fallback provenance, especially LODES-derived map data.

## 5. Finish research-object language

The domain model is research-object-shaped, but several routes and labels retain dataset-era wording.

- Add `/research/:id` as an alias while preserving `/datasets/:id` compatibility.
- Replace remaining labels such as “Loading dataset detail,” “Dataset supporting information,” and “Open related dataset.”
- Update API/documentation examples to use “research object” where the type is not necessarily a dataset.
- Keep type-specific language where it improves clarity: dataset files, publication authors, methodology, project, restricted microdata.

## 6. Expand publisher verification and optional federation

The catalog should remain curated, but its claims should be increasingly verifiable.

- Add publisher listing/vintage checks for programs that do not yet have them.
- Keep vintage changes reviewable; do not automatically rewrite file templates into plausible 404s.
- Evaluate NOAA Climate Data Online and NASA POWER as federation examples after the Census/USGS path remains stable.
- Preserve the distinction between publisher-discovered facts and repository-curated relationships.

## 7. Implement the documented cloud target

The AWS architecture is documented but not provisioned.

- Choose Terraform or CDK.
- Implement a minimal environment matching the documented EKS recommendation or the ECS/Fargate alternate.
- Include RDS, persistent search storage, frontend delivery, secrets, logs, metrics, backup and restore.
- Document local-to-cloud migration and operational cost boundaries.

## 8. Platform and test hardening

- Move NgRx to stable 22 when available and validated.
- Revisit generated Spring controller interfaces when tooling supports Spring 7 conventions.
- Add Testcontainers coverage for `JdbcSyncJobStore` and repository integration seams.
- Replace generic API failures with typed error responses where the contract is still vague.
- Review Nx upgrade warnings and dependency alignment without changing architectural patterns merely for novelty.
- Revisit the mirror budget when storage permits, while keeping preservation totals measured and dated.

## Non-goals

The roadmap does not include:

- replacing DSpace with the public discovery index,
- sharing DSpace's internal Solr as the application's public search API,
- adding a separate Node harvester runtime,
- replacing NgRx solely to reduce line count,
- turning the repository into a municipal dashboard at the expense of its federal Open Science model,
- claiming complete Section 508 conformance from automated scans.
