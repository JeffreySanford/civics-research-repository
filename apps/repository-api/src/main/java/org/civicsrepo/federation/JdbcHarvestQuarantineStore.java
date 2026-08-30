package org.civicsrepo.federation;

import jakarta.annotation.PostConstruct;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import javax.sql.DataSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** PostgreSQL/H2-compatible bounded quarantine ledger for malformed source records. */
@Component
public class JdbcHarvestQuarantineStore implements HarvestQuarantineStore {
    static final int MAX_RETAINED_PER_SOURCE = 10_000;
    private static final int WRITE_BATCH_SIZE = 1_000;
    private static final String INSERT_SQL =
            """
            insert into federated_harvest_quarantine (
                id, run_id, source_system, source_identifier, message, raw_snippet, observed_at
            ) values (?, ?, ?, ?, ?, ?, ?)
            """;

    private final JdbcClient jdbcClient;
    private final JdbcTemplate jdbcTemplate;

    public JdbcHarvestQuarantineStore(JdbcClient jdbcClient, DataSource dataSource) {
        this.jdbcClient = jdbcClient;
        this.jdbcTemplate = new JdbcTemplate(dataSource);
    }

    @PostConstruct
    void createSchema() {
        jdbcClient
                .sql(
                        """
                        create table if not exists federated_harvest_quarantine (
                            id text primary key,
                            run_id text not null,
                            source_system text not null,
                            source_identifier text,
                            message text not null,
                            raw_snippet text,
                            observed_at timestamp with time zone not null
                        )
                        """)
                .update();
        jdbcClient
                .sql(
                        """
                        create index if not exists federated_harvest_quarantine_source_observed
                        on federated_harvest_quarantine (source_system, observed_at)
                        """)
                .update();
    }

    @Override
    @Transactional
    public void saveAll(
            String runId,
            FederatedSourceSystem sourceSystem,
            List<HarvestRejection> rejections,
            OffsetDateTime observedAt) {
        if (rejections == null || rejections.isEmpty()) {
            return;
        }
        List<HarvestQuarantineRecord> records = rejections.stream()
                .map(rejection -> new HarvestQuarantineRecord(
                        UUID.randomUUID().toString(),
                        runId,
                        sourceSystem,
                        rejection.sourceIdentifier(),
                        rejection.message(),
                        rejection.rawSnippet(),
                        observedAt))
                .toList();

        jdbcTemplate.batchUpdate(INSERT_SQL, records, WRITE_BATCH_SIZE, this::bindInsert);
        prune(sourceSystem);
    }

    @Override
    public List<HarvestQuarantineRecord> findRecent(FederatedSourceSystem sourceSystem, int limit) {
        return jdbcClient
                .sql(
                        """
                        select * from federated_harvest_quarantine
                        where source_system = :sourceSystem
                        order by observed_at desc, id desc
                        limit :limit
                        """)
                .param("sourceSystem", sourceSystem.name())
                .param("limit", Math.max(1, Math.min(limit, 1_000)))
                .query(this::mapRecord)
                .list();
    }

    private void prune(FederatedSourceSystem sourceSystem) {
        jdbcClient
                .sql(
                        """
                        delete from federated_harvest_quarantine
                        where source_system = :sourceSystem
                          and id not in (
                              select id from federated_harvest_quarantine
                              where source_system = :sourceSystem
                              order by observed_at desc, id desc
                              limit :retain
                          )
                        """)
                .param("sourceSystem", sourceSystem.name())
                .param("retain", MAX_RETAINED_PER_SOURCE)
                .update();
    }

    private void bindInsert(PreparedStatement statement, HarvestQuarantineRecord record) throws SQLException {
        statement.setString(1, record.id());
        statement.setString(2, record.runId());
        statement.setString(3, record.sourceSystem().name());
        statement.setString(4, record.sourceIdentifier());
        statement.setString(5, record.message());
        statement.setString(6, record.rawSnippet());
        statement.setObject(7, record.observedAt());
    }

    private HarvestQuarantineRecord mapRecord(ResultSet resultSet, int rowNumber) throws SQLException {
        return new HarvestQuarantineRecord(
                resultSet.getString("id"),
                resultSet.getString("run_id"),
                FederatedSourceSystem.valueOf(resultSet.getString("source_system")),
                resultSet.getString("source_identifier"),
                resultSet.getString("message"),
                resultSet.getString("raw_snippet"),
                resultSet.getObject("observed_at", OffsetDateTime.class));
    }
}
