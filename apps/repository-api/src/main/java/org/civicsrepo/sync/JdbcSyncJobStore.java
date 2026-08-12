package org.civicsrepo.sync;

import org.civicsrepo.generated.dto.SyncAction;
import org.civicsrepo.generated.dto.SyncJob;
import org.civicsrepo.generated.dto.SyncMode;
import org.civicsrepo.generated.dto.SyncSource;
import org.civicsrepo.generated.dto.SyncStatus;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcSyncJobStore implements SyncJobStore {
    private static final TypeReference<List<SyncAction>> SYNC_ACTIONS_TYPE = new TypeReference<>() {};

    private final JdbcClient jdbcClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public JdbcSyncJobStore(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    @PostConstruct
    void createSchema() {
        jdbcClient
                .sql(
                        """
                        create table if not exists sync_jobs (
                            id text primary key,
                            mode text not null,
                            source text not null,
                            status text not null,
                            started_at timestamp with time zone not null,
                            completed_at timestamp with time zone,
                            actions_json text not null
                        )
                        """)
                .update();
    }

    @Override
    public SyncJob save(SyncJob job) {
        jdbcClient
                .sql(
                        """
                        insert into sync_jobs (id, mode, source, status, started_at, completed_at, actions_json)
                        values (:id, :mode, :source, :status, :startedAt, :completedAt, :actionsJson)
                        on conflict (id) do update set
                            mode = excluded.mode,
                            source = excluded.source,
                            status = excluded.status,
                            started_at = excluded.started_at,
                            completed_at = excluded.completed_at,
                            actions_json = excluded.actions_json
                        """)
                .param("id", job.getId().toString())
                .param("mode", job.getMode().name())
                .param("source", job.getSource().name())
                .param("status", job.getStatus().name())
                .param("startedAt", job.getStartedAt())
                .param("completedAt", job.getCompletedAt())
                .param("actionsJson", writeActions(job.getActions()))
                .update();

        return job;
    }

    @Override
    public Optional<SyncJob> findById(UUID id) {
        return jdbcClient
                .sql(
                        """
                        select id, mode, source, status, started_at, completed_at, actions_json
                        from sync_jobs
                        where id = :id
                        """)
                .param("id", id.toString())
                .query(this::mapJob)
                .optional();
    }

    @Override
    public List<SyncJob> findRecent(int limit) {
        return jdbcClient
                .sql(
                        """
                        select id, mode, source, status, started_at, completed_at, actions_json
                        from sync_jobs
                        order by started_at desc
                        limit :limit
                        """)
                .param("limit", limit)
                .query(this::mapJob)
                .list();
    }

    private SyncJob mapJob(ResultSet resultSet, int rowNumber) throws SQLException {
        return new SyncJob(
                UUID.fromString(resultSet.getString("id")),
                SyncMode.valueOf(resultSet.getString("mode")),
                SyncSource.valueOf(resultSet.getString("source")),
                SyncStatus.valueOf(resultSet.getString("status")),
                readOffsetDateTime(resultSet, "started_at"),
                readActions(resultSet.getString("actions_json")))
                        .completedAt(readOffsetDateTime(resultSet, "completed_at"));
    }

    private OffsetDateTime readOffsetDateTime(ResultSet resultSet, String column) throws SQLException {
        return resultSet.getObject(column, OffsetDateTime.class);
    }

    private String writeActions(List<SyncAction> actions) {
        try {
            return objectMapper.writeValueAsString(actions);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to serialize sync actions.", exception);
        }
    }

    private List<SyncAction> readActions(String actionsJson) {
        try {
            return objectMapper.readValue(actionsJson, SYNC_ACTIONS_TYPE);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to deserialize sync actions.", exception);
        }
    }
}
