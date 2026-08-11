package org.civicsrepo.sync;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.context.ConfigurableApplicationContext;
import org.junit.jupiter.api.Test;

class SyncServiceTest {
    @Test
    void dryRunReturnsPlannedActions() {
        SyncService syncService = new SyncService(new TestSyncJobStore());

        SyncJob job = syncService.runSync(new SyncRequest(SyncMode.DRY_RUN, SyncSource.TIGER_LINE));

        assertThat(job.status()).isEqualTo(SyncStatus.DRY_RUN_COMPLETE);
        assertThat(job.actions()).extracting(SyncAction::actionType).contains("UPSERT_ITEM", "VERIFY_INDEX");
    }

    @Test
    void completedJobsCanBeListedFromStore() {
        TestSyncJobStore store = new TestSyncJobStore();
        SyncService syncService = new SyncService(store);

        SyncJob job = syncService.runSync(new SyncRequest(SyncMode.DRY_RUN, SyncSource.TIGER_LINE));

        assertThat(syncService.findRecentJobs()).containsExactly(job);
    }

    @Test
    void cliRunnerRunsSyncAndClosesApplicationContext() {
        TestSyncJobStore store = new TestSyncJobStore();
        SyncService syncService = new SyncService(store);
        ConfigurableApplicationContext applicationContext = mock(ConfigurableApplicationContext.class);
        CliSyncRunner runner = new CliSyncRunner(
                applicationContext,
                new SyncProperties(false, true, SyncMode.DRY_RUN, SyncSource.TIGER_LINE),
                syncService);

        runner.run();

        assertThat(syncService.findRecentJobs())
                .singleElement()
                .satisfies(job -> {
                    assertThat(job.mode()).isEqualTo(SyncMode.DRY_RUN);
                    assertThat(job.source()).isEqualTo(SyncSource.TIGER_LINE);
                    assertThat(job.status()).isEqualTo(SyncStatus.DRY_RUN_COMPLETE);
                });
        verify(applicationContext).close();
    }

    @Test
    void cliRunnerDoesNothingWhenCliModeIsDisabled() {
        TestSyncJobStore store = new TestSyncJobStore();
        SyncService syncService = new SyncService(store);
        ConfigurableApplicationContext applicationContext = mock(ConfigurableApplicationContext.class);
        CliSyncRunner runner = new CliSyncRunner(
                applicationContext,
                new SyncProperties(false, false, SyncMode.DRY_RUN, SyncSource.TIGER_LINE),
                syncService);

        runner.run();

        assertThat(syncService.findRecentJobs()).isEmpty();
        verifyNoInteractions(applicationContext);
    }

    @Test
    void startupRunnerSkipsWhenCliModeIsEnabled() {
        TestSyncJobStore store = new TestSyncJobStore();
        SyncService syncService = new SyncService(store);
        StartupSyncRunner runner =
                new StartupSyncRunner(new SyncProperties(true, true, SyncMode.DRY_RUN, SyncSource.TIGER_LINE), syncService);

        runner.run();

        assertThat(syncService.findRecentJobs()).isEmpty();
    }

    private static final class TestSyncJobStore implements SyncJobStore {
        private final List<SyncJob> jobs = new ArrayList<>();

        @Override
        public SyncJob save(SyncJob job) {
            jobs.add(0, job);
            return job;
        }

        @Override
        public Optional<SyncJob> findById(String id) {
            return jobs.stream().filter((job) -> job.id().equals(id)).findFirst();
        }

        @Override
        public List<SyncJob> findRecent(int limit) {
            return jobs.stream().limit(limit).toList();
        }
    }
}
