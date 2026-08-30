package org.civicsrepo.federation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.OffsetDateTime;
import java.util.List;
import org.civicsrepo.admin.CorpusProfileActivationService;
import org.civicsrepo.generated.dto.RepositorySource;
import org.civicsrepo.repository.DiscoveryProjectionService;
import org.civicsrepo.repository.DiscoveryProjectionService.ProjectionState;
import org.civicsrepo.search.SearchService;
import org.junit.jupiter.api.Test;

class FederatedSnapshotProjectionCaptureServiceTest {
    private static final String SNAPSHOT_SHA = "a".repeat(64);
    private static final String PROJECTION_ID = "b".repeat(64);
    private static final OffsetDateTime RUN_UPDATED_AT = OffsetDateTime.parse("2026-08-30T17:23:18Z");

    @Test
    void linksOnlyTheProjectionRebuiltFromAStableCheckpoint() {
        FederatedBoundedSnapshotCaptureService snapshotCapture = mock(FederatedBoundedSnapshotCaptureService.class);
        FederatedCorpusManifestService manifestService = mock(FederatedCorpusManifestService.class);
        DiscoveryProjectionService projectionService = mock(DiscoveryProjectionService.class);
        SearchService searchService = mock(SearchService.class);
        FederatedSnapshotProjectionEvidenceStore evidenceStore = mock(FederatedSnapshotProjectionEvidenceStore.class);
        CorpusProfileActivationService activationService = mock(CorpusProfileActivationService.class);
        FederatedBoundedSnapshotManifest snapshot = snapshot(1_000, 10, "cursor-1", RUN_UPDATED_AT);
        OffsetDateTime rebuiltAt = OffsetDateTime.parse("2026-08-30T19:30:00Z");
        ProjectionState projected = new ProjectionState(RepositorySource.REPOSITORY, 1_181, rebuiltAt);

        when(snapshotCapture.capture("run-1")).thenReturn(snapshot);
        when(searchService.fixtureDocuments()).thenReturn(List.of());
        when(projectionService.reindex(CorpusProfile.FULL, List.of())).thenReturn(projected);
        when(projectionService.currentProjectionId()).thenReturn(PROJECTION_ID);
        when(manifestService.generateBoundedSnapshot("run-1")).thenReturn(snapshot);

        FederatedSnapshotProjectionCaptureService service = new FederatedSnapshotProjectionCaptureService(
                snapshotCapture,
                manifestService,
                projectionService,
                searchService,
                evidenceStore,
                activationService);

        FederatedSnapshotProjectionEvidence evidence = service.captureAndProject("run-1");

        assertThat(evidence.snapshotId()).isEqualTo("DATA_GOV:" + SNAPSHOT_SHA);
        assertThat(evidence.snapshotRetainedRecordCount()).isEqualTo(1_000);
        assertThat(evidence.projectionId()).isEqualTo(PROJECTION_ID);
        assertThat(evidence.projectionObjectCount()).isEqualTo(1_181);
        assertThat(evidence.projectionRebuiltAt()).isEqualTo(rebuiltAt);
        verify(evidenceStore).save(evidence);
        verify(activationService).recordSuccessfulProjection(CorpusProfile.FULL, projected);
    }

    @Test
    void exactNamedCheckpointActivatesItsNamedProfile() {
        FederatedBoundedSnapshotCaptureService snapshotCapture = mock(FederatedBoundedSnapshotCaptureService.class);
        FederatedCorpusManifestService manifestService = mock(FederatedCorpusManifestService.class);
        DiscoveryProjectionService projectionService = mock(DiscoveryProjectionService.class);
        SearchService searchService = mock(SearchService.class);
        FederatedSnapshotProjectionEvidenceStore evidenceStore = mock(FederatedSnapshotProjectionEvidenceStore.class);
        CorpusProfileActivationService activationService = mock(CorpusProfileActivationService.class);
        FederatedBoundedSnapshotManifest snapshot = snapshot(10_000, 100, "cursor-10k", RUN_UPDATED_AT);
        ProjectionState projected = new ProjectionState(
                RepositorySource.REPOSITORY, 10_181, OffsetDateTime.parse("2026-08-30T20:57:21Z"));

        when(snapshotCapture.capture("run-1")).thenReturn(snapshot);
        when(searchService.fixtureDocuments()).thenReturn(List.of());
        when(projectionService.reindex(CorpusProfile.FEDERATED_10K, List.of())).thenReturn(projected);
        when(projectionService.currentProjectionId()).thenReturn(PROJECTION_ID);
        when(manifestService.generateBoundedSnapshot("run-1")).thenReturn(snapshot);

        FederatedSnapshotProjectionCaptureService service = new FederatedSnapshotProjectionCaptureService(
                snapshotCapture,
                manifestService,
                projectionService,
                searchService,
                evidenceStore,
                activationService);

        service.captureAndProject("run-1");

        verify(activationService).recordSuccessfulProjection(CorpusProfile.FEDERATED_10K, projected);
    }

    @Test
    void refusesToLinkWhenTheHarvestCheckpointMovesDuringProjection() {
        FederatedBoundedSnapshotCaptureService snapshotCapture = mock(FederatedBoundedSnapshotCaptureService.class);
        FederatedCorpusManifestService manifestService = mock(FederatedCorpusManifestService.class);
        DiscoveryProjectionService projectionService = mock(DiscoveryProjectionService.class);
        SearchService searchService = mock(SearchService.class);
        FederatedSnapshotProjectionEvidenceStore evidenceStore = mock(FederatedSnapshotProjectionEvidenceStore.class);
        CorpusProfileActivationService activationService = mock(CorpusProfileActivationService.class);
        FederatedBoundedSnapshotManifest before = snapshot(1_000, 10, "cursor-1", RUN_UPDATED_AT);
        FederatedBoundedSnapshotManifest after = snapshot(1_100, 11, "cursor-2", RUN_UPDATED_AT.plusSeconds(10));

        when(snapshotCapture.capture("run-1")).thenReturn(before);
        when(searchService.fixtureDocuments()).thenReturn(List.of());
        when(projectionService.reindex(CorpusProfile.FULL, List.of()))
                .thenReturn(new ProjectionState(
                        RepositorySource.REPOSITORY, 1_281, OffsetDateTime.parse("2026-08-30T19:31:00Z")));
        when(projectionService.currentProjectionId()).thenReturn(PROJECTION_ID);
        when(manifestService.generateBoundedSnapshot("run-1")).thenReturn(after);

        FederatedSnapshotProjectionCaptureService service = new FederatedSnapshotProjectionCaptureService(
                snapshotCapture,
                manifestService,
                projectionService,
                searchService,
                evidenceStore,
                activationService);

        assertThatThrownBy(() -> service.captureAndProject("run-1"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("changed during discovery projection");
        verifyNoInteractions(evidenceStore, activationService);
    }

    private FederatedBoundedSnapshotManifest snapshot(
            long acceptedCount, int pageCount, String cursor, OffsetDateTime runUpdatedAt) {
        return new FederatedBoundedSnapshotManifest(
                FederatedCorpusManifestService.BOUNDED_SNAPSHOT_VERSION,
                FederatedBoundedSnapshotManifest.MODE,
                "DATA_GOV:" + SNAPSHOT_SHA,
                "run-1",
                FederatedSourceSystem.DATA_GOV,
                "data-gov-catalog-v4-v2",
                List.of("data-gov-catalog-v4-v2"),
                HarvestRunStatus.PAUSED,
                acceptedCount,
                acceptedCount,
                0,
                0,
                "DATA_GOV:first",
                "DATA_GOV:last",
                SNAPSHOT_SHA,
                OffsetDateTime.parse("2026-01-01T00:00:00Z"),
                OffsetDateTime.parse("2026-08-30T00:00:00Z"),
                100,
                pageCount,
                cursor,
                OffsetDateTime.parse("2026-08-30T17:00:00Z"),
                runUpdatedAt,
                OffsetDateTime.parse("2026-08-30T19:29:00Z"));
    }
}
