package org.civicsrepo.federation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.OffsetDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class JdbcCorpusStorageMeasurementStoreTest {
    private JdbcCorpusStorageMeasurementStore store;

    @BeforeEach
    void setUp() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource(
                "jdbc:h2:mem:storage-history-" + System.nanoTime() + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
                "sa",
                "");
        store = new JdbcCorpusStorageMeasurementStore(JdbcClient.create(dataSource));
        store.createSchema();
    }

    @Test
    void storesImmutableHistoricalMeasurementsAndFiltersByProfile() {
        store.save(measurement(
                "curated-1",
                CorpusProfile.CURATED_DEMO,
                181,
                0,
                10_000L,
                20_000L,
                30_000L,
                40_000L,
                "2026-08-29T12:00:00Z"));
        store.save(measurement(
                "million-1",
                CorpusProfile.FEDERATED_1M,
                1_000_181,
                1_000_000,
                2_000_000L,
                20_000L,
                3_000_000L,
                4_000_000L,
                "2026-08-30T12:00:00Z"));

        var recent = store.findRecent(10);
        assertEquals(2, recent.size());
        assertEquals("million-1", recent.getFirst().id());
        assertEquals(9_020_000L, recent.getFirst().totalMeasuredLocalBytes());

        var curated = store.findRecentByProfile(CorpusProfile.CURATED_DEMO, 10);
        assertEquals(1, curated.size());
        assertEquals(181, curated.getFirst().activeProjectionCount());
    }

    @Test
    void corpusProfilesExposeOnlyRealTargetCounts() {
        assertTrue(CorpusProfile.CURATED_DEMO.targetRecordCount().isEmpty());
        assertEquals(10_000L, CorpusProfile.FEDERATED_10K.targetRecordCount().orElseThrow());
        assertEquals(100_000L, CorpusProfile.FEDERATED_100K.targetRecordCount().orElseThrow());
        assertEquals(1_000_000L, CorpusProfile.FEDERATED_1M.targetRecordCount().orElseThrow());
        assertTrue(CorpusProfile.FULL.targetRecordCount().isEmpty());
    }

    private CorpusStorageMeasurement measurement(
            String id,
            CorpusProfile profile,
            long activeProjectionCount,
            long retainedFederatedCount,
            Long postgresBytes,
            Long dspaceBytes,
            Long solrBytes,
            Long openSearchBytes,
            String capturedAt) {
        return new CorpusStorageMeasurement(
                id,
                profile,
                DeploymentTopology.DOCKER_COMPOSE,
                activeProjectionCount,
                retainedFederatedCount,
                null,
                postgresBytes,
                dspaceBytes,
                solrBytes,
                openSearchBytes,
                OffsetDateTime.parse(capturedAt));
    }
}
