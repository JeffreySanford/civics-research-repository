package org.civicsrepo.federation;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** PostgreSQL/H2-compatible durable store for intentionally bounded corpus checkpoints. */
@Component
public class JdbcFederatedBoundedSnapshotManifestStore implements FederatedBoundedSnapshotManifestStore {
    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {};

    private final JdbcClient jdbcClient;
    private final ObjectMapper objectMapper;

    @Autowired
    public JdbcFederatedBoundedSnapshotManifestStore(JdbcClient jdbcClient) {
        this(jdbcClient, new ObjectMapper());
    }

    JdbcFederatedBoundedSnapshotManifestStore(JdbcClient jdbcClient, ObjectMapper objectMapper) {
        this.jdbcClient = jdbcClient;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    void createSchema() {
        jdbcClient
                .sql(
                        """
                        create table if not exists federated_bounded_snapshot_manifests (
                            snapshot_id text primary key,
                            manifest_version text not null,
                            mode text not null,
                            run_id text not null,
                            source_system text not null,
                            run_adapter_version text not null,
                            record_adapter_versions_json text not null,
                            run_status text not null,
                            retained_record_count bigint not null,
                            accepted_count bigint not null,
                            rejected_count bigint not null,
                            skipped_count bigint not null,
                            first_record_id text,
                            last_record_id text,
                            sha256 text not null,
                            earliest_source_updated_at timestamp with time zone,
                            latest_source_updated_at timestamp with time zone,
                            page_size integer not null,
                            page_count integer not null,
                            cursor_value text,
                            run_started_at timestamp with time zone not null,
                            run_updated_at timestamp with time zone not null,
                            captured_at timestamp with time zone not null
                        )
                        """)
                .update();
        jdbcClient
                .sql(
                        """
                        create index if not exists federated_bounded_snapshots_source_captured
                        on federated_bounded_snapshot_manifests (source_system, captured_at)
                        """)
                .update();
        jdbcClient
                .sql(
                        """
                        create index if not exists federated_bounded_snapshots_run
                        on federated_bounded_snapshot_manifests (run_id, captured_at)
                        """)
                .update();
    }

    @Override
    @Transactional
    public void save(FederatedBoundedSnapshotManifest manifest) {
        Map<String, Object> values = params(manifest);
        int updated = jdbcClient
                .sql(
                        """
                        update federated_bounded_snapshot_manifests set
                            manifest_version = :manifestVersion,
                            mode = :mode,
                            run_id = :runId,
                            source_system = :sourceSystem,
                            run_adapter_version = :runAdapterVersion,
                            record_adapter_versions_json = :recordAdapterVersionsJson,
                            run_status = :runStatus,
                            retained_record_count = :retainedRecordCount,
                            accepted_count = :acceptedCount,
                            rejected_count = :rejectedCount,
                            skipped_count = :skippedCount,
                            first_record_id = :firstRecordId,
                            last_record_id = :lastRecordId,
                            sha256 = :sha256,
                            earliest_source_updated_at = :earliestSourceUpdatedAt,
                            latest_source_updated_at = :latestSourceUpdatedAt,
                            page_size = :pageSize,
                            page_count = :pageCount,
                            cursor_value = :cursor,
                            run_started_at = :runStartedAt,
                            run_updated_at = :runUpdatedAt,
                            captured_at = :capturedAt
                        where snapshot_id = :snapshotId
                        """)
                .params(values)
                .update();

        if (updated == 0) {
            jdbcClient
                    .sql(
                            """
                            insert into federated_bounded_snapshot_manifests (
                                snapshot_id, manifest_version, mode, run_id, source_system,
                                run_adapter_version, record_adapter_versions_json, run_status,
                                retained_record_count, accepted_count, rejected_count, skipped_count,
                                first_record_id, last_record_id, sha256, earliest_source_updated_at,
                                latest_source_updated_at, page_size, page_count, cursor_value,
                                run_started_at, run_updated_at, captured_at
                            ) values (
                                :snapshotId, :manifestVersion, :mode, :runId, :sourceSystem,
                                :runAdapterVersion, :recordAdapterVersionsJson, :runStatus,
                                :retainedRecordCount, :acceptedCount, :rejectedCount, :skippedCount,
                                :firstRecordId, :lastRecordId, :sha256, :earliestSourceUpdatedAt,
                                :latestSourceUpdatedAt, :pageSize, :pageCount, :cursor,
                                :runStartedAt, :runUpdatedAt, :capturedAt
                            )
                            """)
                    .params(values)
                    .update();
        }
    }

    @Override
    public Optional<FederatedBoundedSnapshotManifest> findBySnapshotId(String snapshotId) {
        return jdbcClient
                .sql("select * from federated_bounded_snapshot_manifests where snapshot_id = :snapshotId")
                .param("snapshotId", snapshotId)
                .query(this::mapManifest)
                .optional();
    }

    @Override
    public List<FederatedBoundedSnapshotManifest> findRecent(FederatedSourceSystem sourceSystem, int limit) {
        return jdbcClient
                .sql(
                        """
                        select * from federated_bounded_snapshot_manifests
                        where source_system = :sourceSystem
                        order by captured_at desc, snapshot_id desc
                        limit :limit
                        """)
                .param("sourceSystem", sourceSystem.name())
                .param("limit", Math.max(1, Math.min(limit, 1_000)))
                .query(this::mapManifest)
                .list();
    }

    private Map<String, Object> params(FederatedBoundedSnapshotManifest manifest) {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("snapshotId", manifest.snapshotId());
        values.put("manifestVersion", manifest.manifestVersion());
        values.put("mode", manifest.mode());
        values.put("runId", manifest.runId());
        values.put("sourceSystem", manifest.sourceSystem().name());
        values.put("runAdapterVersion", manifest.runAdapterVersion());
        values.put("recordAdapterVersionsJson", json(manifest.recordAdapterVersions()));
        values.put("runStatus", manifest.runStatus().name());
        values.put("retainedRecordCount", manifest.retainedRecordCount());
        values.put("acceptedCount", manifest.acceptedCount());
        values.put("rejectedCount", manifest.rejectedCount());
        values.put("skippedCount", manifest.skippedCount());
        values.put("firstRecordId", manifest.firstRecordId());
        values.put("lastRecordId", manifest.lastRecordId());
        values.put("sha256", manifest.sha256());
        values.put("earliestSourceUpdatedAt", manifest.earliestSourceUpdatedAt());
        values.put("latestSourceUpdatedAt", manifest.latestSourceUpdatedAt());
        values.put("pageSize", manifest.pageSize());
        values.put("pageCount", manifest.pageCount());
        values.put("cursor", manifest.cursor());
        values.put("runStartedAt", manifest.runStartedAt());
        values.put("runUpdatedAt", manifest.runUpdatedAt());
        values.put("capturedAt", manifest.capturedAt());
        return values;
    }

    private FederatedBoundedSnapshotManifest mapManifest(ResultSet resultSet, int rowNumber) throws SQLException {
        try {
            return new FederatedBoundedSnapshotManifest(
                    resultSet.getString("manifest_version"),
                    resultSet.getString("mode"),
                    resultSet.getString("snapshot_id"),
                    resultSet.getString("run_id"),
                    FederatedSourceSystem.valueOf(resultSet.getString("source_system")),
                    resultSet.getString("run_adapter_version"),
                    objectMapper.readValue(resultSet.getString("record_adapter_versions_json"), STRING_LIST),
                    HarvestRunStatus.valueOf(resultSet.getString("run_status")),
                    resultSet.getLong("retained_record_count"),
                    resultSet.getLong("accepted_count"),
                    resultSet.getLong("rejected_count"),
                    resultSet.getLong("skipped_count"),
                    resultSet.getString("first_record_id"),
                    resultSet.getString("last_record_id"),
                    resultSet.getString("sha256"),
                    resultSet.getObject("earliest_source_updated_at", OffsetDateTime.class),
                    resultSet.getObject("latest_source_updated_at", OffsetDateTime.class),
                    resultSet.getInt("page_size"),
                    resultSet.getInt("page_count"),
                    resultSet.getString("cursor_value"),
                    resultSet.getObject("run_started_at", OffsetDateTime.class),
                    resultSet.getObject("run_updated_at", OffsetDateTime.class),
                    resultSet.getObject("captured_at", OffsetDateTime.class));
        } catch (JsonProcessingException exception) {
            throw new SQLException("Bounded snapshot adapter versions could not be parsed.", exception);
        }
    }

    private String json(List<String> values) {
        try {
            return objectMapper.writeValueAsString(values);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Bounded snapshot adapter versions could not be serialized.", exception);
        }
    }
}
