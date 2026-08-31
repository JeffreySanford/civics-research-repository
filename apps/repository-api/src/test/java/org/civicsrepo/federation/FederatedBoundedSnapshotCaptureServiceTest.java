package org.civicsrepo.federation;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;

class FederatedBoundedSnapshotCaptureServiceTest {
    @Test
    void refusesToPersistANamedCheckpointWhenTheRequestedPrefixIsNotAvailable() {
        FederatedCorpusManifestService manifestService = mock(FederatedCorpusManifestService.class);
        FederatedBoundedSnapshotManifestStore store = mock(FederatedBoundedSnapshotManifestStore.class);
        FederatedBoundedSnapshotManifest undersized = new FederatedBoundedSnapshotManifest(
                FederatedCorpusManifestService.BOUNDED_SNAPSHOT_VERSION,
                FederatedBoundedSnapshotManifest.MODE,
                "DATA_GOV:" + "a".repeat(64),
                "run-short",
                FederatedSourceSystem.DATA_GOV,
                "data-gov-v1",
                List.of("data-gov-v1"),
                HarvestRunStatus.PAUSED,
                99_999,
                99_999,
                0,
                0,
                "DATA_GOV:first",
                "DATA_GOV:last",
                "a".repeat(64),
                null,
                null,
                100,
                1_000,
                "100000",
                OffsetDateTime.parse("2026-08-30T17:00:00Z"),
                OffsetDateTime.parse("2026-08-30T20:00:00Z"),
                OffsetDateTime.parse("2026-08-30T20:01:00Z"));
        when(manifestService.generateBoundedSnapshot("run-short", 100_000)).thenReturn(undersized);

        FederatedBoundedSnapshotCaptureService service =
                new FederatedBoundedSnapshotCaptureService(manifestService, store);

        assertThatThrownBy(() -> service.capture("run-short", 100_000))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("100000")
                .hasMessageContaining("99999");
        verifyNoInteractions(store);
    }
}
