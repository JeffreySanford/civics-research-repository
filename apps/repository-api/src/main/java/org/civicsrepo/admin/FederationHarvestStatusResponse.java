package org.civicsrepo.admin;

import org.civicsrepo.federation.FederatedSourceSystem;

/** Read-only preflight view of one federated source's retained corpus and durable harvest ledger. */
public record FederationHarvestStatusResponse(
        FederatedSourceSystem sourceSystem,
        long retainedRecordCount,
        FederationHarvestResponse resumableRun,
        FederationHarvestResponse latestRun) {}
