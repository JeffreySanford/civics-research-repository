package org.civicsrepo.federation;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.OffsetDateTime;
import org.civicsrepo.generated.dto.RepositorySource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class JdbcFederatedSnapshotProjectionEvidenceStoreTest {
    private JdbcFederatedSnapshotProjectionEvidenceStore store;

    @BeforeEach
    void setUp() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource(
                "jdbc:h2:mem:snapshot-projection-evidence-" + System.nanoTime()
                        + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
                "sa",
                "");
        store = new JdbcFederatedSnapshotProjectionEvidenceStore(JdbcClient.create(dataSource));
        store.createSchema();
    }

    @Test
    void retainsMultipleCombinedProjectionsForTheSameBoundedSnapshot() {
        FederatedSnapshotProjectionEvidence first = evidence("a".repeat(64), "2026-08-30T19:30:00Z");
        FederatedSnapshotProjectionEvidence second = evidence("b".repeat(64), "2026-08-30T20:30:00Z");

        store.save(first);
        store.save(second);

        assertThat(store.findRecent(FederatedSourceSystem.DATA_GOV, 10)).containsExactly(second, first);
    }

    @Test
    void savingTheSameSnapshotProjectionPairIsIdempotent() {
        FederatedSnapshotProjectionEvidence first = evidence("a".repeat(64), "2026-08-30T19:30:00Z");
        FederatedSnapshotProjectionEvidence replacement = new FederatedSnapshotProjectionEvidence(
                first.snapshotId(),
                first.runId(),
                first.sourceSystem(),
                first.snapshotSha256(),
                first.snapshotRetainedRecordCount(),
                first.projectionId(),
                first.projectionSource(),
                first.projectionObjectCount(),
                first.projectionRebuiltAt(),
                OffsetDateTime.parse("2026-08-30T19:31:00Z"));

        store.save(first);
        store.save(replacement);

        assertThat(store.findRecent(FederatedSourceSystem.DATA_GOV, 10)).containsExactly(replacement);
    }

    private FederatedSnapshotProjectionEvidence evidence(String projectionId, String linkedAt) {
        String snapshotSha = "c".repeat(64);
        return new FederatedSnapshotProjectionEvidence(
                "DATA_GOV:" + snapshotSha,
                "run-1",
                FederatedSourceSystem.DATA_GOV,
                snapshotSha,
                1_000,
                projectionId,
                RepositorySource.REPOSITORY,
                1_181,
                OffsetDateTime.parse("2026-08-30T19:29:00Z"),
                OffsetDateTime.parse(linkedAt));
    }
}
