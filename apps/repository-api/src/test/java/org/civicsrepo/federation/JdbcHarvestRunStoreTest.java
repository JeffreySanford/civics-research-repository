package org.civicsrepo.federation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.OffsetDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class JdbcHarvestRunStoreTest {
    private JdbcHarvestRunStore store;

    @BeforeEach
    void setUp() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource(
                "jdbc:h2:mem:harvest-runs-" + System.nanoTime() + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
                "sa",
                "");
        store = new JdbcHarvestRunStore(JdbcClient.create(dataSource));
        store.createSchema();
    }

    @Test
    void savesProgressAndFindsOnlyResumableRuns() {
        HarvestRun started = run(
                "run-1",
                HarvestRunStatus.RUNNING,
                0,
                0,
                null,
                "2026-08-29T12:00:00Z",
                "2026-08-29T12:00:00Z",
                null,
                null);
        store.save(started);

        HarvestRun paused = run(
                "run-1",
                HarvestRunStatus.PAUSED,
                2,
                2_000,
                "2000",
                "2026-08-29T12:00:00Z",
                "2026-08-29T12:05:00Z",
                null,
                null);
        store.save(paused);

        HarvestRun loaded = store.findById("run-1").orElseThrow();
        assertEquals(HarvestRunStatus.PAUSED, loaded.status());
        assertEquals(2, loaded.pageCount());
        assertEquals(2_000, loaded.acceptedCount());
        assertEquals("2000", loaded.cursor());
        assertEquals("data-gov-ckan-v1", loaded.adapterVersion());
        assertEquals("run-1", store.findResumable(FederatedSourceSystem.DATA_GOV).orElseThrow().id());

        HarvestRun completed = run(
                "run-1",
                HarvestRunStatus.COMPLETED,
                3,
                2_500,
                null,
                "2026-08-29T12:00:00Z",
                "2026-08-29T12:10:00Z",
                "2026-08-29T12:10:00Z",
                null);
        store.save(completed);

        assertTrue(store.findResumable(FederatedSourceSystem.DATA_GOV).isEmpty());
        assertEquals(HarvestRunStatus.COMPLETED, store.findRecent(FederatedSourceSystem.DATA_GOV, 10)
                .getFirst()
                .status());
    }

    @Test
    void preservesBoundedFailureEvidence() {
        HarvestRun failed = run(
                "run-failed",
                HarvestRunStatus.FAILED,
                4,
                3_500,
                "3500",
                "2026-08-29T13:00:00Z",
                "2026-08-29T13:05:00Z",
                "2026-08-29T13:05:00Z",
                "publisher response failed validation");

        store.save(failed);

        HarvestRun loaded = store.findById("run-failed").orElseThrow();
        assertEquals(HarvestRunStatus.FAILED, loaded.status());
        assertEquals("publisher response failed validation", loaded.failureMessage());
        assertEquals(3_500, loaded.acceptedCount());
        assertEquals("3500", loaded.cursor());
    }

    private HarvestRun run(
            String id,
            HarvestRunStatus status,
            int pageCount,
            long acceptedCount,
            String cursor,
            String startedAt,
            String updatedAt,
            String completedAt,
            String failureMessage) {
        return new HarvestRun(
                id,
                FederatedSourceSystem.DATA_GOV,
                "data-gov-ckan-v1",
                status,
                1_000,
                pageCount,
                acceptedCount,
                0,
                0,
                cursor,
                OffsetDateTime.parse(startedAt),
                OffsetDateTime.parse(updatedAt),
                completedAt == null ? null : OffsetDateTime.parse(completedAt),
                failureMessage);
    }
}
