package org.civicsrepo.sync;

import java.util.List;
import java.util.Optional;

public interface SyncJobStore {
    SyncJob save(SyncJob job);

    Optional<SyncJob> findById(String id);

    List<SyncJob> findRecent(int limit);
}
