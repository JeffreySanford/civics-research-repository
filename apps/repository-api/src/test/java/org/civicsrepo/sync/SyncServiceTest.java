package org.civicsrepo.sync;

import org.civicsrepo.generated.dto.SyncAction;
import org.civicsrepo.sources.OfflineSourceFileProbe;
import org.civicsrepo.generated.dto.SyncJob;
import org.civicsrepo.generated.dto.SyncMode;
import org.civicsrepo.generated.dto.SyncRequest;
import org.civicsrepo.generated.dto.SyncSource;
import org.civicsrepo.generated.dto.SyncStatus;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import java.util.ArrayList;
import java.util.UUID;
import java.util.List;
import java.util.Optional;
import org.civicsrepo.dspace.DspaceItemDiffPlanner;
import org.civicsrepo.dspace.DspaceItemPayload;
import org.civicsrepo.dspace.DspaceItemPayloadMapper;
import org.civicsrepo.dspace.DspaceItemStateReader;
import org.civicsrepo.dspace.DspaceRestClient;
import org.civicsrepo.sources.TigerLineMetadataAdapter;
import org.junit.jupiter.api.Test;
import org.springframework.context.ConfigurableApplicationContext;

class SyncServiceTest {
    @Test
    void dryRunReturnsPlannedActions() {
        SyncService syncService = newSyncService(new TestSyncJobStore());

        SyncJob job = syncService.runSync(new SyncRequest(SyncMode.DRY_RUN, SyncSource.TIGER_LINE));

        assertThat(job.getStatus()).isEqualTo(SyncStatus.DRY_RUN_COMPLETE);
        assertThat(job.getActions())
                .extracting(SyncAction::getActionType)
                .contains(SyncAction.ActionTypeEnum.UPSERT_ITEM, SyncAction.ActionTypeEnum.UPSERT_FILE_MANIFEST, SyncAction.ActionTypeEnum.UPSERT_CITATION, SyncAction.ActionTypeEnum.VERIFY_INDEX);
        assertThat(job.getActions())
                .anySatisfy(action -> {
                    assertThat(action.getActionType()).isEqualTo(SyncAction.ActionTypeEnum.UPSERT_ITEM);
                    assertThat(action.getDetail()).contains("DSpace item payload");
                    assertThat(action.getDetail()).contains("17 metadata fields");
                    assertThat(action.getDetail()).contains("3 file manifest entries");
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
                (request, actions, sourcePayload) -> {
                    throw new IllegalStateException("DSpace is unavailable.");
                },
                new DspaceItemPayloadMapper(),
                new DspaceItemDiffPlanner((sourceIdentifier) -> Optional.empty()),
                List.of(new TigerLineMetadataAdapter(new OfflineSourceFileProbe())));

        SyncJob job = syncService.runSync(new SyncRequest(SyncMode.APPLY, SyncSource.TIGER_LINE));

        assertThat(job.getStatus()).isEqualTo(SyncStatus.FAILED);
        assertThat(job.getCompletedAt()).isNotNull();
        assertThat(job.getActions())
                .anySatisfy(action -> {
                    assertThat(action.getActionType()).isEqualTo(SyncAction.ActionTypeEnum.SYNC_FAILED);
                    assertThat(action.getDetail()).isEqualTo("DSpace is unavailable.");
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
                    assertThat(job.getMode()).isEqualTo(SyncMode.DRY_RUN);
                    assertThat(job.getSource()).isEqualTo(SyncSource.TIGER_LINE);
                    assertThat(job.getStatus()).isEqualTo(SyncStatus.DRY_RUN_COMPLETE);
                });
        verify(applicationContext).close();
    }

    @Test
    void diffModePlansCreateWhenRepositoryItemDoesNotExist() {
        SyncService syncService = newSyncService(new TestSyncJobStore());

        SyncJob job = syncService.runSync(new SyncRequest(SyncMode.DIFF, SyncSource.TIGER_LINE));

        assertThat(job.getStatus()).isEqualTo(SyncStatus.DIFF_COMPLETE);
        assertThat(job.getActions())
                .extracting(SyncAction::getActionType)
                .contains(SyncAction.ActionTypeEnum.VERIFY_COMMUNITY, SyncAction.ActionTypeEnum.VERIFY_COLLECTION, SyncAction.ActionTypeEnum.CREATE_ITEM, SyncAction.ActionTypeEnum.VERIFY_INDEX);
    }

    @Test
    void diffModePlansSkipWhenRepositoryItemMatchesSourcePayload() {
        DspaceItemPayload sourcePayload =
                new DspaceItemPayloadMapper().toItemPayload(new TigerLineMetadataAdapter(new OfflineSourceFileProbe()).firstVisualSlice());
        SyncService syncService = newSyncService(new TestSyncJobStore(), (sourceIdentifier) -> Optional.of(sourcePayload));

        SyncJob job = syncService.runSync(new SyncRequest(SyncMode.DIFF, SyncSource.TIGER_LINE));

        assertThat(job.getStatus()).isEqualTo(SyncStatus.DIFF_COMPLETE);
        assertThat(job.getActions()).extracting(SyncAction::getActionType).contains(SyncAction.ActionTypeEnum.SKIP_ITEM);
    }

    @Test
    void diffModePlansUpdateWhenRepositoryItemDiffersFromSourcePayload() {
        DspaceItemPayload sourcePayload =
                new DspaceItemPayloadMapper().toItemPayload(new TigerLineMetadataAdapter(new OfflineSourceFileProbe()).firstVisualSlice());
        java.util.Map<String, List<org.civicsrepo.dspace.DspaceMetadataValue>> changedMetadata =
                new java.util.LinkedHashMap<>(sourcePayload.metadata());
        changedMetadata.put(
                "dc.title",
                List.of(new org.civicsrepo.dspace.DspaceMetadataValue("An older title", "en_US", null, -1)));
        DspaceItemPayload changedPayload = new DspaceItemPayload(
                sourcePayload.name(), sourcePayload.type(), java.util.Map.copyOf(changedMetadata), List.of());
        SyncService syncService = newSyncService(new TestSyncJobStore(), (sourceIdentifier) -> Optional.of(changedPayload));

        SyncJob job = syncService.runSync(new SyncRequest(SyncMode.DIFF, SyncSource.TIGER_LINE));

        assertThat(job.getStatus()).isEqualTo(SyncStatus.DIFF_COMPLETE);
        assertThat(job.getActions()).extracting(SyncAction::getActionType).contains(SyncAction.ActionTypeEnum.UPDATE_ITEM);
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
        StartupSyncRunner runner = new StartupSyncRunner(
                new SyncProperties(true, true, SyncMode.DRY_RUN, SyncSource.TIGER_LINE),
                syncService,
                new DspaceRestClient("", "", ""));

        runner.run();

        assertThat(syncService.findRecentJobs()).isEmpty();
    }

    private SyncService newSyncService(TestSyncJobStore syncJobStore) {
        return newSyncService(syncJobStore, (sourceIdentifier) -> Optional.empty());
    }

    private SyncService newSyncService(TestSyncJobStore syncJobStore, DspaceItemStateReader itemStateReader) {
        return new SyncService(
                syncJobStore,
                (request, actions, sourcePayload) -> {},
                new DspaceItemPayloadMapper(),
                new DspaceItemDiffPlanner(itemStateReader),
                List.of(new TigerLineMetadataAdapter(new OfflineSourceFileProbe())));
    }

    private static final class TestSyncJobStore implements SyncJobStore {
        private final List<SyncJob> jobs = new ArrayList<>();

        @Override
        public SyncJob save(SyncJob job) {
            jobs.removeIf((existingJob) -> existingJob.getId().equals(job.getId()));
            jobs.add(0, job);
            return job;
        }

        @Override
        public Optional<SyncJob> findById(UUID id) {
            return jobs.stream().filter((job) -> job.getId().equals(id)).findFirst();
        }

        @Override
        public List<SyncJob> findRecent(int limit) {
            return jobs.stream().limit(limit).toList();
        }
    }
}
