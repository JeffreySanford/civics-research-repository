package org.civicsrepo.sync;

import org.civicsrepo.generated.dto.SyncJob;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SyncJobStore {
    SyncJob save(SyncJob job);

    Optional<SyncJob> findById(UUID id);

    List<SyncJob> findRecent(int limit);
}
