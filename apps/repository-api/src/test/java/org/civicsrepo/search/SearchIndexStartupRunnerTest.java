package org.civicsrepo.search;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import org.civicsrepo.admin.CorpusProfileActivationService;
import org.civicsrepo.federation.CorpusProfile;
import org.civicsrepo.generated.dto.SyncMode;
import org.civicsrepo.generated.dto.SyncSource;
import org.civicsrepo.sync.SyncProperties;
import org.junit.jupiter.api.Test;

class SearchIndexStartupRunnerTest {
    @Test
    void activatesCuratedDemoForNormalApplicationStartup() {
        CorpusProfileActivationService activationService = mock(CorpusProfileActivationService.class);
        SearchIndexStartupRunner runner = new SearchIndexStartupRunner(
                activationService,
                new SyncProperties(true, false, SyncMode.APPLY, SyncSource.TIGER_LINE));

        runner.run();

        verify(activationService).activate(CorpusProfile.CURATED_DEMO);
    }

    @Test
    void skipsProjectionWhenCliSyncOwnsTheRun() {
        CorpusProfileActivationService activationService = mock(CorpusProfileActivationService.class);
        SearchIndexStartupRunner runner = new SearchIndexStartupRunner(
                activationService,
                new SyncProperties(true, true, SyncMode.APPLY, SyncSource.TIGER_LINE));

        runner.run();

        verify(activationService, never()).activate(org.mockito.ArgumentMatchers.any());
    }
}
