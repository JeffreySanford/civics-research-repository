package org.civicsrepo.federation;

import java.util.Optional;

/** Persistence boundary for resumable source harvesting. */
public interface HarvestCheckpointStore {
    Optional<HarvestCheckpoint> find(FederatedSourceSystem sourceSystem);

    void save(HarvestCheckpoint checkpoint);

    void clear(FederatedSourceSystem sourceSystem);
}
