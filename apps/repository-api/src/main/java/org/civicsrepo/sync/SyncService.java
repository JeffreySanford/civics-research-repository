package org.civicsrepo.sync;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

@Service
public class SyncService {
    private final Map<String, SyncJob> jobs = new ConcurrentHashMap<>();

    public SyncJob runSync(SyncRequest request) {
        OffsetDateTime startedAt = OffsetDateTime.now();
        List<SyncAction> plannedActions = List.of(
                new SyncAction("UPSERT_COMMUNITY", "Census Public Research Data", "Ensure root DSpace community exists."),
                new SyncAction("UPSERT_COLLECTION", request.source().name(), "Ensure collection exists for selected source."),
                new SyncAction("UPSERT_ITEM", firstSliceItemTitle(request.source()), "Ensure visual North Dakota demo item exists."),
                new SyncAction("UPSERT_MAP_LAYER", "North Dakota map preview", "Ensure map layer metadata exists."),
                new SyncAction("VERIFY_INDEX", "Solr discovery", "Confirm item is available for discovery indexing."));

        SyncStatus status = request.mode() == SyncMode.APPLY ? SyncStatus.APPLIED : SyncStatus.DRY_RUN_COMPLETE;
        SyncJob job = new SyncJob(
                UUID.randomUUID().toString(),
                request.mode(),
                request.source(),
                status,
                startedAt,
                OffsetDateTime.now(),
                plannedActions);
        jobs.put(job.id(), job);
        return job;
    }

    public Optional<SyncJob> findJob(String id) {
        return Optional.ofNullable(jobs.get(id));
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
}
