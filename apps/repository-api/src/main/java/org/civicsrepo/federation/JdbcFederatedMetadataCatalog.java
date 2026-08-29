package org.civicsrepo.federation;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import java.net.URI;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** PostgreSQL/H2-compatible persistence for normalized federated metadata. */
@Component
public class JdbcFederatedMetadataCatalog implements FederatedMetadataCatalog {
    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {};
    private static final TypeReference<Map<String, Object>> OBJECT_MAP = new TypeReference<>() {};

    private final JdbcClient jdbcClient;
    private final ObjectMapper objectMapper;

    public JdbcFederatedMetadataCatalog(JdbcClient jdbcClient, ObjectMapper objectMapper) {
        this.jdbcClient = jdbcClient;
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
    public void upsertBatch(List<FederatedResearchRecord> records) {
        if (records == null || records.isEmpty()) {
            return;
        }
        for (FederatedResearchRecord record : records) {
            upsert(record);
        }
    }

    private void upsert(FederatedResearchRecord record) {
        OffsetDateTime now = OffsetDateTime.now();
        int updated = jdbcClient
                .sql(
                        """
                        update federated_research_objects set
                            title = :title,
                            summary = :summary,
                            publisher = :publisher,
                            program = :program,
                            content_type = :contentType,
                            source_url = :sourceUrl,
                            source_updated_at = :sourceUpdatedAt,
                            harvested_at = :harvestedAt,
                            adapter_version = :adapterVersion,
                            authors_json = :authorsJson,
                            subjects_json = :subjectsJson,
                            source_metadata_json = :sourceMetadataJson,
                            updated_at = :updatedAt
                        where id = :id
                        """)
                .param("id", record.id())
                .param("title", record.title())
                .param("summary", record.summary())
                .param("publisher", record.publisher())
                .param("program", record.program())
                .param("contentType", record.contentType().getValue())
                .param("sourceUrl", record.sourceUrl().toString())
                .param("sourceUpdatedAt", record.sourceUpdatedAt())
                .param("harvestedAt", record.harvestedAt())
                .param("adapterVersion", record.adapterVersion())
                .param("authorsJson", json(record.authors()))
                .param("subjectsJson", json(record.subjects()))
                .param("sourceMetadataJson", json(record.sourceMetadata()))
                .param("updatedAt", now)
                .update();

        if (updated != 0) {
            return;
        }

        jdbcClient
                .sql(
                        """
                        insert into federated_research_objects (
                            id, source_system, source_identifier, title, summary, publisher, program,
                            content_type, source_url, source_updated_at, harvested_at, adapter_version,
                            authors_json, subjects_json, source_metadata_json, updated_at
                        ) values (
                            :id, :sourceSystem, :sourceIdentifier, :title, :summary, :publisher, :program,
                            :contentType, :sourceUrl, :sourceUpdatedAt, :harvestedAt, :adapterVersion,
                            :authorsJson, :subjectsJson, :sourceMetadataJson, :updatedAt
                        )
                        """)
                .param("id", record.id())
                .param("sourceSystem", record.sourceSystem().name())
                .param("sourceIdentifier", record.sourceIdentifier())
                .param("title", record.title())
                .param("summary", record.summary())
                .param("publisher", record.publisher())
                .param("program", record.program())
                .param("contentType", record.contentType().getValue())
                .param("sourceUrl", record.sourceUrl().toString())
                .param("sourceUpdatedAt", record.sourceUpdatedAt())
                .param("harvestedAt", record.harvestedAt())
                .param("adapterVersion", record.adapterVersion())
                .param("authorsJson", json(record.authors()))
                .param("subjectsJson", json(record.subjects()))
                .param("sourceMetadataJson", json(record.sourceMetadata()))
                .param("updatedAt", now)
                .update();
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
    public long count() {
        return jdbcClient.sql("select count(*) from federated_research_objects").query(Long.class).single();
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
}
