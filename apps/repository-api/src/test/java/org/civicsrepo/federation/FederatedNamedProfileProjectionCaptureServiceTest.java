package org.civicsrepo.federation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.OffsetDateTime;
import java.util.List;
import org.civicsrepo.admin.CorpusProfileActivationService;
import org.civicsrepo.generated.dto.RepositorySource;
import org.civicsrepo.repository.DiscoveryProjectionService;
import org.civicsrepo.repository.DiscoveryProjectionService.ProjectionState;
import org.civicsrepo.search.SearchService;
import org.junit.jupiter.api.Test;

class FederatedNamedProfileProjectionCaptureServiceTest {
    private static final String SNAPSHOT_SHA = "a".repeat(64);
    private static final String PROJECTION_ID = "b".repeat(64);
    private static final OffsetDateTime UPDATED_AT = OffsetDateTime.parse("2026-08-30T20:00:00Z");

    @Test
    void explicit100kProfileUsesTheExact100kSnapshotPrefixEvenWhenTheRunRetainedMore() {
        FederatedBoundedSnapshotCaptureService snapshotCapture = mock(FederatedBoundedSnapshotCaptureService.class);
        FederatedCorpusManifestService manifestService = mock(FederatedCorpusManifestService.class);
        DiscoveryProjectionService projectionService = mock(DiscoveryProjectionService.class);
        SearchService searchService = mock(SearchService.class);
        FederatedSnapshotProjectionEvidenceStore evidenceStore = mock(FederatedSnapshotProjectionEvidenceStore.class);
        CorpusProfileActivationService activationService = mock(CorpusProfileActivationService.class);
        FederatedBoundedSnapshotManifest snapshot = snapshot100k();
        ProjectionState projected = new ProjectionState(
                RepositorySource.REPOSITORY,
                100_181,
                OffsetDateTime.parse("2026-08-30T20:03:00Z"));

        when(snapshotCapture.capture("run-100k", 100_000)).thenReturn(snapshot);
        when(searchService.fixtureDocuments()).thenReturn(List.of());
        when(projectionService.reindex(CorpusProfile.FEDERATED_100K, List.of())).thenReturn(projected);
        when(projectionService.currentProjectionId()).thenReturn(PROJECTION_ID);
        when(manifestService.generateBoundedSnapshot("run-100k", 100_000)).thenReturn(snapshot);

        FederatedSnapshotProjectionCaptureService service = new FederatedSnapshotProjectionCaptureService(
                snapshotCapture,
                manifestService,
                projectionService,
                searchService,
                evidenceStore,
                activationService);

        FederatedSnapshotProjectionEvidence evidence =
                service.captureAndProject("run-100k", CorpusProfile.FEDERATED_100K);

        assertThat(evidence.snapshotRetainedRecordCount()).isEqualTo(100_000);
        assertThat(evidence.projectionObjectCount()).isEqualTo(100_181);
        verify(snapshotCapture).capture("run-100k", 100_000);
        verify(manifestService).generateBoundedSnapshot("run-100k", 100_000);
        verify(projectionService).reindex(CorpusProfile.FEDERATED_100K, List.of());
        verify(activationService).recordSuccessfulProjection(CorpusProfile.FEDERATED_100K, projected);
        verify(evidenceStore).save(evidence);
    }

    private FederatedBoundedSnapshotManifest snapshot100k() {
        return new FederatedBoundedSnapshotManifest(
                FederatedCorpusManifestService.BOUNDED_SNAPSHOT_VERSION,
                FederatedBoundedSnapshotManifest.MODE,
                "DATA_GOV:" + SNAPSHOT_SHA,
                "run-100k",
                FederatedSourceSystem.DATA_GOV,
                "data-gov-v1",
                List.of("data-gov-v1"),
                HarvestRunStatus.PAUSED,
                100_000,
                100_037,
                0,
                0,
                "DATA_GOV:first",
                "DATA_GOV:last-in-prefix",
                SNAPSHOT_SHA,
                OffsetDateTime.parse("2026-01-01T00:00:00Z"),
                OffsetDateTime.parse("2026-08-30T00:00:00Z"),
                100,
                1_001,
                "100100",
                OffsetDateTime.parse("2026-08-30T17:00:00Z"),
                UPDATED_AT,
                OffsetDateTime.parse("2026-08-30T20:01:00Z"));
    }
}
