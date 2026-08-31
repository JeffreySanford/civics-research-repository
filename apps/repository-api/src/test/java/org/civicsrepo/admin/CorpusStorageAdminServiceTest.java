package org.civicsrepo.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import java.time.OffsetDateTime;
import java.util.List;
import org.civicsrepo.federation.CorpusProfile;
import org.civicsrepo.federation.CorpusStorageCaptureService;
import org.civicsrepo.federation.CorpusStorageMeasurement;
import org.civicsrepo.federation.CorpusStorageMeasurementStore;
import org.civicsrepo.federation.DeploymentTopology;
import org.junit.jupiter.api.Test;

class CorpusStorageAdminServiceTest {
    private static final CorpusStorageMeasurement CURATED_MEASUREMENT = new CorpusStorageMeasurement(
            "measurement-1",
            CorpusProfile.CURATED_DEMO,
            DeploymentTopology.DOCKER_COMPOSE,
            181,
            0,
            "a".repeat(64),
            12_000L,
            34_000L,
            56_000L,
            null,
            OffsetDateTime.parse("2026-08-29T23:30:00Z"));

    @Test
    void exposesThePersistedActiveProfileAndPlannedScaleTiersWithoutInventingMeasurements() {
        CorpusStorageMeasurementStore store = mock(CorpusStorageMeasurementStore.class);
        CorpusStorageCaptureService captureService = mock(CorpusStorageCaptureService.class);
        CorpusProfileActivationService activationService = mock(CorpusProfileActivationService.class);
        given(activationService.currentProfile()).willReturn(CorpusProfile.CURATED_DEMO);
        given(store.findRecent(50)).willReturn(List.of(CURATED_MEASUREMENT));
        given(store.findRecentByProfile(CorpusProfile.CURATED_DEMO, 1))
                .willReturn(List.of(CURATED_MEASUREMENT));
        given(store.findRecentByProfile(CorpusProfile.FEDERATED_10K, 1)).willReturn(List.of());
        given(store.findRecentByProfile(CorpusProfile.FEDERATED_100K, 1)).willReturn(List.of());
        given(store.findRecentByProfile(CorpusProfile.FEDERATED_1M, 1)).willReturn(List.of());
        given(store.findRecentByProfile(CorpusProfile.FULL, 1)).willReturn(List.of());

        CorpusStorageAdminService service =
                new CorpusStorageAdminService(store, captureService, activationService, "DOCKER_COMPOSE");

        var overview = service.overview();

        assertThat(overview.getActiveProfile().getValue()).isEqualTo("CURATED_DEMO");
        assertThat(overview.getProfiles()).hasSize(5);
        assertThat(overview.getProfiles().get(0).getLabel()).isEqualTo("Curated demo");
        assertThat(overview.getProfiles().get(0).getActive()).isTrue();
        assertThat(overview.getProfiles().get(0).getLatestMeasurement().getTotalMeasuredLocalBytes())
                .isEqualTo(102_000L);

        var million = overview.getProfiles().stream()
                .filter((profile) -> "FEDERATED_1M".equals(profile.getProfile().getValue()))
                .findFirst()
                .orElseThrow();
        assertThat(million.getLabel()).isEqualTo("Federated 1M");
        assertThat(million.getTargetFederatedRecordCount()).isEqualTo(1_000_000L);
        assertThat(million.getLatestMeasurement()).isNull();
    }

    @Test
    void capturesOnlyThePersistedActiveProfileAndStandaloneTopology() {
        CorpusStorageMeasurementStore store = mock(CorpusStorageMeasurementStore.class);
        CorpusStorageCaptureService captureService = mock(CorpusStorageCaptureService.class);
        CorpusProfileActivationService activationService = mock(CorpusProfileActivationService.class);
        given(activationService.currentProfile()).willReturn(CorpusProfile.CURATED_DEMO);
        given(captureService.capture(CorpusProfile.CURATED_DEMO, DeploymentTopology.DOCKER_COMPOSE))
                .willReturn(CURATED_MEASUREMENT);

        CorpusStorageAdminService service =
                new CorpusStorageAdminService(store, captureService, activationService, "DOCKER_COMPOSE");

        var captured = service.captureCurrent();

        assertThat(captured.getProfile().getValue()).isEqualTo("CURATED_DEMO");
        assertThat(captured.getOpenSearchIndexBytes()).isNull();
        assertThat(captured.getTotalMeasuredLocalBytes()).isEqualTo(102_000L);
        verify(captureService).capture(CorpusProfile.CURATED_DEMO, DeploymentTopology.DOCKER_COMPOSE);
    }
}
