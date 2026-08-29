# Documentation

Civics Research Repository is documented as a federal Open Science reference platform rather than as a collection of disconnected technology demonstrations.

## Start here

- [Current Platform Status](platform-status.md): generated counts, evidence date, source inventory, preservation snapshot, adapter coverage and open governance/deployment boundaries.
- [Architecture](architecture.md): current system model, datastore ownership, synchronization, discovery, mapping, preservation and accessibility evidence.
- [Architecture Diagrams](architecture-diagrams.md): current C4 and sequence diagrams.
- [Demo Package](demo/README.md): audience-specific walkthroughs and tradeoffs.

## Product and domain

- [Open Science Research Objects](open-science-research-objects.md): datasets, publications, methodology, projects, access restrictions, researchers, DOI metadata and typed relationships.
- [Data Sources](data-sources.md): Census/USGS source assumptions and publisher verification.
- [Data Storage and Sync](data-storage-sync.md): storage boundaries, reconciliation and bounded mirroring.
- [Mapping Visualization](mapping-visualization.md): geospatial research views, LODES/TIGER/SAIPE/USGS layers and equivalent nonvisual workflows.
- [Solr and OpenSearch Comparison Demo](search-comparison-demo.md): side-by-side search scenarios, API shape, indexing parity and measurement boundaries.
- [Search Performance Evidence](search-performance-evidence.md): warm-up/repeated-run protocol, API-versus-engine timing boundaries and interpretation guardrails.
- [USGS National Map Evaluation](usgs-national-map-evaluation.md): reference-layer options and tradeoffs.

## Accessibility

- [Section 508 and WCAG Evidence](accessibility-508-wcag.md): implemented automated evidence, browser boundaries, evidence lifecycle and honest claim language.
- [Manual Accessibility Evidence](accessibility-manual-evidence.md): keyboard, NVDA, JAWS, map-equivalence and cognitive checklists.
- [Evidence Artifacts](accessibility-evidence/README.md): recorded automated and manual evidence structure.

## Platform and deployment

- [Docker, DSpace, Solr, OpenSearch and PostgreSQL](docker-dspace-solr-postgres.md): local service responsibilities.
- [AWS Modernization](aws-modernization.md): recommended target, alternate, persistence, observability, backup and migration direction.
- [Backend Java API](backend-java-api.md): Spring Boot and OpenAPI implementation direction.
- [Nx/Angular/WCAG](nx-angular-wcag.md): frontend workspace and testing conventions.

## Planning and history

- [Future Roadmap](../planning/ROADMAP.md): future work only.
- [Active Backlog](../planning/TODO.md): open executable tasks only.
- [Decisions](../planning/DECISIONS.md)
- [Risks](../planning/RISKS.md)
- [Platform Evolution](history/platform-evolution.md): delivered phases and historical context removed from the active roadmap.

## Documentation rules

1. Narrative architecture documents describe what runs now.
2. Planned work belongs in the roadmap/TODO, not in diagrams labelled current.
3. Delivered history belongs under `documentation/history/`.
4. Volatile counts and evidence dates come from `platform-status.md`, generated with:

   ```bash
   pnpm run docs:status
   pnpm run docs:check
   ```

5. Accessibility automation is described as WCAG and Section 508-oriented evidence, never as certification.
