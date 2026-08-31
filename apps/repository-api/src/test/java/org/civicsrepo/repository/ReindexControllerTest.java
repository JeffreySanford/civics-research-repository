package org.civicsrepo.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.OffsetDateTime;
import org.civicsrepo.admin.CorpusProfileActivationProgress;
import org.civicsrepo.admin.CorpusProfileActivationProgress.Phase;
import org.civicsrepo.admin.CorpusProfileActivationService;
import org.civicsrepo.federation.CorpusProfile;
import org.civicsrepo.generated.dto.RepositorySource;
import org.civicsrepo.repository.DiscoveryProjectionService.ProjectionState;
import org.junit.jupiter.api.Test;

class ReindexControllerTest {
    private static final String PROJECTION_ID =
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    @Test
    void projectionStateIncludesTheCurrentDeterministicProjectionIdentity() {
        DiscoveryProjectionService projectionService = mock(DiscoveryProjectionService.class);
        CorpusProfileActivationService activationService = mock(CorpusProfileActivationService.class);
        OffsetDateTime rebuiltAt = OffsetDateTime.parse("2026-08-29T13:03:07-05:00");
        when(projectionService.state()).thenReturn(new ProjectionState(RepositorySource.REPOSITORY, 181, rebuiltAt));
        when(projectionService.currentProjectionId()).thenReturn(PROJECTION_ID);
        ReindexController controller = new ReindexController(projectionService, activationService);

        var response = controller.projectionState();

        assertThat(response.getSource()).isEqualTo(RepositorySource.REPOSITORY);
        assertThat(response.getObjectCount()).isEqualTo(181);
        assertThat(response.getRebuiltAt()).isEqualTo(rebuiltAt);
        assertThat(response.getProjectionId()).isEqualTo(PROJECTION_ID);
    }

    @Test
    void reindexWithoutRequestedProfileRebuildsThePersistedActiveProfile() {
        DiscoveryProjectionService projectionService = mock(DiscoveryProjectionService.class);
        CorpusProfileActivationService activationService = mock(CorpusProfileActivationService.class);
        OffsetDateTime rebuiltAt = OffsetDateTime.parse("2026-08-29T13:05:00-05:00");
        when(activationService.rebuildActiveProfile())
                .thenReturn(new ProjectionState(RepositorySource.REPOSITORY, 181, rebuiltAt));
        when(projectionService.currentProjectionId()).thenReturn(PROJECTION_ID);
        ReindexController controller = new ReindexController(projectionService, activationService);

        var response = controller.reindex(null);

        assertThat(response.getSource()).isEqualTo(RepositorySource.REPOSITORY);
        assertThat(response.getObjectCount()).isEqualTo(181);
        assertThat(response.getProjectionId()).isEqualTo(PROJECTION_ID);
        verify(activationService).rebuildActiveProfile();
    }

    @Test
    void requestedProfileIsExplicitlyActivated() {
        DiscoveryProjectionService projectionService = mock(DiscoveryProjectionService.class);
        CorpusProfileActivationService activationService = mock(CorpusProfileActivationService.class);
        OffsetDateTime rebuiltAt = OffsetDateTime.parse("2026-08-29T13:06:00-05:00");
        when(activationService.activate(CorpusProfile.FEDERATED_10K))
                .thenReturn(new ProjectionState(RepositorySource.REPOSITORY, 10_181, rebuiltAt));
        when(projectionService.currentProjectionId()).thenReturn(PROJECTION_ID);
        ReindexController controller = new ReindexController(projectionService, activationService);

        var response = controller.reindex(CorpusProfile.FEDERATED_10K);

        assertThat(response.getObjectCount()).isEqualTo(10_181);
        assertThat(response.getProjectionId()).isEqualTo(PROJECTION_ID);
        verify(activationService).activate(CorpusProfile.FEDERATED_10K);
    }

    @Test
    void exposesLiveActivationProgressWithoutStartingAnotherProjection() {
        DiscoveryProjectionService projectionService = mock(DiscoveryProjectionService.class);
        CorpusProfileActivationService activationService = mock(CorpusProfileActivationService.class);
        CorpusProfileActivationProgress progress = new CorpusProfileActivationProgress(
                "activation-1",
                CorpusProfile.FEDERATED_100K,
                Phase.PROJECTING,
                42_000,
                100_181L,
                41,
                OffsetDateTime.parse("2026-08-30T23:30:00Z"),
                OffsetDateTime.parse("2026-08-30T23:30:05Z"),
                null,
                5_000,
                8_400.0,
                "Building Solr and OpenSearch projections.");
        when(activationService.currentProgress()).thenReturn(progress);
        ReindexController controller = new ReindexController(projectionService, activationService);

        assertThat(controller.activationProgress()).isEqualTo(progress);
        verify(activationService).currentProgress();
    }
}
