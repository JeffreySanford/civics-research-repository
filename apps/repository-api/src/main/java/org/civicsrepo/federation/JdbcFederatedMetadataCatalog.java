package org.civicsrepo.federation;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import java.net.URI;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import javax.sql.DataSource;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** PostgreSQL/H2-compatible persistence for normalized federated metadata. */
@Component
public class JdbcFederatedMetadataCatalog implements FederatedMetadataCatalog {
    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {};
    private static final TypeReference<Map<String, Object>> OBJECT_MAP = new TypeReference<>() {};
    private static final int WRITE_BATCH_SIZE = 1_000;
    private static final String UPDATE_SQL =
            """
            update federated_research_objects set
                title = ?,
                summary = ?,
                publisher = ?,
                program = ?,
                content_type = ?,
                source_url = ?,
                source_updated_at = ?,
                harvested_at = ?,
                adapter_version = ?,
                authors_json = ?,
                subjects_json = ?,
                source_metadata_json = ?,
                updated_at = ?
            where id = ?
            """;
    private static final String INSERT_SQL =
            """
            insert into federated_research_objects (
                id, source_system, source_identifier, title, summary, publisher, program,
                content_type, source_url, source_updated_at, harvested_at, adapter_version,
                authors_json, subjects_json, source_metadata_json, updated_at
            ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """;

    private final JdbcClient jdbcClient;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    @Autowired
    public JdbcFederatedMetadataCatalog(JdbcClient jdbcClient, DataSource dataSource) {
        this(jdbcClient, new JdbcTemplate(dataSource), new ObjectMapper());
    }

    JdbcFederatedMetadataCatalog(JdbcClient jdbcClient, JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcClient = jdbcClient;
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    void createSchema() {
        jdbcClient
                .sql(
                        """
                        create table if not exists federated_research_objects (
                            id text primary key,
                            source_system text not null,
                            source_identifier text not null,
                            title text not null,
                            summary text not null,
                            publisher text not null,
                            program text not null,
                            content_type text not null,
                            source_url text not null,
                            source_updated_at timestamp with time zone,
                            harvested_at timestamp with time zone not null,
                            adapter_version text not null,
                            authors_json text not null,
                            subjects_json text not null,
                            source_metadata_json text not null,
                            updated_at timestamp with time zone not null,
                            unique (source_system, source_identifier)
                        )
                        """)
                .update();
    }

    @Override
    @Transactional
    public void upsertBatch(List<FederatedResearchRecord> records) {
        if (records == null || records.isEmpty()) {
            return;
        }

        OffsetDateTime updatedAt = OffsetDateTime.now();
        List<PersistedRecord> persistedRecords = records.stream()
                .map(record -> new PersistedRecord(
                        record,
                        json(record.authors()),
                        json(record.subjects()),
                        json(record.sourceMetadata()),
                        updatedAt))
                .toList();

        int[][] updateCounts = jdbcTemplate.batchUpdate(
                UPDATE_SQL, persistedRecords, WRITE_BATCH_SIZE, this::bindUpdate);

        List<PersistedRecord> inserts = recordsWithNoUpdate(persistedRecords, updateCounts);
        if (!inserts.isEmpty()) {
            jdbcTemplate.batchUpdate(INSERT_SQL, inserts, WRITE_BATCH_SIZE, this::bindInsert);
        }
    }

    private List<PersistedRecord> recordsWithNoUpdate(List<PersistedRecord> records, int[][] updateCounts) {
        List<PersistedRecord> inserts = new ArrayList<>();
        int recordIndex = 0;
        for (int[] batchCounts : updateCounts) {
            for (int updateCount : batchCounts) {
                if (updateCount == 0) {
                    inserts.add(records.get(recordIndex));
                }
                recordIndex++;
            }
        }
        if (recordIndex != records.size()) {
            throw new IllegalStateException("JDBC batch update count did not match the federated metadata batch size.");
        }
        return inserts;
    }

    private void bindUpdate(PreparedStatement statement, PersistedRecord persisted) throws SQLException {
        FederatedResearchRecord record = persisted.record();
        statement.setString(1, record.title());
        statement.setString(2, record.summary());
        statement.setString(3, record.publisher());
        statement.setString(4, record.program());
        statement.setString(5, record.contentType().getValue());
        statement.setString(6, record.sourceUrl().toString());
        setOffsetDateTime(statement, 7, record.sourceUpdatedAt());
        statement.setObject(8, record.harvestedAt());
        statement.setString(9, record.adapterVersion());
        statement.setString(10, persisted.authorsJson());
        statement.setString(11, persisted.subjectsJson());
        statement.setString(12, persisted.sourceMetadataJson());
        statement.setObject(13, persisted.updatedAt());
        statement.setString(14, record.id());
    }

    private void bindInsert(PreparedStatement statement, PersistedRecord persisted) throws SQLException {
        FederatedResearchRecord record = persisted.record();
        statement.setString(1, record.id());
        statement.setString(2, record.sourceSystem().name());
        statement.setString(3, record.sourceIdentifier());
        statement.setString(4, record.title());
        statement.setString(5, record.summary());
        statement.setString(6, record.publisher());
        statement.setString(7, record.program());
        statement.setString(8, record.contentType().getValue());
        statement.setString(9, record.sourceUrl().toString());
        setOffsetDateTime(statement, 10, record.sourceUpdatedAt());
        statement.setObject(11, record.harvestedAt());
        statement.setString(12, record.adapterVersion());
        statement.setString(13, persisted.authorsJson());
        statement.setString(14, persisted.subjectsJson());
        statement.setString(15, persisted.sourceMetadataJson());
        statement.setObject(16, persisted.updatedAt());
    }

    private void setOffsetDateTime(PreparedStatement statement, int parameterIndex, OffsetDateTime value)
            throws SQLException {
        if (value == null) {
            statement.setNull(parameterIndex, Types.TIMESTAMP_WITH_TIMEZONE);
            return;
        }
        statement.setObject(parameterIndex, value);
    }

    @Override
    public Optional<FederatedResearchRecord> findById(String id) {
        return jdbcClient
                .sql("select * from federated_research_objects where id = :id")
                .param("id", id)
                .query(this::mapRecord)
                .optional();
    }

    @Override
    public List<FederatedResearchRecord> findAfterId(String afterId, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 10_000));
        if (afterId == null || afterId.isBlank()) {
            return jdbcClient
                    .sql("select * from federated_research_objects order by id limit :limit")
                    .param("limit", safeLimit)
                    .query(this::mapRecord)
                    .list();
        }
        return jdbcClient
                .sql("select * from federated_research_objects where id > :afterId order by id limit :limit")
                .param("afterId", afterId)
                .param("limit", safeLimit)
                .query(this::mapRecord)
                .list();
    }

    @Override
    public List<FederatedResearchRecord> findSourceAfterId(
            FederatedSourceSystem sourceSystem, String afterId, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 10_000));
        String cursor = afterId == null || afterId.isBlank() ? sourceSystem.name() + ":" : afterId;
        return jdbcClient
                .sql(
                        """
                        select * from federated_research_objects
                        where source_system = :sourceSystem and id > :afterId
                        order by id
                        limit :limit
                        """)
                .param("sourceSystem", sourceSystem.name())
                .param("afterId", cursor)
                .param("limit", safeLimit)
                .query(this::mapRecord)
                .list();
    }

    @Override
    public long count() {
        return jdbcClient.sql("select count(*) from federated_research_objects").query(Long.class).single();
    }

    @Override
    public long count(FederatedSourceSystem sourceSystem) {
        return jdbcClient
                .sql("select count(*) from federated_research_objects where source_system = :sourceSystem")
                .param("sourceSystem", sourceSystem.name())
                .query(Long.class)
                .single();
    }

    @Override
    @Transactional
    public void deleteAll() {
        jdbcClient.sql("delete from federated_research_objects").update();
    }

    private FederatedResearchRecord mapRecord(ResultSet resultSet, int rowNumber) throws SQLException {
        try {
            return new FederatedResearchRecord(
                    FederatedSourceSystem.valueOf(resultSet.getString("source_system")),
                    resultSet.getString("source_identifier"),
                    resultSet.getString("title"),
                    resultSet.getString("summary"),
                    resultSet.getString("publisher"),
                    resultSet.getString("program"),
                    ResearchObjectType.fromValue(resultSet.getString("content_type")),
                    URI.create(resultSet.getString("source_url")),
                    offsetDateTime(resultSet, "source_updated_at"),
                    offsetDateTime(resultSet, "harvested_at"),
                    resultSet.getString("adapter_version"),
                    objectMapper.readValue(resultSet.getString("authors_json"), STRING_LIST),
                    objectMapper.readValue(resultSet.getString("subjects_json"), STRING_LIST),
                    objectMapper.readValue(resultSet.getString("source_metadata_json"), OBJECT_MAP));
        } catch (JsonProcessingException exception) {
            throw new SQLException("Federated metadata JSON could not be parsed.", exception);
        }
    }

    private OffsetDateTime offsetDateTime(ResultSet resultSet, String column) throws SQLException {
        OffsetDateTime value = resultSet.getObject(column, OffsetDateTime.class);
        return resultSet.wasNull() ? null : value;
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Federated metadata JSON could not be serialized.", exception);
        }
    }

    private record PersistedRecord(
            FederatedResearchRecord record,
            String authorsJson,
            String subjectsJson,
            String sourceMetadataJson,
            OffsetDateTime updatedAt) {}
}
