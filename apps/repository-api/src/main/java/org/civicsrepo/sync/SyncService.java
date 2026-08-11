package org.civicsrepo.sync;

import java.util.ArrayList;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class SyncService {
    private static final Logger LOGGER = LoggerFactory.getLogger(SyncService.class);

    private final SyncJobStore syncJobStore;
    private final SyncActionRunner syncActionRunner;

    public SyncService(SyncJobStore syncJobStore, SyncActionRunner syncActionRunner) {
        this.syncJobStore = syncJobStore;
        this.syncActionRunner = syncActionRunner;
    }

    public SyncJob runSync(SyncRequest request) {
        OffsetDateTime startedAt = OffsetDateTime.now();
        String jobId = UUID.randomUUID().toString();
        List<SyncAction> plannedActions = planActions(request);
        syncJobStore.save(new SyncJob(
                jobId, request.mode(), request.source(), SyncStatus.RUNNING, startedAt, null, plannedActions));

        LOGGER.info(
                "Sync job {} started with mode {} for source {} and {} planned actions.",
                jobId,
                request.mode(),
                request.source(),
                plannedActions.size());

        try {
            syncActionRunner.run(request, plannedActions);
            SyncStatus status = request.mode() == SyncMode.APPLY ? SyncStatus.APPLIED : SyncStatus.DRY_RUN_COMPLETE;
            SyncJob completedJob =
                    new SyncJob(jobId, request.mode(), request.source(), status, startedAt, OffsetDateTime.now(), plannedActions);
            SyncJob savedJob = syncJobStore.save(completedJob);
            LOGGER.info("Sync job {} completed with status {}.", jobId, savedJob.status());
            return savedJob;
        } catch (RuntimeException exception) {
            List<SyncAction> failedActions = new ArrayList<>(plannedActions);
            failedActions.add(new SyncAction("SYNC_FAILED", request.source().name(), failureDetail(exception)));
            SyncJob failedJob = new SyncJob(
                    jobId,
                    request.mode(),
                    request.source(),
                    SyncStatus.FAILED,
                    startedAt,
                    OffsetDateTime.now(),
                    failedActions);
            SyncJob savedJob = syncJobStore.save(failedJob);
            LOGGER.warn("Sync job {} failed with status {}.", jobId, savedJob.status(), exception);
            return savedJob;
        }
    }

    public Optional<SyncJob> findJob(String id) {
        return syncJobStore.findById(id);
    }

    public List<SyncJob> findRecentJobs() {
        return syncJobStore.findRecent(25);
    }

    private List<SyncAction> planActions(SyncRequest request) {
        return List.of(
                new SyncAction("UPSERT_COMMUNITY", "Census Public Research Data", "Ensure root DSpace community exists."),
                new SyncAction("UPSERT_COLLECTION", request.source().name(), "Ensure collection exists for selected source."),
                new SyncAction("UPSERT_ITEM", firstSliceItemTitle(request.source()), "Ensure visual North Dakota demo item exists."),
                new SyncAction("UPSERT_MAP_LAYER", "North Dakota map preview", "Ensure map layer metadata exists."),
                new SyncAction("VERIFY_INDEX", "Solr discovery", "Confirm item is available for discovery indexing."));
    }

    private String firstSliceItemTitle(SyncSource source) {
        return switch (source) {
            case TIGER_LINE -> "2025 TIGER/Line - Census Tracts - North Dakota";
            case LODES -> "2023 LODES - North Dakota Workplace Area Characteristics";
            case ACS_PUMS -> "2024 ACS 1-Year PUMS - North Dakota";
            case SIPP -> "SIPP Public Use Data";
            case CPS -> "Current Population Survey Public Use Data";
            case USGS_EARTHQUAKES -> "USGS Earthquake Overlay";
        };
    }

    private String failureDetail(RuntimeException exception) {
        String message = exception.getMessage();
        if (message == null || message.isBlank()) {
            return exception.getClass().getSimpleName();
        }
        return message;
    }
}
