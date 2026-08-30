package org.civicsrepo.federation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class JdbcHarvestQuarantineStoreTest {
    private JdbcHarvestQuarantineStore store;

    @BeforeEach
    void setUp() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource(
                "jdbc:h2:mem:harvest-quarantine-" + System.nanoTime() + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
                "sa",
                "");
        store = new JdbcHarvestQuarantineStore(JdbcClient.create(dataSource), dataSource, 3);
        store.createSchema();
    }

    @Test
    void retainsOnlyNewestBoundedRejectionsPerSource() {
        store.saveAll(
                "run-1",
                FederatedSourceSystem.DATA_GOV,
                List.of(
                        new HarvestRejection("old-1", "old one", "{\"id\":\"old-1\"}"),
                        new HarvestRejection("old-2", "old two", "{\"id\":\"old-2\"}")),
                OffsetDateTime.parse("2026-08-29T12:00:00Z"));
        store.saveAll(
                "run-2",
                FederatedSourceSystem.DATA_GOV,
                List.of(
                        new HarvestRejection("new-1", "new one", "{\"id\":\"new-1\"}"),
                        new HarvestRejection("new-2", "new two", "{\"id\":\"new-2\"}")),
                OffsetDateTime.parse("2026-08-29T13:00:00Z"));

        var recent = store.findRecent(FederatedSourceSystem.DATA_GOV, 10);

        assertEquals(3, recent.size());
        assertEquals(2, recent.stream().filter((record) -> record.runId().equals("run-2")).count());
        assertEquals(1, recent.stream().filter((record) -> record.runId().equals("run-1")).count());
        assertTrue(recent.stream().anyMatch((record) -> "new-1".equals(record.sourceIdentifier())));
        assertTrue(recent.stream().anyMatch((record) -> "new-2".equals(record.sourceIdentifier())));
    }

    @Test
    void retentionIsIndependentPerSource() {
        store.saveAll(
                "data-gov-run",
                FederatedSourceSystem.DATA_GOV,
                List.of(new HarvestRejection("data-gov-1", "bad Data.gov row", "{}")),
                OffsetDateTime.parse("2026-08-29T12:00:00Z"));
        store.saveAll(
                "osti-run",
                FederatedSourceSystem.DOE_OSTI,
                List.of(new HarvestRejection("osti-1", "bad OSTI row", "{}")),
                OffsetDateTime.parse("2026-08-29T12:00:00Z"));

        assertEquals(1, store.findRecent(FederatedSourceSystem.DATA_GOV, 10).size());
        assertEquals(1, store.findRecent(FederatedSourceSystem.DOE_OSTI, 10).size());
        assertEquals("osti-run", store.findRecent(FederatedSourceSystem.DOE_OSTI, 10).getFirst().runId());
    }
}
