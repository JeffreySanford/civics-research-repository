# Known Tradeoffs and Architecture Decisions

Honest answers for interview Q&A. Each item states what we chose, why, and what we deferred.

## DSpace as system of record vs Solr projection

**Decision:** DSpace holds communities, collections, items, metadata, and file manifests. The discovery Solr core is a **projection** rebuilt from DSpace on demand.

**Why:** Solr excels at keyword search and facets; it is a poor warehouse for raw microdata or authoritative versioning. Keeping one writer (`DiscoveryProjectionService`) makes "what is searchable" auditable. Reindex after sync or restore is mandatory operations, not optional maintenance.

**Tradeoff:** Search lags DSpace by one reindex unless startup sync and reindex run automatically—which the demo stack does.

**Deferred:** Real-time incremental Solr updates per DSpace event; acceptable for a reference demo, not for high-velocity ingestion at scale.

## Seed breadth vs sync adapters

**Decision:** `catalog.json` seeds **181 items across 15 programs and 52 geographies**, of which 177 are datasets and 4 are the publications, methodology report, and project of one research package. Startup sync adapters currently cover **live metadata reconciliation for the first visual slice** (TIGER/Line North Dakota) plus publisher file facts (size, last-modified) where implemented.

**Why:** Breadth proves paging, facets, and related research at realistic scale without implementing fourteen full harvest pipelines on day one. Sync adapters are added per source where drift matters most.

**Tradeoff:** Most seeded items are catalog-stable until a human or `catalog:harvest` updates vintages; only the TIGER adapter runs on every startup apply path in the demo.

**Deferred:** SIPP, CPS, LODES, and USGS-specific sync adapters listed in PI 2 backlog.

## Fixture fallback for development

**Decision:** When DSpace is empty or unreachable, the API indexes and serves a **generated fixture catalog** labelled `resultSource: FIXTURE` / `source: FIXTURE`.

**Why:** Frontend development, CI, and disaster demos should not hard-fail when DSpace is stopped. The UI must disclose fallback data so it is never presented as repository truth.

**Tradeoff:** Tests and storyboards must cover repository-backed and fallback paths separately.

**Deferred:** None—the disclosure requirement is implemented. Manual accessibility evidence still needs recording against the repository-backed path.

## Budgeted bitstream mirroring

**Decision:** Source files with a measurable size are eligible for the DSpace assetstore under a **5 GiB total mirror budget with no independent per-file cap**. Large legitimate research artifacts are therefore not excluded simply because one file is hundreds of megabytes. Everything not mirrored remains represented by **source URLs and file manifests**. Nothing is mirrored into git.

The currently committed mirror snapshot still reflects the earlier 1 GiB / 120 MiB-cap run: 76 files totaling 1.00 GiB. The next mirror/seed run will refresh that snapshot under the new policy.

**Why:** A repository that holds no bytes has no preservation story, no checksums, and no downloads. An arbitrary per-file ceiling also weakens the story by excluding exactly the kind of large geospatial or scientific artifact DSpace is meant to preserve. The total budget is the operational safeguard: it bounds local Docker storage while allowing any individual measured file that fits inside the remaining run budget.

**Safety boundary:** Files without a positive `Content-Length` are not mirrored automatically. For selected files, the downloader verifies the streamed byte count against the publisher's declared length and deletes partial output on a mismatch, so a misreporting endpoint cannot silently overrun the configured budget.

**Tradeoff:** The mirrored set is still a bounded preservation copy, not a wholesale warehouse. Which files it contains depends on the total budget and measurable source inventory at the time it ran, recorded in `tools/dspace/mirror-manifest.json`.

**Why the manifest survives mirroring:** The manifest describes the authoritative publisher source, which stays true whether or not a local copy exists. A mirrored file is a preservation copy, not a new system of record.

## Java API vs separate harvester

**Decision:** **Sync orchestration lives in `repository-api`**. Node scripts handle catalog expansion, SAF generation, URL verification, and catalog harvest reporting. No standalone harvester microservice.

**Why:** Sync state, admin endpoints, DSpace credentials, and apply logic belong next to the integration that writes DSpace. Scripts remain repeatable for CI and data stewards without duplicating Java business rules for SAF generation.

**Tradeoff:** Two runtimes (Java + Node) participate in ingestion; boundaries are documented in [ingestion-walkthrough.md](ingestion-walkthrough.md).

**Deferred:** Extracting a long-running harvest worker if batch catalog discovery outgrows script execution time—likely unnecessary until federation sources (NOAA, NASA POWER) arrive.

## Catalog curation vs automated harvest

**Decision:** `catalog.json` remains the committed breadth table. `harvest-catalog.mjs` verifies URLs, suggests newer vintages, and can bump program vintages after publisher probes succeed.

**Why:** Federal file naming is mostly stable but vintages advance yearly. Full auto-discovery of every Census product is out of scope; extensible discoverers per program are in scope.

**Tradeoff:** Stewards still review harvest reports before `--write`; `verify:sources` gates data changes.

**Deferred:** Discovering every possible dataset from Census and USGS APIs; cross-agency federation metadata model extensions.

## Admin API authentication

**Decision:** Sync and reindex endpoints are **unauthenticated** in the local demo.

**Why:** The reference implementation targets local Docker and interview demos, not production exposure. Documented in planning/DECISIONS.md.

**Tradeoff:** Any cloud deployment must add authn/authz before exposing admin routes.

**Deferred:** OAuth2 or mutual-TLS for admin operations in AWS modernization target.

## OpenAPI contract and generated DTOs

**Decision:** OpenAPI is the contract source of truth; Java model DTOs and TypeScript types are generated on every build. Typed error responses (`code`, `message`, `details`, `traceId`) apply to 400, 404, 500, and 503 on public and admin routes.

**Why:** Prevents frontend/backend drift and gives the Angular client predictable failure handling.

**Tradeoff:** Generated Spring controller interfaces remain deferred until OpenAPI Generator supports Spring 7 conventions.

## What the demo deliberately omits

- Terraform/CDK for the documented AWS target.
- Full manual NVDA/JAWS/map-equivalence evidence runs.
- Unbounded wholesale mirroring of every publisher endpoint into DSpace.
- Real-time multi-tenant stewardship workflows.

See [aws-modernization.md](../aws-modernization.md) for the credible cloud path and [planning/TODO.md](../../planning/TODO.md) for the active backlog.
