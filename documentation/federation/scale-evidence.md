# Federated Scale Evidence

This document records the durable research milestone established by PR #9 and hardened by PR #10. It is historical evidence, not a production-capacity guarantee and not a substitute for the generated curated-platform status.

## Exact C2 million-record corpus

The first controlled million-record federated corpus uses an exact source recipe:

| Source              | Retained records |
| ------------------- | ---------------: |
| Data.gov            |          500,000 |
| DOE OSTI            |          500,000 |
| **Federated total** |    **1,000,000** |

Curated DSpace objects are intentionally excluded from the federated composition digest and included later in the search projection.

- Corpus profile: `FEDERATED_1M`
- Composition SHA-256: `e2c7cceb641589715a6390cb35846a67d7361fb15ec00fe3445a3e0036a5524b`
- Retained federated records: **1,000,000**
- Curated DSpace contribution: **181**
- Search projection objects: **1,000,181**
- Projection ID: `3d461a9feb49f7239f3f6aaacb0c90f1ff43d0c683238acc2202c841154db44d`
- Solr indexed documents: **1,000,181**
- OpenSearch indexed documents: **1,000,181**

The composition identity answers **which federated source records were retained**. The projection identity answers **which normalized documents, including curated DSpace records, were projected into search**. These identities are deliberately separate.

## Local storage evidence

The exact C2 projection was measured on the Docker Compose research topology:

| Component                |    Measured bytes |
| ------------------------ | ----------------: |
| Application PostgreSQL   |     2,488,071,859 |
| DSpace stored data       |     1,073,739,747 |
| Solr index               |       805,116,078 |
| OpenSearch index         |       824,051,017 |
| **Measured local total** | **5,190,978,701** |

The two search engines are parallel derived projections for comparison research. A deployment that selected one engine would not normally pay both derived-index footprints, but production sizing still requires operational headroom, replicas, backups, observability and topology-specific measurement.

## Gold Master archive

The exact retained corpus was captured as a host-backed archive so the one-million-record evidence can be restored without repeating the full external harvest.

- Archive ID: `federated-1m-1788269110268-985ce2bd`
- Label: `C2 exact 500K Data.gov + 500K DOE OSTI Gold Master`
- Record count: **1,000,000**
- Compressed bytes: **260,700,364**
- Archive SHA-256: `8ba2cc755f255f108dbcb6eb1621e841925c02e0686487b97d498b780d7deb70`
- Integrity status: **VERIFIED**

Corpus archives live outside Git and are operator evidence, not repository source artifacts.

## Search comparison evidence

The paired million-document benchmark ran the same scenarios in both execution orders to reduce simple first-run/order bias. On this local single-node topology, Solr had lower API and native p50/p95 latency than OpenSearch for the tested full-text relevance, faceted-search and selective-filtering scenarios in both orders.

That result is intentionally scoped to the measured corpus, query definitions, mappings, hardware and standalone topology. It is research evidence, not a universal engine ranking.

The benchmark also identified OpenSearch aggregation-shape improvements while preserving total hits and facet buckets:

- unfiltered direct terms aggregation improved native p50 by about **29.6%** and p95 by about **29.7%**;
- selective shared-scope aggregation improved native p50 by about **24.0%** and p95 by about **23.1%**.

## Restart-safe projection identity

PR #10 closed the lifecycle defect discovered during the scale run. An ordinary `repository-api` restart no longer replaces a persisted large projection with the curated demo.

Startup now:

1. reads the persisted successful corpus activation;
2. verifies each enabled search target is reachable;
3. verifies live target document counts match the persisted projection count;
4. rehydrates the in-memory profile, projection ID, object count and target state;
5. performs no index replacement when the persisted state is valid.

The live restart proof retained:

- active profile `FEDERATED_1M`;
- retained federated count **1,000,000**;
- Solr count **1,000,181**;
- OpenSearch count **1,000,181**;
- the same projection ID `3d461a9feb49f7239f3f6aaacb0c90f1ff43d0c683238acc2202c841154db44d`;
- target parity `true`;
- scale evidence `valid: true` with no violations.

If target counts disagree with persisted activation evidence, startup fails fast and leaves the indexes untouched for explicit operator recovery.

## Exact activation invariant

`FEDERATED_1M` activation is not defined as merely “any one million retained rows.” The API requires the exact C2 recipe of 500,000 Data.gov plus 500,000 DOE OSTI records and projects the associated composite evidence. A 600,000 / 400,000 split is not equivalent and is rejected.

## Repeatable live certification

With the million-record stack already present, run:

```bash
pnpm quality:scale
```

`pnpm scale:evidence:check` is the explicit equivalent. The command is read-only with respect to retained corpus data, activation state, and search indexes. It writes JSON and Markdown evidence under `browser-evidence-artifacts/scale-evidence/` and exits non-zero when the live contract is not satisfied.

For `FEDERATED_1M`, the checker requires all of the following to agree at the same time:

- the research preflight is `READY_TO_MEASURE`;
- the exact source recipe is 500,000 Data.gov plus 500,000 DOE OSTI;
- retained federated metadata meets the one-million target;
- exact composition and composition-to-projection linkage are present;
- persisted activation profile, projection ID and object count match live runtime state;
- Solr/OpenSearch target parity is true;
- storage evidence points to the same projection and retained corpus;
- public `/search` exposes exactly 500,000 Data.gov and 500,000 DOE OSTI results with `FEDERATED` origin, matching `sourceSystem`, and authoritative source URLs.

The standard `quality:all` command intentionally does **not** invoke this live check. Million-record validation remains an explicit research/operator action rather than an ordinary pull-request prerequisite. `research:full` does invoke `quality:scale` before the ordinary repository quality suite and performance report.

## Architecture proven at scale

```text
DSpace curated authority
181 curated research objects
        +
Application PostgreSQL
1,000,000 retained federated metadata records
500K Data.gov + 500K DOE OSTI
        ↓ deterministic normalization/projection
Solr                         OpenSearch
1,000,181 docs               1,000,181 docs
        \                     /
         same projection identity
```

The million-record run validates the ownership model already used by the smaller demo: DSpace remains authoritative for curated repository objects, external publishers remain authoritative for federated source metadata and resources, application PostgreSQL retains reproducible federated metadata/evidence, and search engines remain rebuildable derived state.

## What remains after the C2 baseline

The C2 milestone is no longer waiting on a semantic matrix or deep pagination: those were delivered later by PRs #13-#14 and #16/#19 respectively. The remaining scale work is to reuse this certified corpus for new questions rather than repeat the same one-million-record proof:

- capture reusable projection throughput plus host/container/JVM CPU and memory context tied to corpus/projection identity;
- define durable DOI/PMID/other identifier reconciliation rules before bibliographic federation expands;
- run the deterministic Data.gov spatial-availability probe against the certified 500K Data.gov half of C2, then scope explicit spatial sidecar enrichment from the measured result;
- extend bounded/evidence-first federation to NASA CMR and later PubMed/OpenAlex without weakening provenance rules;
- carry the same stable corpus/query identities into the PI-2 clustered SolrCloud/OpenSearch topology comparison.
