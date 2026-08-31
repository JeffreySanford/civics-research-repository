# Five-Source Federation Sample Evidence

## Status

**PASS — representative source sampling complete**

Captured from the local research stack on 2026-08-31 after rebuilding the repository API with the current federation adapters.

This evidence closes Phase 0 of the federation scale research plan. It demonstrates that every modeled live authority can contribute at least one normalized metadata record to the retained federated catalog without activating a mixed-source search projection.

## Retained source representation

| Source             | Final retained records | Sampling result          | Adapter evidence                  |
| ------------------ | ---------------------: | ------------------------ | --------------------------------- |
| Data.gov           |                100,000 | Existing proven baseline | existing retained corpus          |
| DOE OSTI.GOV       |                     25 | Existing live sample     | retained from bounded live sample |
| NASA Earthdata CMR |                     25 | Fresh live sample        | `nasa-cmr-collections-v3`         |
| PubMed             |                     25 | Existing live sample     | retained from bounded live sample |
| OpenAlex           |                     25 | Existing live sample     | retained from bounded live sample |

NASA CMR's final bounded sample retained **25 / 25** normalized collection records with **0 rejected records**. The successful NASA run ID was:

`3fe3b587-22fd-43e9-af0b-1c171d8fa9c4`

## Sampling protocol

The all-source sampler applies these research rules:

- existing retained authorities are observed but not advanced,
- an empty authority is sampled from source offset zero using one bounded page,
- HTTP success alone is insufficient; an empty authority must retain at least one normalized record before it counts as represented,
- rejected/skipped records remain visible in sample evidence,
- publisher binaries are not mirrored,
- failures or empty results do not prevent attempts against the remaining authorities,
- no mixed-source Solr/OpenSearch projection is activated automatically.

This last boundary is deliberate: the established 100K Data.gov benchmark remains an independent evidence-grade projection until a named composite corpus profile and deterministic multi-source manifest are implemented.

## Runtime observations

The final sample was executed after the stack rebuild path had been hardened so application rebuilds keep healthy DSpace and datastore containers warm rather than force-recreating them.

The rebuilt stack verified the default `CURATED_DEMO` profile at **181 searchable repository objects** before federation sampling. Retained federated metadata remained independent of the startup projection.

## Interpretation

This evidence establishes **source representation**, not scale readiness.

It proves that the five current live adapters can normalize representative public metadata into the shared retained catalog:

1. Data.gov datasets,
2. DOE OSTI research outputs,
3. NASA CMR Earth-science collections,
4. PubMed bibliographic citations,
5. OpenAlex scholarly works.

It does **not** yet establish a reproducible 1M/10M/100M mixed-source corpus. Those tiers require a composite corpus manifest that records explicit per-source quotas, source run/snapshot identities, normalization adapter versions, normalized-record digests, and a composition digest before search projection.

## Next research phase

The next phase should begin from the merged baseline and implement composite corpus evidence before increasing multi-source scale:

1. define the immutable multi-source composition/manifest model,
2. capture per-source snapshot/run identities and quotas,
3. derive a deterministic composition digest,
4. expose composite evidence through the admin/OpenAPI boundary,
5. implement the first evidence-grade mixed-source `FEDERATED_1M` recipe,
6. preserve the established 100K benchmark as the single-source baseline,
7. use bulk/snapshot transports where appropriate before attempting 10M and 100M tiers.
