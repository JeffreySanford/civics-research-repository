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

/** PostgreSQL/H2-compatible durable store for federated corpus manifests. */
@Component
public class JdbcFederatedCorpusManifestStore implements FederatedCorpusManifestStore {
    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {};

    private final JdbcClient jdbcClient;
    private final ObjectMapper objectMapper;

    @Autowired
    public JdbcFederatedCorpusManifestStore(JdbcClient jdbcClient) {
        this(jdbcClient, new ObjectMapper());
    }

    JdbcFederatedCorpusManifestStore(JdbcClient jdbcClient, ObjectMapper objectMapper) {
        this.jdbcClient = jdbcClient;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    void createSchema() {
        jdbcClient
                .sql(
                        """
                        create table if not exists federated_corpus_manifests (
                            run_id text primary key,
                            manifest_version text not null,
                            source_system text not null,
                            run_adapter_version text not null,
                            record_adapter_versions_json text not null,
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
                            completion_cursor text,
                            run_started_at timestamp with time zone not null,
                            run_completed_at timestamp with time zone not null
                        )
                        """)
                .update();
        jdbcClient
                .sql(
                        """
                        create index if not exists federated_corpus_manifests_source_completed
                        on federated_corpus_manifests (source_system, run_completed_at)
                        """)
                .update();
    }

    @Override
    @Transactional
    public void save(FederatedCorpusManifest manifest) {
        Map<String, Object> values = params(manifest);
        int updated = jdbcClient
                .sql(
                        """
                        update federated_corpus_manifests set
                            manifest_version = :manifestVersion,
                            source_system = :sourceSystem,
                            run_adapter_version = :runAdapterVersion,
                            record_adapter_versions_json = :recordAdapterVersionsJson,
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
                            completion_cursor = :completionCursor,
                            run_started_at = :runStartedAt,
                            run_completed_at = :runCompletedAt
                        where run_id = :runId
                        """)
                .params(values)
                .update();

        if (updated == 0) {
            jdbcClient
                    .sql(
                            """
                            insert into federated_corpus_manifests (
                                run_id, manifest_version, source_system, run_adapter_version,
                                record_adapter_versions_json, retained_record_count, accepted_count,
                                rejected_count, skipped_count, first_record_id, last_record_id, sha256,
                                earliest_source_updated_at, latest_source_updated_at, page_size,
                                page_count, completion_cursor, run_started_at, run_completed_at
                            ) values (
                                :runId, :manifestVersion, :sourceSystem, :runAdapterVersion,
                                :recordAdapterVersionsJson, :retainedRecordCount, :acceptedCount,
                                :rejectedCount, :skippedCount, :firstRecordId, :lastRecordId, :sha256,
                                :earliestSourceUpdatedAt, :latestSourceUpdatedAt, :pageSize,
                                :pageCount, :completionCursor, :runStartedAt, :runCompletedAt
                            )
                            """)
                    .params(values)
                    .update();
        }
    }

    @Override
    public Optional<FederatedCorpusManifest> findByRunId(String runId) {
        return jdbcClient
                .sql("select * from federated_corpus_manifests where run_id = :runId")
                .param("runId", runId)
                .query(this::mapManifest)
                .optional();
    }

    @Override
    public List<FederatedCorpusManifest> findRecent(FederatedSourceSystem sourceSystem, int limit) {
        return jdbcClient
                .sql(
                        """
                        select * from federated_corpus_manifests
                        where source_system = :sourceSystem
                        order by run_completed_at desc, run_id desc
                        limit :limit
                        """)
                .param("sourceSystem", sourceSystem.name())
                .param("limit", Math.max(1, Math.min(limit, 1_000)))
                .query(this::mapManifest)
                .list();
    }

    private Map<String, Object> params(FederatedCorpusManifest manifest) {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("runId", manifest.runId());
        values.put("manifestVersion", manifest.manifestVersion());
        values.put("sourceSystem", manifest.sourceSystem().name());
        values.put("runAdapterVersion", manifest.runAdapterVersion());
        values.put("recordAdapterVersionsJson", json(manifest.recordAdapterVersions()));
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
        values.put("completionCursor", manifest.completionCursor());
        values.put("runStartedAt", manifest.runStartedAt());
        values.put("runCompletedAt", manifest.runCompletedAt());
        return values;
    }

    private FederatedCorpusManifest mapManifest(ResultSet resultSet, int rowNumber) throws SQLException {
        try {
            return new FederatedCorpusManifest(
                    resultSet.getString("manifest_version"),
                    resultSet.getString("run_id"),
                    FederatedSourceSystem.valueOf(resultSet.getString("source_system")),
                    resultSet.getString("run_adapter_version"),
                    objectMapper.readValue(resultSet.getString("record_adapter_versions_json"), STRING_LIST),
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
                    resultSet.getString("completion_cursor"),
                    resultSet.getObject("run_started_at", OffsetDateTime.class),
                    resultSet.getObject("run_completed_at", OffsetDateTime.class));
        } catch (JsonProcessingException exception) {
            throw new SQLException("Corpus manifest adapter versions could not be parsed.", exception);
        }
    }

    private String json(List<String> values) {
        try {
            return objectMapper.writeValueAsString(values);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Corpus manifest adapter versions could not be serialized.", exception);
        }
    }
}
