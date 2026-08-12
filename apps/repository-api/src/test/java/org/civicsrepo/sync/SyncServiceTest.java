package org.civicsrepo.sync;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.civicsrepo.dspace.DspaceItemDiffPlanner;
import org.civicsrepo.dspace.DspaceItemPayload;
import org.civicsrepo.dspace.DspaceItemPayloadMapper;
import org.civicsrepo.dspace.DspaceItemStateReader;
import org.civicsrepo.sources.TigerLineMetadataAdapter;
import org.junit.jupiter.api.Test;
import org.springframework.context.ConfigurableApplicationContext;

class SyncServiceTest {
    @Test
    void dryRunReturnsPlannedActions() {
        SyncService syncService = newSyncService(new TestSyncJobStore());

        SyncJob job = syncService.runSync(new SyncRequest(SyncMode.DRY_RUN, SyncSource.TIGER_LINE));

        assertThat(job.status()).isEqualTo(SyncStatus.DRY_RUN_COMPLETE);
        assertThat(job.actions())
                .extracting(SyncAction::actionType)
                .contains("UPSERT_ITEM", "UPSERT_FILE_MANIFEST", "UPSERT_CITATION", "VERIFY_INDEX");
        assertThat(job.actions())
                .anySatisfy(action -> {
                    assertThat(action.actionType()).isEqualTo("UPSERT_ITEM");
                    assertThat(action.detail()).contains("DSpace item payload");
                    assertThat(action.detail()).contains("16 metadata fields");
                    assertThat(action.detail()).contains("3 bitstream manifest entries");
                });
    }

    @Test
    void completedJobsCanBeListedFromStore() {
        TestSyncJobStore store = new TestSyncJobStore();
        SyncService syncService = newSyncService(store);

        SyncJob job = syncService.runSync(new SyncRequest(SyncMode.DRY_RUN, SyncSource.TIGER_LINE));

        assertThat(syncService.findRecentJobs()).containsExactly(job);
    }

    @Test
    void failedSyncIsPersistedWithFailureAction() {
        TestSyncJobStore store = new TestSyncJobStore();
        SyncService syncService = new SyncService(
                store,
                (request, actions) -> {
                    throw new IllegalStateException("DSpace is unavailable.");
                },
                new DspaceItemPayloadMapper(),
                new DspaceItemDiffPlanner((sourceIdentifier) -> Optional.empty()),
                List.of(new TigerLineMetadataAdapter()));

        SyncJob job = syncService.runSync(new SyncRequest(SyncMode.APPLY, SyncSource.TIGER_LINE));

        assertThat(job.status()).isEqualTo(SyncStatus.FAILED);
        assertThat(job.completedAt()).isNotNull();
        assertThat(job.actions())
                .anySatisfy(action -> {
                    assertThat(action.actionType()).isEqualTo("SYNC_FAILED");
                    assertThat(action.detail()).isEqualTo("DSpace is unavailable.");
                });
        assertThat(syncService.findRecentJobs()).containsExactly(job);
    }

    @Test
    void cliRunnerRunsSyncAndClosesApplicationContext() {
        TestSyncJobStore store = new TestSyncJobStore();
        SyncService syncService = newSyncService(store);
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
    void diffModePlansCreateWhenRepositoryItemDoesNotExist() {
        SyncService syncService = newSyncService(new TestSyncJobStore());

        SyncJob job = syncService.runSync(new SyncRequest(SyncMode.DIFF, SyncSource.TIGER_LINE));

        assertThat(job.status()).isEqualTo(SyncStatus.DIFF_COMPLETE);
        assertThat(job.actions())
                .extracting(SyncAction::actionType)
                .contains("VERIFY_COMMUNITY", "VERIFY_COLLECTION", "CREATE_ITEM", "VERIFY_INDEX");
    }

    @Test
    void diffModePlansSkipWhenRepositoryItemMatchesSourcePayload() {
        DspaceItemPayload sourcePayload =
                new DspaceItemPayloadMapper().toItemPayload(new TigerLineMetadataAdapter().firstVisualSlice());
        SyncService syncService = newSyncService(new TestSyncJobStore(), (sourceIdentifier) -> Optional.of(sourcePayload));

        SyncJob job = syncService.runSync(new SyncRequest(SyncMode.DIFF, SyncSource.TIGER_LINE));

        assertThat(job.status()).isEqualTo(SyncStatus.DIFF_COMPLETE);
        assertThat(job.actions()).extracting(SyncAction::actionType).contains("SKIP_ITEM");
    }

    @Test
    void diffModePlansUpdateWhenRepositoryItemDiffersFromSourcePayload() {
        DspaceItemPayload sourcePayload =
                new DspaceItemPayloadMapper().toItemPayload(new TigerLineMetadataAdapter().firstVisualSlice());
        DspaceItemPayload changedPayload = new DspaceItemPayload(
                sourcePayload.name(), sourcePayload.type(), sourcePayload.metadata(), List.of());
        SyncService syncService = newSyncService(new TestSyncJobStore(), (sourceIdentifier) -> Optional.of(changedPayload));

        SyncJob job = syncService.runSync(new SyncRequest(SyncMode.DIFF, SyncSource.TIGER_LINE));

        assertThat(job.status()).isEqualTo(SyncStatus.DIFF_COMPLETE);
        assertThat(job.actions()).extracting(SyncAction::actionType).contains("UPDATE_ITEM");
    }

    @Test
    void cliRunnerDoesNothingWhenCliModeIsDisabled() {
        TestSyncJobStore store = new TestSyncJobStore();
        SyncService syncService = newSyncService(store);
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
        SyncService syncService = newSyncService(store);
        StartupSyncRunner runner =
                new StartupSyncRunner(new SyncProperties(true, true, SyncMode.DRY_RUN, SyncSource.TIGER_LINE), syncService);

        runner.run();

        assertThat(syncService.findRecentJobs()).isEmpty();
    }

    private SyncService newSyncService(TestSyncJobStore syncJobStore) {
        return newSyncService(syncJobStore, (sourceIdentifier) -> Optional.empty());
    }

    private SyncService newSyncService(TestSyncJobStore syncJobStore, DspaceItemStateReader itemStateReader) {
        return new SyncService(
                syncJobStore,
                (request, actions) -> {},
                new DspaceItemPayloadMapper(),
                new DspaceItemDiffPlanner(itemStateReader),
                List.of(new TigerLineMetadataAdapter()));
    }

    private static final class TestSyncJobStore implements SyncJobStore {
        private final List<SyncJob> jobs = new ArrayList<>();

        @Override
        public SyncJob save(SyncJob job) {
            jobs.removeIf((existingJob) -> existingJob.id().equals(job.id()));
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
