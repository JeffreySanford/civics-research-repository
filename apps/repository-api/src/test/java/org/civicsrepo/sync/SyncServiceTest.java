package org.civicsrepo.sync;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
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
