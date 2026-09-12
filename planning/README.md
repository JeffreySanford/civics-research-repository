# Planning

This directory contains future decisions, risks and executable work. Delivered history lives in [documentation/history/platform-evolution.md](../documentation/history/platform-evolution.md), current generated repository facts live in [documentation/platform-status.md](../documentation/platform-status.md), and durable C2/C2.1 research evidence lives in the federation/evidence documentation.

## Planning documents

- [ROADMAP.md](ROADMAP.md): future outcomes and sequencing only.
- [TODO.md](TODO.md): open tasks only.
- [PI_PLAN.md](PI_PLAN.md): current program-increment framing and execution boundaries.
- [DECISIONS.md](DECISIONS.md): accepted and pending architectural decisions.
- [RISKS.md](RISKS.md): active and closed delivery risks, including temporary dependency overrides/no-fix advisories.
- [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md): reference/demo acceptance criteria.

Historical scale notes such as [PI1_DATA_GOV_SCALE_EVIDENCE.md](PI1_DATA_GOV_SCALE_EVIDENCE.md) remain useful evidence of how the staged path evolved, but they are not the current project-status source.

## Current planning position

The repository has moved beyond its original scale/search completion path:

- PI-1 standalone federated scale baseline is complete;
- C2 adversarial follow-up C2.1 is complete (#47);
- frontend mission/portfolio alignment is complete (#51);
- a second mobile-first Angular frontend is implemented beside `discovery-ui`;
- both frontends share server-owned rank, relevance and result-explainability presentation through `shared-ui` (#97 / PR #103);
- mobile search/filter/pagination, research detail/context navigation and responsive accessibility automation are implemented;
- the mobile search design lifecycle is documented from wireframe through Storybook/implementation/automated evidence (#98 / PR #104);
- the September security cleanup is merged and the actionable Dependabot alert set is empty;
- issue #49 manual accessibility evidence is closed **not planned** and is not a completion gate.

The architecture itself remains settled: DSpace owns curated repository records, external publishers own federated source truth, application PostgreSQL retains reproducible federated state/evidence, search engines are derived projections, and Angular consumes the typed Spring/OpenAPI boundary.

## Current priorities

1. **#99 — read-only repository steward/status workflow (current).** Compose existing corpus/profile, DSpace, source-inventory, synchronization, Solr/OpenSearch parity and automated-evidence contracts into one focused status route without exposing privileged mutation.
2. **Keep planning and generated status accurate.** New delivered work should move into history/current-status documentation rather than remaining indefinitely in planning files.
3. **Preserve evidence boundaries.** Automated accessibility evidence remains valuable but must not be represented as completed manual AT/Section 508 certification.
4. **Promote optional map/federation/cloud work only for a concrete research or deployment question.** Do not add technology solely for breadth.

## Working rule

The repository follows an evidence-first rule for new work: define or extend unit/use-case/contract/browser/accessibility and real-stack evidence before broadening the feature surface. A local screen or one successful run is a development milestone, not completion.
