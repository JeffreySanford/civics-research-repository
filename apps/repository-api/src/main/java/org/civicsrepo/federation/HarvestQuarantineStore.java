package org.civicsrepo.federation;

import java.time.OffsetDateTime;
import java.util.List;

/** Bounded durable storage for record-level normalization rejects. */
public interface HarvestQuarantineStore {
    void saveAll(
            String runId,
            FederatedSourceSystem sourceSystem,
            List<HarvestRejection> rejections,
            OffsetDateTime observedAt);

    List<HarvestQuarantineRecord> findRecent(FederatedSourceSystem sourceSystem, int limit);
}
