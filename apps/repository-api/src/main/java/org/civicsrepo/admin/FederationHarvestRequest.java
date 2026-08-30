package org.civicsrepo.admin;

import org.civicsrepo.federation.FederatedSourceSystem;

/** Operator-supplied bound for one synchronous federated harvest invocation. */
public record FederationHarvestRequest(
        FederatedSourceSystem sourceSystem,
        int pageSize,
        int maxPages) {}
