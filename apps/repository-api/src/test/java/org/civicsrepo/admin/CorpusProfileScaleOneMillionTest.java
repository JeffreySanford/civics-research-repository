package org.civicsrepo.admin;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.util.concurrent.ExecutorService;
import org.civicsrepo.federation.CorpusProfile;
import org.civicsrepo.federation.FederatedHarvestRunService;
import org.civicsrepo.federation.FederatedMetadataCatalog;
import org.civicsrepo.federation.FederatedSnapshotProjectionCaptureService;
import org.civicsrepo.federation.HarvestRunStore;
import org.junit.jupiter.api.Test;

class CorpusProfileScaleOneMillionTest {
    @Test
    void refusesSingleSourceMillionBeforeMutatingHarvestOrProjectionState() {
        FederatedMetadataCatalog metadataCatalog = mock(FederatedMetadataCatalog.class);
        FederatedHarvestRunService harvestRunService = mock(FederatedHarvestRunService.class);
        HarvestRunStore harvestRunStore = mock(HarvestRunStore.class);
        FederatedSnapshotProjectionCaptureService snapshotProjectionService =
                mock(FederatedSnapshotProjectionCaptureService.class);
        CorpusProfileActivationService activationService = mock(CorpusProfileActivationService.class);
        CorpusProfileActivationProgressTracker progressTracker = new CorpusProfileActivationProgressTracker();
        CorpusStorageAdminService storageAdminService = mock(CorpusStorageAdminService.class);
        ExecutorService executor = mock(ExecutorService.class);

        CorpusProfileScaleService service = new CorpusProfileScaleService(
                metadataCatalog,
                harvestRunService,
                harvestRunStore,
                snapshotProjectionService,
                activationService,
                progressTracker,
                storageAdminService,
                executor);

        assertThatThrownBy(() -> service.start(CorpusProfile.FEDERATED_1M))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("multi-source snapshot/evidence workflow")
                .hasMessageContaining("Data.gov alone");

        verify(harvestRunService, never()).runBounded(org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.anyInt(), org.mockito.ArgumentMatchers.anyInt());
        verify(snapshotProjectionService, never()).captureAndProject(
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.any(CorpusProfile.class),
                org.mockito.ArgumentMatchers.any());
        verify(executor, never()).submit(org.mockito.ArgumentMatchers.any(Runnable.class));
    }
}
