package org.civicsrepo.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.civicsrepo.federation.CorpusProfile;
import org.civicsrepo.federation.CorpusProfileActivation;
import org.civicsrepo.federation.CorpusProfileActivationStore;
import org.civicsrepo.generated.dto.RepositorySource;
import org.civicsrepo.repository.DiscoveryProjectionService;
import org.civicsrepo.repository.DiscoveryProjectionService.ProjectionState;
import org.civicsrepo.repository.DiscoveryProjectionService.ProjectionTargetState;
import org.civicsrepo.search.SearchService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class CorpusProfileActivationServiceTest {
    private static final String PROJECTION_ID = "a".repeat(64);

    @Test
    void defaultsToCuratedDemoUntilAProfileHasBeenPersisted() {
        DiscoveryProjectionService projectionService = mock(DiscoveryProjectionService.class);
        SearchService searchService = mock(SearchService.class);
        CorpusProfileActivationStore store = mock(CorpusProfileActivationStore.class);
        when(store.findActive()).thenReturn(Optional.empty());

        CorpusProfileActivationService service =
                new CorpusProfileActivationService(projectionService, searchService, store);

        assertThat(service.currentProfile()).isEqualTo(CorpusProfile.CURATED_DEMO);
    }

    @Test
    void persistsProfileOnlyAfterEveryEnabledTargetMatchesProjectionIdentityAndCount() {
        DiscoveryProjectionService projectionService = mock(DiscoveryProjectionService.class);
        SearchService searchService = mock(SearchService.class);
        CorpusProfileActivationStore store = mock(CorpusProfileActivationStore.class);
        ProjectionState projected = new ProjectionState(
                RepositorySource.REPOSITORY, 10_181, OffsetDateTime.parse("2026-08-30T20:57:21Z"));
        when(searchService.fixtureDocuments()).thenReturn(List.of());
        when(projectionService.reindex(CorpusProfile.FEDERATED_10K, List.of())).thenReturn(projected);
        when(projectionService.currentProjectionId()).thenReturn(PROJECTION_ID);
        when(projectionService.currentTargetStates())
                .thenReturn(Map.of(
                        "discovery",
                        new ProjectionTargetState("discovery", true, true, PROJECTION_ID, 10_181, null),
                        "discovery-comparison",
                        new ProjectionTargetState(
                                "discovery-comparison", true, true, PROJECTION_ID, 10_181, null)));

        CorpusProfileActivationService service =
                new CorpusProfileActivationService(projectionService, searchService, store);

        service.activate(CorpusProfile.FEDERATED_10K);

        ArgumentCaptor<CorpusProfileActivation> activation = ArgumentCaptor.forClass(CorpusProfileActivation.class);
        verify(store).save(activation.capture());
        assertThat(activation.getValue().profile()).isEqualTo(CorpusProfile.FEDERATED_10K);
        assertThat(activation.getValue().projectionId()).isEqualTo(PROJECTION_ID);
        assertThat(activation.getValue().projectionObjectCount()).isEqualTo(10_181);
    }

    @Test
    void refusesToPersistWhenAnEnabledTargetDidNotComplete() {
        DiscoveryProjectionService projectionService = mock(DiscoveryProjectionService.class);
        SearchService searchService = mock(SearchService.class);
        CorpusProfileActivationStore store = mock(CorpusProfileActivationStore.class);
        ProjectionState projected = new ProjectionState(
                RepositorySource.REPOSITORY, 181, OffsetDateTime.parse("2026-08-30T21:00:00Z"));
        when(searchService.fixtureDocuments()).thenReturn(List.of());
        when(projectionService.reindex(CorpusProfile.CURATED_DEMO, List.of())).thenReturn(projected);
        when(projectionService.currentProjectionId()).thenReturn(PROJECTION_ID);
        when(projectionService.currentTargetStates())
                .thenReturn(Map.of(
                        "discovery",
                        new ProjectionTargetState("discovery", true, true, PROJECTION_ID, 181, null),
                        "discovery-comparison",
                        new ProjectionTargetState(
                                "discovery-comparison", true, false, null, 0, "simulated failure")));

        CorpusProfileActivationService service =
                new CorpusProfileActivationService(projectionService, searchService, store);

        assertThatThrownBy(() -> service.activate(CorpusProfile.CURATED_DEMO))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("discovery-comparison")
                .hasMessageContaining("simulated failure");
        verify(store, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void failedSwitchCompensatesByRebuildingThePreviouslyActiveProfile() {
        DiscoveryProjectionService projectionService = mock(DiscoveryProjectionService.class);
        SearchService searchService = mock(SearchService.class);
        CorpusProfileActivationStore store = mock(CorpusProfileActivationStore.class);
        String previousId = "1".repeat(64);
        String failedId = "2".repeat(64);
        String restoredId = "3".repeat(64);
        ProjectionState failedProjection = new ProjectionState(
                RepositorySource.REPOSITORY, 10_181, OffsetDateTime.parse("2026-08-30T21:01:00Z"));
        ProjectionState restoredProjection = new ProjectionState(
                RepositorySource.REPOSITORY, 181, OffsetDateTime.parse("2026-08-30T21:02:00Z"));
        CorpusProfileActivation previousActivation = new CorpusProfileActivation(
                CorpusProfile.CURATED_DEMO,
                previousId,
                181,
                OffsetDateTime.parse("2026-08-30T20:00:00Z"));

        when(store.findActive()).thenReturn(Optional.of(previousActivation));
        when(searchService.fixtureDocuments()).thenReturn(List.of());
        when(projectionService.reindex(CorpusProfile.FEDERATED_10K, List.of())).thenReturn(failedProjection);
        when(projectionService.reindex(CorpusProfile.CURATED_DEMO, List.of())).thenReturn(restoredProjection);
        when(projectionService.currentProjectionId())
                .thenReturn(previousId, failedId, failedId, restoredId);
        when(projectionService.currentTargetStates())
                .thenReturn(
                        Map.of(
                                "discovery",
                                new ProjectionTargetState("discovery", true, true, failedId, 10_181, null),
                                "discovery-comparison",
                                new ProjectionTargetState(
                                        "discovery-comparison", true, false, null, 181, "simulated failure")),
                        Map.of(
                                "discovery",
                                new ProjectionTargetState("discovery", true, true, restoredId, 181, null),
                                "discovery-comparison",
                                new ProjectionTargetState(
                                        "discovery-comparison", true, true, restoredId, 181, null)));

        CorpusProfileActivationService service =
                new CorpusProfileActivationService(projectionService, searchService, store);

        assertThatThrownBy(() -> service.activate(CorpusProfile.FEDERATED_10K))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("simulated failure");

        verify(projectionService).reindex(CorpusProfile.CURATED_DEMO, List.of());
        ArgumentCaptor<CorpusProfileActivation> saved = ArgumentCaptor.forClass(CorpusProfileActivation.class);
        verify(store, times(1)).save(saved.capture());
        assertThat(saved.getValue().profile()).isEqualTo(CorpusProfile.CURATED_DEMO);
        assertThat(saved.getValue().projectionId()).isEqualTo(restoredId);
        assertThat(saved.getValue().projectionObjectCount()).isEqualTo(181);
    }
}
