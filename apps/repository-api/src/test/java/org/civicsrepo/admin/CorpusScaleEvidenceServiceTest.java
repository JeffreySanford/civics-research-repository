package org.civicsrepo.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.civicsrepo.federation.CorpusProfile;
import org.civicsrepo.federation.CorpusProfileActivation;
import org.civicsrepo.federation.CorpusStorageMeasurement;
import org.civicsrepo.federation.CorpusStorageMeasurementStore;
import org.civicsrepo.federation.DeploymentTopology;
import org.civicsrepo.federation.FederatedMetadataCatalog;
import org.civicsrepo.federation.FederatedSourceSystem;
import org.civicsrepo.generated.dto.RepositorySource;
import org.civicsrepo.repository.DiscoveryProjectionService;
import org.civicsrepo.repository.DiscoveryProjectionService.ProjectionState;
import org.civicsrepo.repository.DiscoveryProjectionService.ProjectionTargetState;
import org.junit.jupiter.api.Test;

class CorpusScaleEvidenceServiceTest {
    private static final String PROJECTION_ID =
            "125fc791065fd8c68806f62a52c2203c2ce74a083954ce469f3e0cd627015024";
    private static final OffsetDateTime NOW = OffsetDateTime.parse("2026-08-31T01:11:17.904261Z");

    @Test
    void verifiesTheProvenHundredKCheckpointWithoutMutation() {
        FederatedMetadataCatalog metadataCatalog = mock(FederatedMetadataCatalog.class);
        CorpusProfileActivationService activationService = mock(CorpusProfileActivationService.class);
        DiscoveryProjectionService projectionService = mock(DiscoveryProjectionService.class);
        CorpusStorageMeasurementStore measurementStore = mock(CorpusStorageMeasurementStore.class);

        when(metadataCatalog.count(FederatedSourceSystem.DATA_GOV)).thenReturn(100_000L);
        when(activationService.currentProfile()).thenReturn(CorpusProfile.FEDERATED_100K);
        when(activationService.currentActivation())
                .thenReturn(Optional.of(new CorpusProfileActivation(
                        CorpusProfile.FEDERATED_100K, PROJECTION_ID, 100_181, NOW.minusSeconds(8))));
        when(projectionService.state()).thenReturn(new ProjectionState(RepositorySource.REPOSITORY, 100_181, NOW));
        when(projectionService.currentProjectionId()).thenReturn(PROJECTION_ID);
        when(projectionService.currentTargetStates())
                .thenReturn(Map.of(
                        "discovery",
                        new ProjectionTargetState("discovery", true, true, PROJECTION_ID, 100_181, null),
                        "discovery-comparison",
                        new ProjectionTargetState(
                                "discovery-comparison", true, true, PROJECTION_ID, 100_181, null)));
        when(measurementStore.findRecentByProfile(CorpusProfile.FEDERATED_100K, 1))
                .thenReturn(List.of(measurement(PROJECTION_ID, 100_181, 100_000)));

        CorpusScaleEvidenceReport report = new CorpusScaleEvidenceService(
                        metadataCatalog, activationService, projectionService, measurementStore)
                .verify(CorpusProfile.FEDERATED_100K);

        assertThat(report.valid()).isTrue();
        assertThat(report.violations()).isEmpty();
        assertThat(report.retainedFederatedRecordCount()).isEqualTo(100_000);
        assertThat(report.currentProjectionObjectCount()).isEqualTo(100_181);
        assertThat(report.currentProjectionId()).isEqualTo(PROJECTION_ID);
        assertThat(report.targetParity()).isTrue();
        assertThat(report.storageEvidencePresent()).isTrue();
        assertThat(report.storageProjectionId()).isEqualTo(PROJECTION_ID);
    }

    @Test
    void reportsProfileProjectionParityAndStorageDriftWithoutRepairingIt() {
        FederatedMetadataCatalog metadataCatalog = mock(FederatedMetadataCatalog.class);
        CorpusProfileActivationService activationService = mock(CorpusProfileActivationService.class);
        DiscoveryProjectionService projectionService = mock(DiscoveryProjectionService.class);
        CorpusStorageMeasurementStore measurementStore = mock(CorpusStorageMeasurementStore.class);
        String staleProjectionId = "a".repeat(64);

        when(metadataCatalog.count(FederatedSourceSystem.DATA_GOV)).thenReturn(99_999L);
        when(activationService.currentProfile()).thenReturn(CorpusProfile.FEDERATED_10K);
        when(activationService.currentActivation())
                .thenReturn(Optional.of(new CorpusProfileActivation(
                        CorpusProfile.FEDERATED_10K, staleProjectionId, 10_181, NOW.minusMinutes(5))));
        when(projectionService.state()).thenReturn(new ProjectionState(RepositorySource.REPOSITORY, 100_181, NOW));
        when(projectionService.currentProjectionId()).thenReturn(PROJECTION_ID);
        when(projectionService.currentTargetStates())
                .thenReturn(Map.of(
                        "discovery",
                        new ProjectionTargetState("discovery", true, true, PROJECTION_ID, 100_181, null),
                        "discovery-comparison",
                        new ProjectionTargetState(
                                "discovery-comparison", true, true, staleProjectionId, 99_999, null)));
        when(measurementStore.findRecentByProfile(CorpusProfile.FEDERATED_100K, 1))
                .thenReturn(List.of(measurement(staleProjectionId, 100_000, 99_999)));

        CorpusScaleEvidenceReport report = new CorpusScaleEvidenceService(
                        metadataCatalog, activationService, projectionService, measurementStore)
                .verify(CorpusProfile.FEDERATED_100K);

        assertThat(report.valid()).isFalse();
        assertThat(report.targetParity()).isFalse();
        assertThat(report.violations())
                .anyMatch(message -> message.contains("below the profile target"))
                .anyMatch(message -> message.contains("not active"))
                .anyMatch(message -> message.contains("Persisted activation belongs"))
                .anyMatch(message -> message.contains("enabled discovery targets"))
                .anyMatch(message -> message.contains("storage measurement projection ID"));
    }

    private CorpusStorageMeasurement measurement(String projectionId, long projected, long retained) {
        return new CorpusStorageMeasurement(
                "measurement-100k",
                CorpusProfile.FEDERATED_100K,
                DeploymentTopology.DOCKER_COMPOSE,
                projected,
                retained,
                projectionId,
                391_091_891L,
                1_073_739_747L,
                46_972_408L,
                43_235_010L,
                NOW);
    }
}
