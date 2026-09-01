package org.civicsrepo.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.OffsetDateTime;
import java.util.List;
import org.civicsrepo.federation.CorpusProfile;
import org.civicsrepo.federation.FederatedCompositeCorpusManifest;
import org.civicsrepo.federation.FederatedCompositeCorpusManifestStore;
import org.civicsrepo.federation.FederatedCompositeCorpusProjectionService;
import org.civicsrepo.federation.FederatedCompositeCorpusSource;
import org.civicsrepo.federation.FederatedSourceSystem;
import org.civicsrepo.generated.dto.RepositorySource;
import org.civicsrepo.repository.DiscoveryProjectionService;
import org.civicsrepo.repository.DiscoveryProjectionService.ProjectionProgressListener;
import org.civicsrepo.repository.DiscoveryProjectionService.ProjectionState;
import org.junit.jupiter.api.Test;

class ExactCompositeCorpusActivationServiceTest {
    private static final String COMPOSITION_SHA = "a".repeat(64);
    private static final OffsetDateTime NOW = OffsetDateTime.parse("2026-09-01T14:47:32Z");

    @Test
    void activatesExactC2CompositionAndCompletesProgress() {
        FederatedCompositeCorpusManifestStore manifestStore = mock(FederatedCompositeCorpusManifestStore.class);
        FederatedCompositeCorpusProjectionService compositeProjectionService =
                mock(FederatedCompositeCorpusProjectionService.class);
        DiscoveryProjectionService discoveryProjectionService = mock(DiscoveryProjectionService.class);
        CorpusProfileActivationProgressTracker progressTracker = new CorpusProfileActivationProgressTracker();
        FederatedCompositeCorpusManifest manifest = manifest(500_000, 500_000);
        ProjectionState projected = new ProjectionState(RepositorySource.REPOSITORY, 1_000_181, NOW);

        when(manifestStore.findRecent(CorpusProfile.FEDERATED_1M, 1_000)).thenReturn(List.of(manifest));
        when(discoveryProjectionService.state()).thenReturn(projected);

        ExactCompositeCorpusActivationService service = new ExactCompositeCorpusActivationService(
                manifestStore,
                compositeProjectionService,
                discoveryProjectionService,
                progressTracker);

        ProjectionState result = service.activate(CorpusProfile.FEDERATED_1M);

        assertThat(result).isEqualTo(projected);
        verify(compositeProjectionService)
                .project(eq(COMPOSITION_SHA), any(ProjectionProgressListener.class));
        assertThat(progressTracker.current().phase())
                .isEqualTo(CorpusProfileActivationProgress.Phase.COMPLETED);
        assertThat(progressTracker.current().profile()).isEqualTo(CorpusProfile.FEDERATED_1M);
        assertThat(progressTracker.current().processedDocuments()).isEqualTo(1_000_181);
        assertThat(progressTracker.current().message()).contains("500,000 Data.gov + 500,000 DOE OSTI");
    }

    @Test
    void refusesMillionTotalWhenSourceQuotasDoNotMatchC2() {
        FederatedCompositeCorpusManifestStore manifestStore = mock(FederatedCompositeCorpusManifestStore.class);
        FederatedCompositeCorpusProjectionService compositeProjectionService =
                mock(FederatedCompositeCorpusProjectionService.class);
        DiscoveryProjectionService discoveryProjectionService = mock(DiscoveryProjectionService.class);
        CorpusProfileActivationProgressTracker progressTracker = new CorpusProfileActivationProgressTracker();

        when(manifestStore.findRecent(CorpusProfile.FEDERATED_1M, 1_000))
                .thenReturn(List.of(manifest(600_000, 400_000)));

        ExactCompositeCorpusActivationService service = new ExactCompositeCorpusActivationService(
                manifestStore,
                compositeProjectionService,
                discoveryProjectionService,
                progressTracker);

        assertThatThrownBy(() -> service.activate(CorpusProfile.FEDERATED_1M))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("500000 DATA_GOV + 500000 DOE_OSTI");
        verify(compositeProjectionService, never())
                .project(any(String.class), any(ProjectionProgressListener.class));
        assertThat(progressTracker.current().phase())
                .isEqualTo(CorpusProfileActivationProgress.Phase.FAILED);
    }

    private FederatedCompositeCorpusManifest manifest(long dataGovCount, long doeOstiCount) {
        return new FederatedCompositeCorpusManifest(
                "federated-composition/v1",
                FederatedCompositeCorpusManifest.MODE,
                CorpusProfile.FEDERATED_1M,
                List.of(
                        source(FederatedSourceSystem.DATA_GOV, dataGovCount, "b".repeat(64)),
                        source(FederatedSourceSystem.DOE_OSTI, doeOstiCount, "c".repeat(64))),
                dataGovCount + doeOstiCount,
                COMPOSITION_SHA,
                NOW);
    }

    private FederatedCompositeCorpusSource source(
            FederatedSourceSystem sourceSystem, long count, String sha) {
        return new FederatedCompositeCorpusSource(
                sourceSystem,
                count,
                sourceSystem.name() + ":" + sha,
                "run-" + sourceSystem.name().toLowerCase(),
                "adapter-v1",
                List.of("record-v1"),
                count,
                sha,
                NOW);
    }
}
