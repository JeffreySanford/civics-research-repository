package org.civicsrepo.sync;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.civicsrepo.dspace.DspaceItemWriteGateway;
import org.junit.jupiter.api.Test;

class LoggingSyncActionRunnerTest {
    @Test
    void applyModeReconcilesDspaceSourceIdentifier() {
        TestDspaceItemWriteGateway writeGateway = new TestDspaceItemWriteGateway();
        LoggingSyncActionRunner runner = new LoggingSyncActionRunner(writeGateway);

        runner.run(
                new SyncRequest(SyncMode.APPLY, SyncSource.TIGER_LINE),
                List.of(
                        new SyncAction("UPSERT_ITEM", "2025 TIGER/Line - Census Tracts - North Dakota", "Ensure item."),
                        new SyncAction("UPSERT_FILE_MANIFEST", "tiger-line-north-dakota-2025", "Track files.")));

        assertThat(writeGateway.sourceIdentifier).isEqualTo("tiger-line-north-dakota-2025");
        assertThat(writeGateway.itemTitle).isEqualTo("2025 TIGER/Line - Census Tracts - North Dakota");
    }

    @Test
    void dryRunModeDoesNotWriteToDspace() {
        TestDspaceItemWriteGateway writeGateway = new TestDspaceItemWriteGateway();
        LoggingSyncActionRunner runner = new LoggingSyncActionRunner(writeGateway);

        runner.run(
                new SyncRequest(SyncMode.DRY_RUN, SyncSource.TIGER_LINE),
                List.of(
                        new SyncAction("UPSERT_ITEM", "2025 TIGER/Line - Census Tracts - North Dakota", "Ensure item."),
                        new SyncAction("UPSERT_FILE_MANIFEST", "tiger-line-north-dakota-2025", "Track files.")));

        assertThat(writeGateway.sourceIdentifier).isNull();
        assertThat(writeGateway.itemTitle).isNull();
    }

    private static final class TestDspaceItemWriteGateway implements DspaceItemWriteGateway {
        private String sourceIdentifier;
        private String itemTitle;

        @Override
        public boolean ensureSourceIdentifier(String sourceIdentifier, String itemTitle) {
            this.sourceIdentifier = sourceIdentifier;
            this.itemTitle = itemTitle;
            return true;
        }
    }
}
