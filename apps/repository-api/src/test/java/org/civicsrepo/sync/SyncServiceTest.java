package org.civicsrepo.sync;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class SyncServiceTest {
    @Test
    void dryRunReturnsPlannedActions() {
        SyncService syncService = new SyncService();

        SyncJob job = syncService.runSync(new SyncRequest(SyncMode.DRY_RUN, SyncSource.TIGER_LINE));

        assertThat(job.status()).isEqualTo(SyncStatus.DRY_RUN_COMPLETE);
        assertThat(job.actions()).extracting(SyncAction::actionType).contains("UPSERT_ITEM", "VERIFY_INDEX");
    }
}
