package org.civicsrepo.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.concurrent.ExecutorService;
import org.civicsrepo.federation.CorpusProfile;
import org.civicsrepo.federation.FederatedHarvestRunService;
import org.civicsrepo.federation.FederatedMetadataCatalog;
import org.civicsrepo.federation.FederatedSnapshotProjectionCaptureService;
import org.civicsrepo.federation.FederatedSnapshotProjectionEvidence;
import org.civicsrepo.federation.FederatedSourceSystem;
import org.civicsrepo.federation.HarvestRun;
import org.civicsrepo.federation.HarvestRunStatus;
import org.civicsrepo.federation.HarvestRunStore;
import org.civicsrepo.generated.dto.RepositorySource;
import org.civicsrepo.repository.DiscoveryProjectionService.ProjectionProgressListener;
import org.junit.jupiter.api.Test;

class CorpusProfileScaleOneMillionTest {
    private static final FederatedSourceSystem SOURCE = FederatedSourceSystem.DATA_GOV;
    private static final OffsetDateTime NOW = OffsetDateTime.parse("2026-08-31T16:10:00Z");

    @Test
    void resumesHundredKCheckpointAndActivatesOneMillionProfile() {
        FederatedMetadataCatalog metadataCatalog = mock(FederatedMetadataCatalog.class);
        FederatedHarvestRunService harvestRunService = mock(FederatedHarvestRunService.class);
        HarvestRunStore harvestRunStore = mock(HarvestRunStore.class);
        FederatedSnapshotProjectionCaptureService snapshotProjectionService =
                mock(FederatedSnapshotProjectionCaptureService.class);
        CorpusProfileActivationService activationService = mock(CorpusProfileActivationService.class);
        CorpusProfileActivationProgressTracker progressTracker = new CorpusProfileActivationProgressTracker();
        CorpusStorageAdminService storageAdminService = mock(CorpusStorageAdminService.class);
        ExecutorService executor = mock(ExecutorService.class);

        HarvestRun hundredK = pausedRun("run-100k", 100_000, 1_000, "cursor-100k");
        HarvestRun oneMillion = pausedRun("run-100k", 1_000_000, 10_000, "cursor-1m");

        when(metadataCatalog.count(SOURCE)).thenReturn(100_000L, 1_000_000L);
        when(harvestRunStore.findResumable(SOURCE)).thenReturn(Optional.of(hundredK));
        when(harvestRunService.runBounded(
                        eq(SOURCE),
                        eq(100),
                        eq(100),
                        any(FederatedHarvestRunService.HarvestProgressListener.class)))
                .thenReturn(oneMillion);
        when(snapshotProjectionService.captureAndProject(
                        eq("run-100k"), eq(CorpusProfile.FEDERATED_1M), any(ProjectionProgressListener.class)))
                .thenReturn(evidence());

        CorpusProfileScaleService service = new CorpusProfileScaleService(
                metadataCatalog,
                harvestRunService,
                harvestRunStore,
                snapshotProjectionService,
                activationService,
                progressTracker,
                storageAdminService,
                executor);
        progressTracker.begin(CorpusProfile.FEDERATED_1M);

        service.execute(CorpusProfile.FEDERATED_1M, CorpusProfile.FEDERATED_100K);

        verify(harvestRunService)
                .runBounded(eq(SOURCE), eq(100), eq(100), any(FederatedHarvestRunService.HarvestProgressListener.class));
        verify(snapshotProjectionService)
                .captureAndProject(eq("run-100k"), eq(CorpusProfile.FEDERATED_1M), any(ProjectionProgressListener.class));
        verify(storageAdminService).captureCurrent();
        verify(activationService, never()).restoreKnownGoodProfile(any());

        CorpusProfileActivationProgress completed = progressTracker.current();
        assertThat(completed.phase()).isEqualTo(CorpusProfileActivationProgress.Phase.COMPLETED);
        assertThat(completed.percentComplete()).isEqualTo(100);
        assertThat(completed.processedDocuments()).isEqualTo(1_000_181);
    }

    private HarvestRun pausedRun(String id, long accepted, int pages, String cursor) {
        return new HarvestRun(
                id,
                SOURCE,
                "data-gov-catalog-v4-v2",
                HarvestRunStatus.PAUSED,
                100,
                pages,
                accepted,
                0,
                0,
                cursor,
                NOW.minusHours(1),
                NOW,
                null,
                null);
    }

    private FederatedSnapshotProjectionEvidence evidence() {
        return new FederatedSnapshotProjectionEvidence(
                "DATA_GOV:" + "a".repeat(64),
                "run-100k",
                SOURCE,
                "a".repeat(64),
                1_000_000,
                "b".repeat(64),
                RepositorySource.REPOSITORY,
                1_000_181,
                NOW,
                NOW);
    }
}
