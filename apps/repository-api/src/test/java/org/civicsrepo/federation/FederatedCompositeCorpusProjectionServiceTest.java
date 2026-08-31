package org.civicsrepo.federation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.civicsrepo.admin.CorpusProfileActivationService;
import org.civicsrepo.generated.dto.RepositorySource;
import org.civicsrepo.repository.DiscoveryProjectionService;
import org.civicsrepo.repository.DiscoveryProjectionService.ProjectionState;
import org.junit.jupiter.api.Test;

class FederatedCompositeCorpusProjectionServiceTest {
    private static final String COMPOSITION_SHA = "c".repeat(64);
    private static final String DATA_SHA = "a".repeat(64);
    private static final String OSTI_SHA = "b".repeat(64);
    private static final String PROJECTION_ID = "d".repeat(64);
    private static final OffsetDateTime CAPTURED_AT = OffsetDateTime.parse("2026-08-31T20:00:00Z");

    @Test
    void linksOnlyAnExactStableCompositeProjection() {
        FederatedCompositeCorpusManifestStore manifestStore = mock(FederatedCompositeCorpusManifestStore.class);
        FederatedCorpusManifestService corpusManifestService = mock(FederatedCorpusManifestService.class);
        DiscoveryProjectionService projectionService = mock(DiscoveryProjectionService.class);
        CorpusProfileActivationService activationService = mock(CorpusProfileActivationService.class);
        FederatedCompositeCorpusProjectionEvidenceStore evidenceStore =
                mock(FederatedCompositeCorpusProjectionEvidenceStore.class);
        FederatedCompositeCorpusManifest composition = composition();
        FederatedBoundedSnapshotManifest dataSnapshot = snapshot(
                FederatedSourceSystem.DATA_GOV, "data-run", DATA_SHA, 500_000);
        FederatedBoundedSnapshotManifest ostiSnapshot = snapshot(
                FederatedSourceSystem.DOE_OSTI, "osti-run", OSTI_SHA, 500_000);
        OffsetDateTime rebuiltAt = OffsetDateTime.parse("2026-08-31T20:30:00Z");
        ProjectionState projected = new ProjectionState(RepositorySource.REPOSITORY, 1_000_181, rebuiltAt);

        when(manifestStore.findByCompositionSha256(COMPOSITION_SHA)).thenReturn(Optional.of(composition));
        when(corpusManifestService.generateBoundedSnapshot("data-run", 500_000L)).thenReturn(dataSnapshot);
        when(corpusManifestService.generateBoundedSnapshot("osti-run", 500_000L)).thenReturn(ostiSnapshot);
        when(projectionService.reindex(composition)).thenReturn(projected);
        when(projectionService.currentProjectionId()).thenReturn(PROJECTION_ID);

        FederatedCompositeCorpusProjectionService service = new FederatedCompositeCorpusProjectionService(
                manifestStore,
                corpusManifestService,
                projectionService,
                activationService,
                evidenceStore);

        FederatedCompositeCorpusProjectionEvidence evidence = service.project(COMPOSITION_SHA);

        assertThat(evidence.compositionSha256()).isEqualTo(COMPOSITION_SHA);
        assertThat(evidence.federatedRecordCount()).isEqualTo(1_000_000);
        assertThat(evidence.projectionId()).isEqualTo(PROJECTION_ID);
        assertThat(evidence.projectionObjectCount()).isEqualTo(1_000_181);
        verify(activationService).recordSuccessfulProjection(CorpusProfile.FEDERATED_1M, projected);
        verify(evidenceStore).save(evidence);
    }

    @Test
    void refusesToLinkWhenAComposedSourceChangesDuringProjection() {
        FederatedCompositeCorpusManifestStore manifestStore = mock(FederatedCompositeCorpusManifestStore.class);
        FederatedCorpusManifestService corpusManifestService = mock(FederatedCorpusManifestService.class);
        DiscoveryProjectionService projectionService = mock(DiscoveryProjectionService.class);
        CorpusProfileActivationService activationService = mock(CorpusProfileActivationService.class);
        FederatedCompositeCorpusProjectionEvidenceStore evidenceStore =
                mock(FederatedCompositeCorpusProjectionEvidenceStore.class);
        FederatedCompositeCorpusManifest composition = composition();
        FederatedBoundedSnapshotManifest dataBefore = snapshot(
                FederatedSourceSystem.DATA_GOV, "data-run", DATA_SHA, 500_000);
        FederatedBoundedSnapshotManifest dataAfter = snapshot(
                FederatedSourceSystem.DATA_GOV, "data-run", "e".repeat(64), 500_000);
        FederatedBoundedSnapshotManifest osti = snapshot(
                FederatedSourceSystem.DOE_OSTI, "osti-run", OSTI_SHA, 500_000);
        ProjectionState projected = new ProjectionState(
                RepositorySource.REPOSITORY,
                1_000_181,
                OffsetDateTime.parse("2026-08-31T20:31:00Z"));

        when(manifestStore.findByCompositionSha256(COMPOSITION_SHA)).thenReturn(Optional.of(composition));
        when(corpusManifestService.generateBoundedSnapshot("data-run", 500_000L))
                .thenReturn(dataBefore, dataAfter);
        when(corpusManifestService.generateBoundedSnapshot("osti-run", 500_000L)).thenReturn(osti);
        when(projectionService.reindex(composition)).thenReturn(projected);
        when(projectionService.currentProjectionId()).thenReturn(PROJECTION_ID);

        FederatedCompositeCorpusProjectionService service = new FederatedCompositeCorpusProjectionService(
                manifestStore,
                corpusManifestService,
                projectionService,
                activationService,
                evidenceStore);

        assertThatThrownBy(() -> service.project(COMPOSITION_SHA))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("changed after projection")
                .hasMessageContaining("DATA_GOV");
        verifyNoInteractions(activationService, evidenceStore);
    }

    @Test
    void refusesUnknownCompositionIdentityBeforeProjection() {
        FederatedCompositeCorpusManifestStore manifestStore = mock(FederatedCompositeCorpusManifestStore.class);
        FederatedCorpusManifestService corpusManifestService = mock(FederatedCorpusManifestService.class);
        DiscoveryProjectionService projectionService = mock(DiscoveryProjectionService.class);
        CorpusProfileActivationService activationService = mock(CorpusProfileActivationService.class);
        FederatedCompositeCorpusProjectionEvidenceStore evidenceStore =
                mock(FederatedCompositeCorpusProjectionEvidenceStore.class);
        when(manifestStore.findByCompositionSha256(COMPOSITION_SHA)).thenReturn(Optional.empty());

        FederatedCompositeCorpusProjectionService service = new FederatedCompositeCorpusProjectionService(
                manifestStore,
                corpusManifestService,
                projectionService,
                activationService,
                evidenceStore);

        assertThatThrownBy(() -> service.project(COMPOSITION_SHA))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Unknown composite corpus");
        verifyNoInteractions(corpusManifestService, projectionService, activationService, evidenceStore);
    }

    private FederatedCompositeCorpusManifest composition() {
        return new FederatedCompositeCorpusManifest(
                FederatedCompositeCorpusManifestService.COMPOSITION_VERSION,
                FederatedCompositeCorpusManifest.MODE,
                CorpusProfile.FEDERATED_1M,
                List.of(
                        source(FederatedSourceSystem.DATA_GOV, "data-run", DATA_SHA),
                        source(FederatedSourceSystem.DOE_OSTI, "osti-run", OSTI_SHA)),
                1_000_000,
                COMPOSITION_SHA,
                CAPTURED_AT);
    }

    private FederatedCompositeCorpusSource source(
            FederatedSourceSystem sourceSystem, String runId, String sha) {
        return new FederatedCompositeCorpusSource(
                sourceSystem,
                500_000,
                sourceSystem.name() + ":" + sha,
                runId,
                "adapter-v1",
                List.of("adapter-v1"),
                500_000,
                sha,
                CAPTURED_AT);
    }

    private FederatedBoundedSnapshotManifest snapshot(
            FederatedSourceSystem sourceSystem, String runId, String sha, long count) {
        return new FederatedBoundedSnapshotManifest(
                FederatedCorpusManifestService.BOUNDED_SNAPSHOT_VERSION,
                FederatedBoundedSnapshotManifest.MODE,
                sourceSystem.name() + ":" + sha,
                runId,
                sourceSystem,
                "adapter-v1",
                List.of("adapter-v1"),
                HarvestRunStatus.PAUSED,
                count,
                count,
                0,
                0,
                sourceSystem.name() + ":first",
                sourceSystem.name() + ":last",
                sha,
                null,
                null,
                100,
                5_000,
                "cursor",
                CAPTURED_AT.minusHours(1),
                CAPTURED_AT,
                CAPTURED_AT.plusMinutes(1));
    }
}
