package org.civicsrepo.admin;

import jakarta.annotation.PreDestroy;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.civicsrepo.federation.CorpusProfile;
import org.civicsrepo.federation.FederatedHarvestRunService;
import org.civicsrepo.federation.FederatedMetadataCatalog;
import org.civicsrepo.federation.FederatedSnapshotProjectionCaptureService;
import org.civicsrepo.federation.FederatedSnapshotProjectionEvidence;
import org.civicsrepo.federation.FederatedSourceSystem;
import org.civicsrepo.federation.HarvestRun;
import org.civicsrepo.federation.HarvestRunStatus;
import org.civicsrepo.federation.HarvestRunStore;
import org.civicsrepo.repository.DiscoveryProjectionService.ProjectionProgressListener;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Owns long-running corpus growth from a durable federated checkpoint through verified activation.
 *
 * <p>The first supported scale transition is Data.gov -> FEDERATED_100K. The operation resumes the
 * existing harvest run and page size, retains publisher metadata durably, captures an exact stable-ID
 * 100K prefix, rebuilds both search targets from that same prefix, verifies parity, records activation,
 * then captures local-storage evidence. Search remains unchanged during harvest. If projection or
 * checkpoint verification fails, the previously active profile is rebuilt before the operation is
 * reported failed.
 */
@Service
public class CorpusProfileScaleService {
    private static final Logger LOGGER = LoggerFactory.getLogger(CorpusProfileScaleService.class);
    private static final FederatedSourceSystem SOURCE = FederatedSourceSystem.DATA_GOV;
    private static final int DEFAULT_PAGE_SIZE = 100;
    private static final int MAX_PAGES_PER_CHUNK = 100;
    private static final int MAX_HARVEST_CHUNKS = 100;

    private final FederatedMetadataCatalog metadataCatalog;
    private final FederatedHarvestRunService harvestRunService;
    private final HarvestRunStore harvestRunStore;
    private final FederatedSnapshotProjectionCaptureService snapshotProjectionService;
    private final CorpusProfileActivationService activationService;
    private final CorpusProfileActivationProgressTracker progressTracker;
    private final CorpusStorageAdminService storageAdminService;
    private final ExecutorService executor;

    @Autowired
    public CorpusProfileScaleService(
            FederatedMetadataCatalog metadataCatalog,
            FederatedHarvestRunService harvestRunService,
            HarvestRunStore harvestRunStore,
            FederatedSnapshotProjectionCaptureService snapshotProjectionService,
            CorpusProfileActivationService activationService,
            CorpusProfileActivationProgressTracker progressTracker,
            CorpusStorageAdminService storageAdminService) {
        this(
                metadataCatalog,
                harvestRunService,
                harvestRunStore,
                snapshotProjectionService,
                activationService,
                progressTracker,
                storageAdminService,
                Executors.newSingleThreadExecutor(Thread.ofVirtual().name("corpus-scale-", 0).factory()));
    }

    CorpusProfileScaleService(
            FederatedMetadataCatalog metadataCatalog,
            FederatedHarvestRunService harvestRunService,
            HarvestRunStore harvestRunStore,
            FederatedSnapshotProjectionCaptureService snapshotProjectionService,
            CorpusProfileActivationService activationService,
            CorpusProfileActivationProgressTracker progressTracker,
            CorpusStorageAdminService storageAdminService,
            ExecutorService executor) {
        this.metadataCatalog = metadataCatalog;
        this.harvestRunService = harvestRunService;
        this.harvestRunStore = harvestRunStore;
        this.snapshotProjectionService = snapshotProjectionService;
        this.activationService = activationService;
        this.progressTracker = progressTracker;
        this.storageAdminService = storageAdminService;
        this.executor = executor;
    }

    /** Start the first guarded scale tier and return immediately with operator progress state. */
    public CorpusProfileActivationProgress start(CorpusProfile profile) {
        validateSupportedProfile(profile);
        progressTracker.begin(profile);
        CorpusProfile previousProfile = activationService.currentProfile();
        try {
            executor.submit(() -> execute(profile, previousProfile));
        } catch (RuntimeException submissionFailure) {
            progressTracker.fail(submissionFailure);
            throw submissionFailure;
        }
        return progressTracker.current();
    }

    /** Package-visible synchronous seam used by deterministic orchestration tests. */
    void execute(CorpusProfile profile, CorpusProfile previousProfile) {
        long target = profile.targetRecordCount().orElseThrow();
        boolean projectionAttempted = false;

        try {
            HarvestRun run = growRetainedSource(target);
            progressTracker.snapshotting(target);

            projectionAttempted = true;
            FederatedSnapshotProjectionEvidence evidence = snapshotProjectionService.captureAndProject(
                    run.id(), profile, projectionProgressListener());

            long projectedCount = evidence.projectionObjectCount();
            progressTracker.capturingEvidence(projectedCount, projectedCount);
            captureStorageEvidence(projectedCount);
        } catch (RuntimeException failure) {
            if (projectionAttempted && previousProfile != profile) {
                restorePreviousProfile(previousProfile, failure);
            }
            progressTracker.fail(failure);
            LOGGER.error("Corpus scale operation failed for {}.", profile, failure);
        }
    }

    private HarvestRun growRetainedSource(long target) {
        long retained = metadataCatalog.count(SOURCE);
        progressTracker.harvesting(Math.min(retained, target), target);

        HarvestRun run = findSnapshotEligibleRun();
        if (retained >= target) {
            if (run == null) {
                throw new IllegalStateException(
                        "Data.gov already meets the requested retained count, but no paused or completed harvest run is available for snapshot evidence.");
            }
            return run;
        }

        int pageSize = resolvePageSize();
        for (int chunk = 0; chunk < MAX_HARVEST_CHUNKS && retained < target; chunk++) {
            int pages = pagesForRemaining(retained, target, pageSize);
            run = harvestRunService.runBounded(
                    SOURCE,
                    pageSize,
                    pages,
                    persistedRun -> progressTracker.harvesting(
                            Math.min(metadataCatalog.count(SOURCE), target), target));
            retained = metadataCatalog.count(SOURCE);
            progressTracker.harvesting(Math.min(retained, target), target);

            if (retained >= target) {
                return requireSnapshotEligible(run);
            }
            if (run.status() == HarvestRunStatus.COMPLETED) {
                throw new IllegalStateException(
                        "Data.gov source completed with only " + retained + " retained records; " + target + " are required.");
            }
            if (run.status() == HarvestRunStatus.CANCELLED) {
                throw new IllegalStateException("Data.gov harvest was cancelled before the corpus target was reached.");
            }
            if (run.status() == HarvestRunStatus.FAILED) {
                throw new IllegalStateException("Data.gov harvest failed before the corpus target was reached: "
                        + failureMessage(run));
            }
            if (run.failureMessage() != null && !run.failureMessage().isBlank()) {
                throw new IllegalStateException(
                        "Data.gov harvest paused before the corpus target was reached: " + run.failureMessage());
            }
        }

        throw new IllegalStateException("Data.gov harvest exceeded the guarded page budget before reaching " + target
                + " retained records. The durable checkpoint is preserved for a later resume.");
    }

    private int pagesForRemaining(long retained, long target, int pageSize) {
        long remaining = Math.max(1, target - retained);
        long pages = Math.max(1, (remaining + pageSize - 1L) / pageSize);
        return (int) Math.min(MAX_PAGES_PER_CHUNK, pages);
    }

    private int resolvePageSize() {
        return harvestRunStore.findResumable(SOURCE)
                .map(HarvestRun::pageSize)
                .orElseGet(() -> harvestRunStore.findRecent(SOURCE, 20).stream()
                        .findFirst()
                        .map(HarvestRun::pageSize)
                        .orElse(DEFAULT_PAGE_SIZE));
    }

    private HarvestRun findSnapshotEligibleRun() {
        return harvestRunStore.findResumable(SOURCE)
                .filter(this::snapshotEligible)
                .orElseGet(() -> harvestRunStore.findRecent(SOURCE, 20).stream()
                        .filter(this::snapshotEligible)
                        .findFirst()
                        .orElse(null));
    }

    private HarvestRun requireSnapshotEligible(HarvestRun run) {
        if (run != null && snapshotEligible(run)) {
            return run;
        }
        HarvestRun fallback = findSnapshotEligibleRun();
        if (fallback == null) {
            throw new IllegalStateException(
                    "The Data.gov target was reached without a paused or completed harvest run for snapshot evidence.");
        }
        return fallback;
    }

    private boolean snapshotEligible(HarvestRun run) {
        return run.status() == HarvestRunStatus.PAUSED || run.status() == HarvestRunStatus.COMPLETED;
    }

    private ProjectionProgressListener projectionProgressListener() {
        return new ProjectionProgressListener() {
            @Override
            public void projectionStarted(long totalDocuments) {
                progressTracker.projectionStarted(totalDocuments);
            }

            @Override
            public void documentsProjected(long processedDocuments, long totalDocuments) {
                progressTracker.projected(processedDocuments, totalDocuments);
            }

            @Override
            public void verificationStarted(long processedDocuments, long totalDocuments) {
                progressTracker.verifying(processedDocuments, totalDocuments);
            }
        };
    }

    private void captureStorageEvidence(long projectedCount) {
        try {
            storageAdminService.captureCurrent();
            progressTracker.complete(
                    projectedCount,
                    projectedCount,
                    "Corpus profile growth, verified projection, and storage evidence capture completed.");
        } catch (RuntimeException storageFailure) {
            LOGGER.warn(
                    "Corpus profile activation succeeded, but storage evidence capture failed: {}",
                    storageFailure.getMessage());
            progressTracker.complete(
                    projectedCount,
                    projectedCount,
                    "Corpus profile is active and verified, but the local storage footprint could not be captured.");
        }
    }

    private void restorePreviousProfile(CorpusProfile previousProfile, RuntimeException failure) {
        try {
            activationService.restoreKnownGoodProfile(previousProfile);
        } catch (RuntimeException restoreFailure) {
            failure.addSuppressed(restoreFailure);
        }
    }

    private void validateSupportedProfile(CorpusProfile profile) {
        Objects.requireNonNull(profile, "profile");
        if (profile != CorpusProfile.FEDERATED_100K) {
            throw new IllegalArgumentException(
                    "Guarded corpus growth currently supports FEDERATED_100K only; requested " + profile + ".");
        }
    }

    private String failureMessage(HarvestRun run) {
        return run.failureMessage() == null || run.failureMessage().isBlank()
                ? run.status().name()
                : run.failureMessage();
    }

    @PreDestroy
    void shutdown() {
        executor.shutdownNow();
    }
}