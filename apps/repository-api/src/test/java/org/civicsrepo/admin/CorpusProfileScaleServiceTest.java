package org.civicsrepo.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.OffsetDateTime;
import java.util.List;
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

class CorpusProfileScaleServiceTest {
    private static final FederatedSourceSystem SOURCE = FederatedSourceSystem.DATA_GOV;
    private static final OffsetDateTime NOW = OffsetDateTime.parse("2026-08-31T00:40:00Z");

    @Test
    void resumesDurableTenKRunAndActivatesExactHundredKProfile() {
        FederatedMetadataCatalog metadataCatalog = mock(FederatedMetadataCatalog.class);
        FederatedHarvestRunService harvestRunService = mock(FederatedHarvestRunService.class);
        HarvestRunStore harvestRunStore = mock(HarvestRunStore.class);
        FederatedSnapshotProjectionCaptureService snapshotProjectionService =
                mock(FederatedSnapshotProjectionCaptureService.class);
        CorpusProfileActivationService activationService = mock(CorpusProfileActivationService.class);
        CorpusProfileActivationProgressTracker progressTracker = new CorpusProfileActivationProgressTracker();
        CorpusStorageAdminService storageAdminService = mock(CorpusStorageAdminService.class);
        ExecutorService executor = mock(ExecutorService.class);
        HarvestRun tenK = pausedRun("run-10k", 10_000, 100, 100, "cursor-10k");
        HarvestRun hundredK = pausedRun("run-10k", 100_000, 100, 1_000, "cursor-100k");
        FederatedSnapshotProjectionEvidence evidence = evidence(100_181);

        when(metadataCatalog.count(SOURCE)).thenReturn(10_000L, 100_000L, 100_000L);
        when(harvestRunStore.findResumable(SOURCE)).thenReturn(Optional.of(tenK));
        doAnswer(invocation -> {
                    FederatedHarvestRunService.HarvestProgressListener listener = invocation.getArgument(3);
                    listener.pageCompleted(hundredK);
                    return hundredK;
                })
                .when(harvestRunService)
                .runBounded(eq(SOURCE), eq(100), eq(100), any(FederatedHarvestRunService.HarvestProgressListener.class));
        doAnswer(invocation -> {
                    ProjectionProgressListener listener = invocation.getArgument(2);
                    listener.projectionStarted(100_181);
                    listener.documentsProjected(100_000, 100_181);
                    listener.verificationStarted(100_181, 100_181);
                    return evidence;
                })
                .when(snapshotProjectionService)
                .captureAndProject(eq("run-10k"), eq(CorpusProfile.FEDERATED_100K), any(ProjectionProgressListener.class));

        CorpusProfileScaleService service = new CorpusProfileScaleService(
                metadataCatalog,
                harvestRunService,
                harvestRunStore,
                snapshotProjectionService,
                activationService,
                progressTracker,
                storageAdminService,
                executor);
        progressTracker.begin(CorpusProfile.FEDERATED_100K);

        service.execute(CorpusProfile.FEDERATED_100K, CorpusProfile.FEDERATED_10K);

        verify(harvestRunService)
                .runBounded(eq(SOURCE), eq(100), eq(100), any(FederatedHarvestRunService.HarvestProgressListener.class));
        verify(snapshotProjectionService)
                .captureAndProject(eq("run-10k"), eq(CorpusProfile.FEDERATED_100K), any(ProjectionProgressListener.class));
        verify(storageAdminService).captureCurrent();
        verify(activationService, never()).restoreKnownGoodProfile(any());
        CorpusProfileActivationProgress completed = progressTracker.current();
        assertThat(completed.phase()).isEqualTo(CorpusProfileActivationProgress.Phase.COMPLETED);
        assertThat(completed.percentComplete()).isEqualTo(100);
        assertThat(completed.processedDocuments()).isEqualTo(100_181);
        assertThat(completed.message()).contains("storage evidence capture completed");
    }

    @Test
    void restoresPreviousProfileWhenGuardedProjectionFails() {
        FederatedMetadataCatalog metadataCatalog = mock(FederatedMetadataCatalog.class);
        FederatedHarvestRunService harvestRunService = mock(FederatedHarvestRunService.class);
        HarvestRunStore harvestRunStore = mock(HarvestRunStore.class);
        FederatedSnapshotProjectionCaptureService snapshotProjectionService =
                mock(FederatedSnapshotProjectionCaptureService.class);
        CorpusProfileActivationService activationService = mock(CorpusProfileActivationService.class);
        CorpusProfileActivationProgressTracker progressTracker = new CorpusProfileActivationProgressTracker();
        CorpusStorageAdminService storageAdminService = mock(CorpusStorageAdminService.class);
        ExecutorService executor = mock(ExecutorService.class);
        HarvestRun hundredK = pausedRun("run-100k", 100_000, 100, 1_000, "cursor-100k");

        when(metadataCatalog.count(SOURCE)).thenReturn(100_000L);
        when(harvestRunStore.findResumable(SOURCE)).thenReturn(Optional.of(hundredK));
        when(snapshotProjectionService.captureAndProject(
                        eq("run-100k"), eq(CorpusProfile.FEDERATED_100K), any(ProjectionProgressListener.class)))
                .thenThrow(new IllegalStateException("OpenSearch projection parity failed"));

        CorpusProfileScaleService service = new CorpusProfileScaleService(
                metadataCatalog,
                harvestRunService,
                harvestRunStore,
                snapshotProjectionService,
                activationService,
                progressTracker,
                storageAdminService,
                executor);
        progressTracker.begin(CorpusProfile.FEDERATED_100K);

        service.execute(CorpusProfile.FEDERATED_100K, CorpusProfile.CURATED_DEMO);

        verify(activationService).restoreKnownGoodProfile(CorpusProfile.CURATED_DEMO);
        verify(storageAdminService, never()).captureCurrent();
        CorpusProfileActivationProgress failed = progressTracker.current();
        assertThat(failed.phase()).isEqualTo(CorpusProfileActivationProgress.Phase.FAILED);
        assertThat(failed.message()).contains("OpenSearch projection parity failed");
    }

    @Test
    void keepsVerifiedProfileActiveWhenOnlyStorageCaptureFails() {
        FederatedMetadataCatalog metadataCatalog = mock(FederatedMetadataCatalog.class);
        FederatedHarvestRunService harvestRunService = mock(FederatedHarvestRunService.class);
        HarvestRunStore harvestRunStore = mock(HarvestRunStore.class);
        FederatedSnapshotProjectionCaptureService snapshotProjectionService =
                mock(FederatedSnapshotProjectionCaptureService.class);
        CorpusProfileActivationService activationService = mock(CorpusProfileActivationService.class);
        CorpusProfileActivationProgressTracker progressTracker = new CorpusProfileActivationProgressTracker();
        CorpusStorageAdminService storageAdminService = mock(CorpusStorageAdminService.class);
        ExecutorService executor = mock(ExecutorService.class);
        HarvestRun hundredK = pausedRun("run-100k", 100_000, 100, 1_000, "cursor-100k");

        when(metadataCatalog.count(SOURCE)).thenReturn(100_000L);
        when(harvestRunStore.findResumable(SOURCE)).thenReturn(Optional.of(hundredK));
        when(snapshotProjectionService.captureAndProject(
                        eq("run-100k"), eq(CorpusProfile.FEDERATED_100K), any(ProjectionProgressListener.class)))
                .thenReturn(evidence(100_181));
        when(storageAdminService.captureCurrent()).thenThrow(new IllegalStateException("storage probe unavailable"));

        CorpusProfileScaleService service = new CorpusProfileScaleService(
                metadataCatalog,
                harvestRunService,
                harvestRunStore,
                snapshotProjectionService,
                activationService,
                progressTracker,
                storageAdminService,
                executor);
        progressTracker.begin(CorpusProfile.FEDERATED_100K);

        service.execute(CorpusProfile.FEDERATED_100K, CorpusProfile.FEDERATED_10K);

        verify(activationService, never()).restoreKnownGoodProfile(any());
        assertThat(progressTracker.current().phase()).isEqualTo(CorpusProfileActivationProgress.Phase.COMPLETED);
        assertThat(progressTracker.current().message()).contains("could not be captured");
    }

    private HarvestRun pausedRun(String id, long accepted, int pageSize, int pages, String cursor) {
        return new HarvestRun(
                id,
                SOURCE,
                "data-gov-catalog-v4-v2",
                HarvestRunStatus.PAUSED,
                pageSize,
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

    private FederatedSnapshotProjectionEvidence evidence(int projectionObjectCount) {
        return new FederatedSnapshotProjectionEvidence(
                "DATA_GOV:" + "a".repeat(64),
                "run-10k",
                SOURCE,
                "a".repeat(64),
                100_000,
                "b".repeat(64),
                RepositorySource.REPOSITORY,
                projectionObjectCount,
                NOW,
                NOW);
    }
}
