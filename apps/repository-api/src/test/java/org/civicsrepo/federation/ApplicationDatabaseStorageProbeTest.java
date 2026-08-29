package org.civicsrepo.federation;

import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class ApplicationDatabaseStorageProbeTest {
    @Test
    void nonPostgresTestDatabaseReportsUnknownRatherThanFakeBytes() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource(
                "jdbc:h2:mem:db-size-" + System.nanoTime() + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1", "sa", "");
        ApplicationDatabaseStorageProbe probe =
                new ApplicationDatabaseStorageProbe(JdbcClient.create(dataSource));

        assertTrue(probe.databaseSizeBytes().isEmpty());
    }
}
