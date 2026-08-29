package org.civicsrepo.federation;

import java.time.OffsetDateTime;
import java.util.Objects;

/** Resumable position for one source harvester. */
public record HarvestCheckpoint(
        FederatedSourceSystem sourceSystem,
        String cursor,
        long acceptedCount,
        OffsetDateTime updatedAt) {

    public HarvestCheckpoint {
        Objects.requireNonNull(sourceSystem, "sourceSystem");
        if (acceptedCount < 0) {
            throw new IllegalArgumentException("acceptedCount must be non-negative");
        }
        Objects.requireNonNull(updatedAt, "updatedAt");
    }

    public static HarvestCheckpoint initial(FederatedSourceSystem sourceSystem) {
        return new HarvestCheckpoint(sourceSystem, null, 0, OffsetDateTime.now());
    }
}
