package org.civicsrepo.federation;

import java.util.List;
import java.util.Optional;

/** Durable history for controlled bounded corpus checkpoints. */
public interface FederatedBoundedSnapshotManifestStore {
    void save(FederatedBoundedSnapshotManifest manifest);

    Optional<FederatedBoundedSnapshotManifest> findBySnapshotId(String snapshotId);

    List<FederatedBoundedSnapshotManifest> findRecent(FederatedSourceSystem sourceSystem, int limit);
}
