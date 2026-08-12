package org.civicsrepo.sync;

import java.util.ArrayList;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.civicsrepo.dspace.DspaceItemDiffPlanner;
import org.civicsrepo.dspace.DspaceItemPayload;
import org.civicsrepo.dspace.DspaceItemPayloadMapper;
import org.civicsrepo.sources.PublicDatasetFile;
import org.civicsrepo.sources.PublicDatasetMetadata;
import org.civicsrepo.sources.PublicMetadataAdapter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class SyncService {
    private static final Logger LOGGER = LoggerFactory.getLogger(SyncService.class);

    /**
     * The repository structure the DSpace seed actually creates.
     *
     * <p>These must match tools/dspace/seed-structure.xml. Sync previously reported the collection
     * as the program enum name ("TIGER_LINE"), which names a collection that does not exist and
     * would have been acted on once collection upsert is implemented.
     */
    private static final String COMMUNITY_NAME = "Census Public Research Data";

    private static final String COLLECTION_NAME = "TIGER/Line Geospatial Files";

    private final SyncJobStore syncJobStore;
    private final SyncActionRunner syncActionRunner;
    private final DspaceItemPayloadMapper dspaceItemPayloadMapper;
    private final DspaceItemDiffPlanner dspaceItemDiffPlanner;
    private final Map<SyncSource, PublicMetadataAdapter> metadataAdapters;

    public SyncService(
            SyncJobStore syncJobStore,
            SyncActionRunner syncActionRunner,
            DspaceItemPayloadMapper dspaceItemPayloadMapper,
            DspaceItemDiffPlanner dspaceItemDiffPlanner,
            List<PublicMetadataAdapter> metadataAdapters) {
        this.syncJobStore = syncJobStore;
        this.syncActionRunner = syncActionRunner;
        this.dspaceItemPayloadMapper = dspaceItemPayloadMapper;
        this.dspaceItemDiffPlanner = dspaceItemDiffPlanner;
        this.metadataAdapters =
                metadataAdapters.stream().collect(Collectors.toUnmodifiableMap(PublicMetadataAdapter::source, Function.identity()));
    }

    public SyncJob runSync(SyncRequest request) {
        OffsetDateTime startedAt = OffsetDateTime.now();
        String jobId = UUID.randomUUID().toString();
        // Planning belongs inside the failure handling. DIFF planning reads live DSpace state, so an
        // unreachable repository used to escape as an unhandled exception and surface to the admin
        // UI as a bare HTTP 500 instead of a failed job carrying the reason.
        List<SyncAction> plannedActions = List.of();

        try {
            plannedActions = planActions(request);
            syncJobStore.save(new SyncJob(
                    jobId, request.mode(), request.source(), SyncStatus.RUNNING, startedAt, null, plannedActions));

            LOGGER.info(
                    "Sync job {} started with mode {} for source {} and {} planned actions.",
                    jobId,
                    request.mode(),
                    request.source(),
                    plannedActions.size());

            syncActionRunner.run(request, plannedActions, sourcePayload(request));
            SyncStatus status = completedStatus(request.mode());
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
        PublicMetadataAdapter metadataAdapter = metadataAdapters.get(request.source());
        if (metadataAdapter == null) {
            return fallbackPlanActions(request);
        }

        PublicDatasetMetadata metadata = metadataAdapter.firstVisualSlice();
        DspaceItemPayload itemPayload = dspaceItemPayloadMapper.toItemPayload(metadata);
        if (request.mode() == SyncMode.DIFF) {
            return diffPlanActions(metadata, itemPayload);
        }

        return List.of(
                new SyncAction("UPSERT_COMMUNITY", COMMUNITY_NAME, "Ensure root DSpace community exists."),
                new SyncAction(
                        "UPSERT_COLLECTION",
                        COLLECTION_NAME,
                        "Ensure collection exists for " + metadata.program().getValue() + " "
                                + metadata.geographicLevel() + " metadata."),
                new SyncAction(
                        "UPSERT_ITEM",
                        itemPayload.name(),
                        "Prepare DSpace item payload with " + itemPayload.metadata().size() + " metadata fields and "
                                + itemPayload.bitstreams().size() + " file manifest entries."),
                new SyncAction(
                        "UPSERT_FILE_MANIFEST",
                        metadata.id(),
                        "Track " + metadata.files().size() + " source files: " + fileManifestSummary(metadata.files()) + "."),
                new SyncAction(
                        "UPSERT_CITATION",
                        metadata.id(),
                        "Store citation and documentation URL: " + metadata.documentationUrl() + "."),
                new SyncAction(
                        "UPSERT_MAP_LAYER",
                        metadata.geography() + " " + metadata.geographicLevel() + " map preview",
                        "Ensure map layer metadata exists for " + metadata.sourceUrl() + "."),
                new SyncAction("VERIFY_INDEX", "Solr discovery", "Confirm item is available for discovery indexing."));
    }

    private Optional<DspaceItemPayload> sourcePayload(SyncRequest request) {
        PublicMetadataAdapter metadataAdapter = metadataAdapters.get(request.source());
        if (metadataAdapter == null) {
            return Optional.empty();
        }
        return Optional.of(dspaceItemPayloadMapper.toItemPayload(metadataAdapter.firstVisualSlice()));
    }

    private SyncStatus completedStatus(SyncMode mode) {
        return switch (mode) {
            case APPLY -> SyncStatus.APPLIED;
            case DIFF -> SyncStatus.DIFF_COMPLETE;
            case DRY_RUN -> SyncStatus.DRY_RUN_COMPLETE;
        };
    }

    private List<SyncAction> diffPlanActions(PublicDatasetMetadata metadata, DspaceItemPayload itemPayload) {
        return List.of(
                new SyncAction(
                        "VERIFY_COMMUNITY",
                        COMMUNITY_NAME,
                        "Check whether the root DSpace community exists before comparing item state."),
                new SyncAction(
                        "VERIFY_COLLECTION",
                        COLLECTION_NAME,
                        "Check whether the " + COLLECTION_NAME + " collection exists before comparing item state."),
                dspaceItemDiffPlanner.planItemDiff(metadata.id(), itemPayload),
                new SyncAction("VERIFY_INDEX", "Solr discovery", "Check whether repository metadata is indexed after item state comparison."));
    }

    private List<SyncAction> fallbackPlanActions(SyncRequest request) {
        LOGGER.info("No metadata adapter exists yet for {}; using placeholder sync actions.", request.source());
        return List.of(
                new SyncAction("UPSERT_COMMUNITY", COMMUNITY_NAME, "Ensure root DSpace community exists."),
                new SyncAction("UPSERT_COLLECTION", COLLECTION_NAME, "Ensure collection exists for selected source."),
                new SyncAction("UPSERT_ITEM", firstSliceItemTitle(request.source()), "Ensure visual North Dakota demo item exists."),
                new SyncAction("UPSERT_MAP_LAYER", "North Dakota map preview", "Ensure map layer metadata exists."),
                new SyncAction("VERIFY_INDEX", "Solr discovery", "Confirm item is available for discovery indexing."));
    }

    private String fileManifestSummary(List<PublicDatasetFile> files) {
        return files.stream()
                .map((file) -> file.id() + "=" + file.format().name())
                .collect(Collectors.joining(", "));
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
