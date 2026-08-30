package org.civicsrepo.federation;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class JdbcFederatedBoundedSnapshotManifestStoreTest {
    private JdbcFederatedBoundedSnapshotManifestStore store;

    @BeforeEach
    void setUp() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource(
                "jdbc:h2:mem:bounded-snapshots-" + System.nanoTime() + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
                "sa",
                "");
        store = new JdbcFederatedBoundedSnapshotManifestStore(JdbcClient.create(dataSource));
        store.createSchema();
    }

    @Test
    void savesAndReloadsEverySnapshotField() {
        FederatedBoundedSnapshotManifest manifest = manifest(
                "run-1", "DATA_GOV:" + "a".repeat(64), "a".repeat(64), "2026-08-30T12:05:00Z");

        store.save(manifest);

        assertThat(store.findBySnapshotId(manifest.snapshotId())).contains(manifest);
    }

    @Test
    void retainsMultipleCheckpointsFromTheSameResumableRun() {
        FederatedBoundedSnapshotManifest oneK = manifest(
                "run-1", "DATA_GOV:" + "a".repeat(64), "a".repeat(64), "2026-08-30T12:05:00Z");
        FederatedBoundedSnapshotManifest tenK = manifest(
                "run-1", "DATA_GOV:" + "b".repeat(64), "b".repeat(64), "2026-08-30T13:05:00Z");

        store.save(oneK);
        store.save(tenK);

        assertThat(store.findRecent(FederatedSourceSystem.DATA_GOV, 10)).containsExactly(tenK, oneK);
    }

    @Test
    void replacesAnIdenticalSnapshotIdIdempotently() {
        FederatedBoundedSnapshotManifest original = manifest(
                "run-1", "DATA_GOV:" + "a".repeat(64), "a".repeat(64), "2026-08-30T12:05:00Z");
        FederatedBoundedSnapshotManifest recaptured = new FederatedBoundedSnapshotManifest(
                original.manifestVersion(),
                original.mode(),
                original.snapshotId(),
                original.runId(),
                original.sourceSystem(),
                original.runAdapterVersion(),
                original.recordAdapterVersions(),
                original.runStatus(),
                original.retainedRecordCount(),
                original.acceptedCount(),
                original.rejectedCount(),
                original.skippedCount(),
                original.firstRecordId(),
                original.lastRecordId(),
                original.sha256(),
                original.earliestSourceUpdatedAt(),
                original.latestSourceUpdatedAt(),
                original.pageSize(),
                original.pageCount(),
                original.cursor(),
                original.runStartedAt(),
                original.runUpdatedAt(),
                OffsetDateTime.parse("2026-08-30T12:06:00Z"));

        store.save(original);
        store.save(recaptured);

        assertThat(store.findBySnapshotId(original.snapshotId())).contains(recaptured);
        assertThat(store.findRecent(FederatedSourceSystem.DATA_GOV, 10)).containsExactly(recaptured);
    }

    private FederatedBoundedSnapshotManifest manifest(
            String runId, String snapshotId, String sha256, String capturedAt) {
        return new FederatedBoundedSnapshotManifest(
                FederatedCorpusManifestService.BOUNDED_SNAPSHOT_VERSION,
                FederatedBoundedSnapshotManifest.MODE,
                snapshotId,
                runId,
                FederatedSourceSystem.DATA_GOV,
                "data-gov-catalog-v4-v2",
                List.of("data-gov-catalog-v4-v2"),
                HarvestRunStatus.PAUSED,
                1_000,
                1_000,
                0,
                0,
                "DATA_GOV:alpha",
                "DATA_GOV:zulu",
                sha256,
                OffsetDateTime.parse("2026-08-01T00:00:00Z"),
                OffsetDateTime.parse("2026-08-29T23:59:59Z"),
                100,
                10,
                "opaque-after-token",
                OffsetDateTime.parse("2026-08-30T12:00:00Z"),
                OffsetDateTime.parse("2026-08-30T12:04:00Z"),
                OffsetDateTime.parse(capturedAt));
    }
}
