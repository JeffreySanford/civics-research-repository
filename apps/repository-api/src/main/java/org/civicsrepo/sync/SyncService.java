package org.civicsrepo.sync;

import org.civicsrepo.generated.dto.SyncAction;
import org.civicsrepo.generated.dto.SyncJob;
import org.civicsrepo.generated.dto.SyncMode;
import org.civicsrepo.generated.dto.SyncRequest;
import org.civicsrepo.generated.dto.SyncSource;
import org.civicsrepo.generated.dto.SyncStatus;
import java.util.ArrayList;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.civicsrepo.dspace.DspaceItemDiffPlanner;
import org.civicsrepo.dspace.DspaceItemPayload;
import org.civicsrepo.dspace.DspaceItemPayloadMapper;
import org.civicsrepo.sources.ResearchObjectFile;
import org.civicsrepo.sources.ResearchObjectMetadata;
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

    /**
     * Sources that have a metadata adapter, in a stable order.
     *
     * <p>Derived from the registered adapters rather than from the {@code SyncSource} enum: the enum
     * names every source the contract knows about, and several of those have no adapter yet.
     * Iterating the enum would plan work for sources nothing can harvest.
     */
    public List<SyncSource> availableSources() {
        return metadataAdapters.keySet().stream()
                .sorted(Comparator.comparing(SyncSource::getValue))
                .toList();
    }

    public SyncJob runSync(SyncRequest request) {
        OffsetDateTime startedAt = OffsetDateTime.now();
        UUID jobId = UUID.randomUUID();
        // Planning belongs inside the failure handling. DIFF planning reads live DSpace state, so an
        // unreachable repository used to escape as an unhandled exception and surface to the admin
        // UI as a bare HTTP 500 instead of a failed job carrying the reason.
        List<SyncAction> plannedActions = List.of();

        try {
            plannedActions = planActions(request);
            syncJobStore.save(new SyncJob(
                    jobId, request.getMode(), request.getSource(), SyncStatus.RUNNING, startedAt, plannedActions));

            LOGGER.info(
                    "Sync job {} started with mode {} for source {} and {} planned actions.",
                    jobId,
                    request.getMode(),
                    request.getSource(),
                    plannedActions.size());

            syncActionRunner.run(request, plannedActions, sourcePayload(request));
            SyncStatus status = completedStatus(request.getMode());
            SyncJob completedJob =
                    new SyncJob(jobId, request.getMode(), request.getSource(), status, startedAt, plannedActions)
                        .completedAt(OffsetDateTime.now());
            SyncJob savedJob = syncJobStore.save(completedJob);
            LOGGER.info("Sync job {} completed with status {}.", jobId, savedJob.getStatus());
            return savedJob;
        } catch (RuntimeException exception) {
            List<SyncAction> failedActions = new ArrayList<>(plannedActions);
            failedActions.add(new SyncAction(
                        SyncAction.ActionTypeEnum.SYNC_FAILED, request.getSource().name(), failureDetail(exception)));
            SyncJob failedJob = new SyncJob(
                    jobId,
                    request.getMode(),
                    request.getSource(),
                    SyncStatus.FAILED,
                    startedAt,
                    failedActions)
                        .completedAt(OffsetDateTime.now());
            SyncJob savedJob = syncJobStore.save(failedJob);
            LOGGER.warn("Sync job {} failed with status {}.", jobId, savedJob.getStatus(), exception);
            return savedJob;
        }
    }

    /**
     * Looks a job up by its identifier as written in the URL.
     *
     * <p>Job identifiers are UUIDs, so a string that is not one names no job. That is reported the
     * same way an unknown job is -- empty, which the controller turns into 404 -- rather than as a
     * malformed-request error, because the caller's situation is identical either way.
     */
    public Optional<SyncJob> findJob(String id) {
        try {
            return syncJobStore.findById(UUID.fromString(id));
        } catch (IllegalArgumentException exception) {
            return Optional.empty();
        }
    }

    public List<SyncJob> findRecentJobs() {
        return syncJobStore.findRecent(25);
    }

    private List<SyncAction> planActions(SyncRequest request) {
        PublicMetadataAdapter metadataAdapter = metadataAdapters.get(request.getSource());
        if (metadataAdapter == null) {
            return fallbackPlanActions(request);
        }

        ResearchObjectMetadata metadata = metadataAdapter.firstVisualSlice();
        DspaceItemPayload itemPayload = dspaceItemPayloadMapper.toItemPayload(metadata);
        if (request.getMode() == SyncMode.DIFF) {
            return diffPlanActions(metadata, itemPayload);
        }

        return List.of(
                new SyncAction(
                        SyncAction.ActionTypeEnum.UPSERT_COMMUNITY, COMMUNITY_NAME, "Ensure root DSpace community exists."),
                new SyncAction(
                        SyncAction.ActionTypeEnum.UPSERT_COLLECTION,
                        COLLECTION_NAME,
                        "Ensure collection exists for " + metadata.program().getValue() + " "
                                + metadata.geographicLevel() + " metadata."),
                new SyncAction(
                        SyncAction.ActionTypeEnum.UPSERT_ITEM,
                        itemPayload.name(),
                        // The release date is harvested from the publisher's Last-Modified, so naming
                        // it here shows which date a dry run would actually write.
                        "Prepare DSpace item payload with " + itemPayload.metadata().size() + " metadata fields and "
                                + itemPayload.bitstreams().size() + " file manifest entries, published "
                                + metadata.releasedOn() + "."),
                new SyncAction(
                        SyncAction.ActionTypeEnum.UPSERT_FILE_MANIFEST,
                        metadata.id(),
                        "Track " + metadata.files().size() + " source files: " + fileManifestSummary(metadata.files()) + "."),
                new SyncAction(
                        SyncAction.ActionTypeEnum.UPSERT_CITATION,
                        metadata.id(),
                        "Store citation and documentation URL: " + metadata.documentationUrl() + "."),
                new SyncAction(
                        SyncAction.ActionTypeEnum.UPSERT_MAP_LAYER,
                        metadata.geography() + " " + metadata.geographicLevel() + " map preview",
                        "Ensure map layer metadata exists for " + metadata.sourceUrl() + "."),
                new SyncAction(
                        SyncAction.ActionTypeEnum.VERIFY_INDEX, "Solr discovery", "Confirm item is available for discovery indexing."));
    }

    private Optional<DspaceItemPayload> sourcePayload(SyncRequest request) {
        PublicMetadataAdapter metadataAdapter = metadataAdapters.get(request.getSource());
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

    private List<SyncAction> diffPlanActions(ResearchObjectMetadata metadata, DspaceItemPayload itemPayload) {
        return List.of(
                new SyncAction(
                        SyncAction.ActionTypeEnum.VERIFY_COMMUNITY,
                        COMMUNITY_NAME,
                        "Check whether the root DSpace community exists before comparing item state."),
                new SyncAction(
                        SyncAction.ActionTypeEnum.VERIFY_COLLECTION,
                        COLLECTION_NAME,
                        "Check whether the " + COLLECTION_NAME + " collection exists before comparing item state."),
                dspaceItemDiffPlanner.planItemDiff(metadata.id(), itemPayload),
                new SyncAction(
                        SyncAction.ActionTypeEnum.VERIFY_INDEX, "Solr discovery", "Check whether repository metadata is indexed after item state comparison."));
    }

    private List<SyncAction> fallbackPlanActions(SyncRequest request) {
        LOGGER.info("No metadata adapter exists yet for {}; using placeholder sync actions.", request.getSource());
        return List.of(
                new SyncAction(
                        SyncAction.ActionTypeEnum.UPSERT_COMMUNITY, COMMUNITY_NAME, "Ensure root DSpace community exists."),
                new SyncAction(
                        SyncAction.ActionTypeEnum.UPSERT_COLLECTION, COLLECTION_NAME, "Ensure collection exists for selected source."),
                new SyncAction(
                        SyncAction.ActionTypeEnum.UPSERT_ITEM, firstSliceItemTitle(request.getSource()), "Ensure visual North Dakota demo item exists."),
                new SyncAction(
                        SyncAction.ActionTypeEnum.UPSERT_MAP_LAYER, "North Dakota map preview", "Ensure map layer metadata exists."),
                new SyncAction(
                        SyncAction.ActionTypeEnum.VERIFY_INDEX, "Solr discovery", "Confirm item is available for discovery indexing."));
    }

    /**
     * Summarizes the manifest, including each file's size when the publisher reported one.
     *
     * <p>Sizes are harvested from the publishing host rather than compiled in, so showing them here
     * is what makes that visible in a dry run: a size means the source was reachable and answered,
     * and its absence means the entry rests on compiled metadata.
     */
    private String fileManifestSummary(List<ResearchObjectFile> files) {
        return files.stream()
                .map((file) -> file.id() + "=" + file.format().getValue()
                        + (file.sizeBytes() == null ? "" : " (" + file.sizeBytes() + " bytes)"))
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
