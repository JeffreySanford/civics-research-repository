# Planning

This directory contains future decisions, risks and executable work. Delivered history has moved to [documentation/history/platform-evolution.md](../documentation/history/platform-evolution.md), and current volatile facts are generated in [documentation/platform-status.md](../documentation/platform-status.md).

## Planning documents

- [ROADMAP.md](ROADMAP.md): future outcomes and sequencing only.
- [TODO.md](TODO.md): open tasks only.
- [DECISIONS.md](DECISIONS.md): accepted and pending architectural decisions.
- [RISKS.md](RISKS.md): active and closed delivery risks.
- [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md): reference/demo acceptance criteria.

## Current planning priorities

1. Record manual keyboard, NVDA, JAWS, map-equivalence and cognitive evidence.
2. Add a dedicated browser-evidence CI workflow and decide merge/branch-protection policy.
3. Harden source, sample/fallback and projection provenance.
4. Finish research-object route and language cleanup.
5. Expand publisher verification and optional federation carefully.
6. Implement the documented AWS target as infrastructure-as-code.
7. Continue dependency, contract and integration-test hardening.

The architecture itself is delivered and documented. New work should close evidence, provenance, deployment and product-language seams rather than reopen settled boundaries such as DSpace ownership, the rebuildable discovery projection, or Java-owned integration orchestration.
