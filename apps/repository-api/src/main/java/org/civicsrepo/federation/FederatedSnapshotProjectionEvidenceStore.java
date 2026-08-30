package org.civicsrepo.federation;

import java.util.List;

/** Durable history linking bounded source snapshots to combined discovery projections. */
public interface FederatedSnapshotProjectionEvidenceStore {
    void save(FederatedSnapshotProjectionEvidence evidence);

    List<FederatedSnapshotProjectionEvidence> findRecent(FederatedSourceSystem sourceSystem, int limit);
}
