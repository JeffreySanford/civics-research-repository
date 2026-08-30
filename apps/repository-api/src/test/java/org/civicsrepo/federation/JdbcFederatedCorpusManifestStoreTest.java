package org.civicsrepo.federation;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class JdbcFederatedCorpusManifestStoreTest {
    private JdbcFederatedCorpusManifestStore store;

    @BeforeEach
    void setUp() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource(
                "jdbc:h2:mem:corpus-manifests-" + System.nanoTime() + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
                "sa",
                "");
        store = new JdbcFederatedCorpusManifestStore(JdbcClient.create(dataSource));
        store.createSchema();
    }

    @Test
    void savesAndReloadsEveryManifestField() {
        FederatedCorpusManifest manifest = manifest("run-1", "a".repeat(64), "2026-08-30T12:05:00Z");

        store.save(manifest);

        assertThat(store.findByRunId("run-1")).contains(manifest);
    }

    @Test
    void replacesTheManifestForTheSameRunIdIdempotently() {
        store.save(manifest("run-1", "a".repeat(64), "2026-08-30T12:05:00Z"));
        FederatedCorpusManifest replacement = manifest("run-1", "b".repeat(64), "2026-08-30T12:06:00Z");

        store.save(replacement);

        assertThat(store.findByRunId("run-1")).contains(replacement);
        assertThat(store.findRecent(FederatedSourceSystem.DATA_GOV, 10)).containsExactly(replacement);
    }

    @Test
    void findsRecentManifestsForOneSourceNewestFirst() {
        FederatedCorpusManifest older = manifest("run-old", "a".repeat(64), "2026-08-30T12:05:00Z");
        FederatedCorpusManifest newer = manifest("run-new", "b".repeat(64), "2026-08-30T13:05:00Z");
        store.save(older);
        store.save(newer);
        store.save(new FederatedCorpusManifest(
                FederatedCorpusManifestService.MANIFEST_VERSION,
                "run-osti",
                FederatedSourceSystem.DOE_OSTI,
                "osti-v1",
                List.of("osti-v1"),
                1,
                1,
                0,
                0,
                "DOE_OSTI:one",
                "DOE_OSTI:one",
                "c".repeat(64),
                OffsetDateTime.parse("2026-08-30T10:00:00Z"),
                OffsetDateTime.parse("2026-08-30T10:00:00Z"),
                100,
                1,
                null,
                OffsetDateTime.parse("2026-08-30T14:00:00Z"),
                OffsetDateTime.parse("2026-08-30T14:05:00Z")));

        assertThat(store.findRecent(FederatedSourceSystem.DATA_GOV, 10)).containsExactly(newer, older);
        assertThat(store.findRecent(FederatedSourceSystem.DATA_GOV, 1)).containsExactly(newer);
    }

    private FederatedCorpusManifest manifest(String runId, String sha256, String completedAt) {
        return new FederatedCorpusManifest(
                FederatedCorpusManifestService.MANIFEST_VERSION,
                runId,
                FederatedSourceSystem.DATA_GOV,
                "data-gov-v2",
                List.of("data-gov-v1", "data-gov-v2"),
                2_500,
                2_400,
                3,
                7,
                "DATA_GOV:alpha",
                "DATA_GOV:zulu",
                sha256,
                OffsetDateTime.parse("2026-08-01T00:00:00Z"),
                OffsetDateTime.parse("2026-08-29T23:59:59Z"),
                1_000,
                3,
                null,
                OffsetDateTime.parse("2026-08-30T12:00:00Z"),
                OffsetDateTime.parse(completedAt));
    }
}
