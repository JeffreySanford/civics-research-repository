package org.civicsrepo.sync;

import org.civicsrepo.generated.dto.SyncAction;
import org.civicsrepo.sources.OfflineSourceFileProbe;
import org.civicsrepo.generated.dto.SyncMode;
import org.civicsrepo.generated.dto.SyncRequest;
import org.civicsrepo.generated.dto.SyncSource;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.civicsrepo.dspace.DspaceItemPayload;
import org.civicsrepo.dspace.DspaceItemPayloadMapper;
import org.civicsrepo.dspace.DspaceItemWriteGateway;
import org.civicsrepo.sources.TigerLineMetadataAdapter;
import org.civicsrepo.sources.CatalogMetadataReader;
import org.junit.jupiter.api.Test;

class LoggingSyncActionRunnerTest {
    @Test
    void applyModeReconcilesDspaceSourceIdentifier() {
        TestDspaceItemWriteGateway writeGateway = new TestDspaceItemWriteGateway();
        LoggingSyncActionRunner runner = new LoggingSyncActionRunner(writeGateway);

        runner.run(
                new SyncRequest(SyncMode.APPLY, SyncSource.TIGER_LINE),
                List.of(
                        new SyncAction(
                        SyncAction.ActionTypeEnum.UPSERT_ITEM, "2025 TIGER/Line - Census Tracts - North Dakota", "Ensure item."),
                        new SyncAction(
                        SyncAction.ActionTypeEnum.UPSERT_FILE_MANIFEST, "tiger-line-north-dakota-2025", "Track files.")),
                List.of(new SourceObject("tiger-line-north-dakota-2025", sourcePayload())));

        assertThat(writeGateway.sourceIdentifier).isEqualTo("tiger-line-north-dakota-2025");
        assertThat(writeGateway.sourcePayload.name()).isEqualTo("2025 TIGER/Line - Census Tracts - North Dakota");
    }

    @Test
    void dryRunModeDoesNotWriteToDspace() {
        TestDspaceItemWriteGateway writeGateway = new TestDspaceItemWriteGateway();
        LoggingSyncActionRunner runner = new LoggingSyncActionRunner(writeGateway);

        runner.run(
                new SyncRequest(SyncMode.DRY_RUN, SyncSource.TIGER_LINE),
                List.of(
                        new SyncAction(
                        SyncAction.ActionTypeEnum.UPSERT_ITEM, "2025 TIGER/Line - Census Tracts - North Dakota", "Ensure item."),
                        new SyncAction(
                        SyncAction.ActionTypeEnum.UPSERT_FILE_MANIFEST, "tiger-line-north-dakota-2025", "Track files.")),
                List.of(new SourceObject("tiger-line-north-dakota-2025", sourcePayload())));

        assertThat(writeGateway.sourceIdentifier).isNull();
        assertThat(writeGateway.sourcePayload).isNull();
    }

    private DspaceItemPayload sourcePayload() {
        return new DspaceItemPayloadMapper().toItemPayload(new TigerLineMetadataAdapter(new OfflineSourceFileProbe(), new CatalogMetadataReader()).firstVisualSlice());
    }

    private static final class TestDspaceItemWriteGateway implements DspaceItemWriteGateway {
        private String sourceIdentifier;
        private DspaceItemPayload sourcePayload;

        @Override
        public boolean ensureItemMetadata(String sourceIdentifier, DspaceItemPayload sourcePayload) {
            this.sourceIdentifier = sourceIdentifier;
            this.sourcePayload = sourcePayload;
            return true;
        }
    }
}
