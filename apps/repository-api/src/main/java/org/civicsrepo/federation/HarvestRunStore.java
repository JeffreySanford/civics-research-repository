package org.civicsrepo.federation;

import java.util.List;
import java.util.Optional;

/** Durable run ledger for resumable federated harvesting. */
public interface HarvestRunStore {
    void save(HarvestRun run);

    Optional<HarvestRun> findById(String id);

    Optional<HarvestRun> findResumable(FederatedSourceSystem sourceSystem);

    List<HarvestRun> findRecent(FederatedSourceSystem sourceSystem, int limit);
}
