package org.civicsrepo.sync;

import java.time.OffsetDateTime;
import java.util.List;

public record SyncJob(
        String id,
        SyncMode mode,
        SyncSource source,
        SyncStatus status,
        OffsetDateTime startedAt,
        OffsetDateTime completedAt,
        List<SyncAction> actions) {}
