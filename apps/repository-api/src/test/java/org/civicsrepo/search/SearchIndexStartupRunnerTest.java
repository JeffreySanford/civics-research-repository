package org.civicsrepo.search;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.OffsetDateTime;
import java.util.Optional;
import org.civicsrepo.admin.CorpusProfileActivationService;
import org.civicsrepo.federation.CorpusProfile;
import org.civicsrepo.federation.CorpusProfileActivation;
import org.civicsrepo.generated.dto.SyncMode;
import org.civicsrepo.generated.dto.SyncSource;
import org.civicsrepo.repository.DiscoveryProjectionService;
import org.civicsrepo.sync.SyncProperties;
import org.junit.jupiter.api.Test;

class SearchIndexStartupRunnerTest {
    @Test
    void activatesCuratedDemoWhenNoProfileHasBeenPersisted() {
        CorpusProfileActivationService activationService = mock(CorpusProfileActivationService.class);
        DiscoveryProjectionService projectionService = mock(DiscoveryProjectionService.class);
        when(activationService.currentActivation()).thenReturn(Optional.empty());
        SearchIndexStartupRunner runner = new SearchIndexStartupRunner(
                activationService,
                projectionService,
                new SyncProperties(true, false, SyncMode.APPLY, SyncSource.TIGER_LINE));

        runner.run();

        verify(activationService).activate(CorpusProfile.CURATED_DEMO);
        verify(projectionService, never()).rehydrate(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void rehydratesPersistedActivationWithoutRebuildingSearchIndexes() {
        CorpusProfileActivationService activationService = mock(CorpusProfileActivationService.class);
        DiscoveryProjectionService projectionService = mock(DiscoveryProjectionService.class);
        CorpusProfileActivation activation = new CorpusProfileActivation(
                CorpusProfile.FEDERATED_1M,
                "a".repeat(64),
                1_000_181,
                OffsetDateTime.parse("2026-09-01T14:47:32Z"));
        when(activationService.currentActivation()).thenReturn(Optional.of(activation));
        SearchIndexStartupRunner runner = new SearchIndexStartupRunner(
                activationService,
                projectionService,
                new SyncProperties(true, false, SyncMode.APPLY, SyncSource.TIGER_LINE));

        runner.run();

        verify(projectionService).rehydrate(activation);
        verify(activationService, never()).activate(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void skipsProjectionWhenCliSyncOwnsTheRun() {
        CorpusProfileActivationService activationService = mock(CorpusProfileActivationService.class);
        DiscoveryProjectionService projectionService = mock(DiscoveryProjectionService.class);
        SearchIndexStartupRunner runner = new SearchIndexStartupRunner(
                activationService,
                projectionService,
                new SyncProperties(true, true, SyncMode.APPLY, SyncSource.TIGER_LINE));

        runner.run();

        verify(activationService, never()).currentActivation();
        verify(activationService, never()).activate(org.mockito.ArgumentMatchers.any());
        verify(projectionService, never()).rehydrate(org.mockito.ArgumentMatchers.any());
    }
}
