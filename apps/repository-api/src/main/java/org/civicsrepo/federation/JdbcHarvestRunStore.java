package org.civicsrepo.federation;

import jakarta.annotation.PostConstruct;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** PostgreSQL/H2-compatible durable harvest-run ledger. */
@Component
public class JdbcHarvestRunStore implements HarvestRunStore {
    private final JdbcClient jdbcClient;

    public JdbcHarvestRunStore(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    @PostConstruct
    void createSchema() {
        jdbcClient
                .sql(
                        """
                        create table if not exists federated_harvest_runs (
                            id text primary key,
                            source_system text not null,
                            adapter_version text not null,
                            status text not null,
                            page_size integer not null,
                            page_count integer not null,
                            accepted_count bigint not null,
                            rejected_count bigint not null,
                            skipped_count bigint not null,
                            cursor_value text,
                            started_at timestamp with time zone not null,
                            updated_at timestamp with time zone not null,
                            completed_at timestamp with time zone,
                            failure_message text
                        )
                        """)
                .update();
        jdbcClient
                .sql(
                        """
                        create index if not exists federated_harvest_runs_source_updated
                        on federated_harvest_runs (source_system, updated_at)
                        """)
                .update();
    }

    @Override
    @Transactional
    public void save(HarvestRun run) {
        int updated = jdbcClient
                .sql(
                        """
                        update federated_harvest_runs set
                            source_system = :sourceSystem,
                            adapter_version = :adapterVersion,
                            status = :status,
                            page_size = :pageSize,
                            page_count = :pageCount,
                            accepted_count = :acceptedCount,
                            rejected_count = :rejectedCount,
                            skipped_count = :skippedCount,
                            cursor_value = :cursor,
                            started_at = :startedAt,
                            updated_at = :updatedAt,
                            completed_at = :completedAt,
                            failure_message = :failureMessage
                        where id = :id
                        """)
                .params(params(run))
                .update();

        if (updated == 0) {
            jdbcClient
                    .sql(
                            """
                            insert into federated_harvest_runs (
                                id, source_system, adapter_version, status, page_size, page_count,
                                accepted_count, rejected_count, skipped_count, cursor_value,
                                started_at, updated_at, completed_at, failure_message
                            ) values (
                                :id, :sourceSystem, :adapterVersion, :status, :pageSize, :pageCount,
                                :acceptedCount, :rejectedCount, :skippedCount, :cursor,
                                :startedAt, :updatedAt, :completedAt, :failureMessage
                            )
                            """)
                    .params(params(run))
                    .update();
        }
    }

    @Override
    public Optional<HarvestRun> findById(String id) {
        return jdbcClient
                .sql("select * from federated_harvest_runs where id = :id")
                .param("id", id)
                .query(this::mapRun)
                .optional();
    }

    @Override
    public Optional<HarvestRun> findResumable(FederatedSourceSystem sourceSystem) {
        return jdbcClient
                .sql(
                        """
                        select * from federated_harvest_runs
                        where source_system = :sourceSystem
                          and status in ('RUNNING', 'PAUSED')
                        order by updated_at desc, id desc
                        limit 1
                        """)
                .param("sourceSystem", sourceSystem.name())
                .query(this::mapRun)
                .optional();
    }

    @Override
    public List<HarvestRun> findRecent(FederatedSourceSystem sourceSystem, int limit) {
        return jdbcClient
                .sql(
                        """
                        select * from federated_harvest_runs
                        where source_system = :sourceSystem
                        order by started_at desc, id desc
                        limit :limit
                        """)
                .param("sourceSystem", sourceSystem.name())
                .param("limit", Math.max(1, Math.min(limit, 1_000)))
                .query(this::mapRun)
                .list();
    }

    private java.util.Map<String, Object> params(HarvestRun run) {
        java.util.Map<String, Object> values = new java.util.LinkedHashMap<>();
        values.put("id", run.id());
        values.put("sourceSystem", run.sourceSystem().name());
        values.put("adapterVersion", run.adapterVersion());
        values.put("status", run.status().name());
        values.put("pageSize", run.pageSize());
        values.put("pageCount", run.pageCount());
        values.put("acceptedCount", run.acceptedCount());
        values.put("rejectedCount", run.rejectedCount());
        values.put("skippedCount", run.skippedCount());
        values.put("cursor", run.cursor());
        values.put("startedAt", run.startedAt());
        values.put("updatedAt", run.updatedAt());
        values.put("completedAt", run.completedAt());
        values.put("failureMessage", run.failureMessage());
        return values;
    }

    private HarvestRun mapRun(ResultSet resultSet, int rowNumber) throws SQLException {
        return new HarvestRun(
                resultSet.getString("id"),
                FederatedSourceSystem.valueOf(resultSet.getString("source_system")),
                resultSet.getString("adapter_version"),
                HarvestRunStatus.valueOf(resultSet.getString("status")),
                resultSet.getInt("page_size"),
                resultSet.getInt("page_count"),
                resultSet.getLong("accepted_count"),
                resultSet.getLong("rejected_count"),
                resultSet.getLong("skipped_count"),
                resultSet.getString("cursor_value"),
                resultSet.getObject("started_at", OffsetDateTime.class),
                resultSet.getObject("updated_at", OffsetDateTime.class),
                resultSet.getObject("completed_at", OffsetDateTime.class),
                resultSet.getString("failure_message"));
    }
}
