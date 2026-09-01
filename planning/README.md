# Planning

This directory contains future decisions, risks and executable work. Delivered history lives in [documentation/history/platform-evolution.md](../documentation/history/platform-evolution.md), current generated repository facts live in [documentation/platform-status.md](../documentation/platform-status.md), and the durable million-record research milestone is summarized in [documentation/federation/scale-evidence.md](../documentation/federation/scale-evidence.md).

## Planning documents

- [ROADMAP.md](ROADMAP.md): future outcomes and sequencing only.
- [TODO.md](TODO.md): open tasks only.
- [PI_PLAN.md](PI_PLAN.md): program-increment framing and execution boundaries.
- [DECISIONS.md](DECISIONS.md): accepted and pending architectural decisions.
- [RISKS.md](RISKS.md): active and closed delivery risks.
- [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md): reference/demo acceptance criteria.

Historical scale notes such as [PI1_DATA_GOV_SCALE_EVIDENCE.md](PI1_DATA_GOV_SCALE_EVIDENCE.md) remain useful evidence of how the staged path evolved, but they are not the current project-status source.

## Current planning position

PI-1 has crossed its original scale milestone:

- deterministic federated retention and bounded harvesting are implemented;
- Data.gov and DOE OSTI participate in an exact composite corpus;
- the C2 recipe retains 500,000 Data.gov + 500,000 DOE OSTI records;
- application PostgreSQL retains exactly 1,000,000 federated records;
- Solr and OpenSearch each hold the same 1,000,181-document normalized projection including 181 curated DSpace records;
- composition and projection identities are durable evidence;
- a verified host-backed Gold Master archive can restore the exact retained corpus;
- active projection identity survives ordinary API restart without reindexing;
- Admin and Discovery expose the corpus/profile identity instead of hiding scale state.

The architecture itself is settled. New work should strengthen reproducibility, semantic comparison, deployment and evidence rather than reopen DSpace ownership, federated-retention ownership, or the rebuildable-search boundary.

## Current priorities

1. **Make scale validation reusable.** Add a named live `quality:scale` / `scale:evidence:check` command that verifies retained counts, exact composition, projection linkage, active identity, Solr/OpenSearch parity, storage evidence and public-search provenance without mutating the corpus.
2. **Deepen search evidence.** Version a stable large-corpus query matrix and record result-set overlap, top-N/rank movement, facet differences and latency distributions tied to projection identity.
3. **Finish scale-sensitive platform hardening.** Add projection progress/throughput/resource context, opaque cursor/search-after pagination, explicit durable-identifier reconciliation rules and configurable per-source rate/concurrency policy.
4. **Extend federation deliberately.** Preserve the evidence-first bounded-harvest model while adding NASA CMR, PubMed and OpenAlex rather than repeating an unbounded million-record exercise for its own sake.
5. **Complete manual accessibility evidence and governance.** Record keyboard/NVDA/JAWS-or-N/A/map/cognitive evidence and decide required browser checks plus `main` branch protection.
6. **Move to clustered and cloud topology only after the Compose control baseline is reusable.** PI-2 kind/SolrCloud/OpenSearch clustering should consume the exact PI-1 corpus/query definitions; PI-3 AWS IaC should consume PI-2 topology evidence.

## Working rule

The repository follows an evidence-first rule for new work: define or extend unit/use-case/contract/browser/accessibility and real-stack evidence before broadening the feature surface. A local screen or one successful run is a development milestone, not completion.
