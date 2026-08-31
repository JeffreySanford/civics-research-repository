package org.civicsrepo.federation;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** PostgreSQL/H2-compatible durable store for immutable composite corpus evidence. */
@Component
public class JdbcFederatedCompositeCorpusManifestStore implements FederatedCompositeCorpusManifestStore {
    private static final TypeReference<List<Map<String, Object>>> SOURCE_LIST = new TypeReference<>() {};

    private final JdbcClient jdbcClient;
    private final ObjectMapper objectMapper;

    @Autowired
    public JdbcFederatedCompositeCorpusManifestStore(JdbcClient jdbcClient) {
        this(jdbcClient, new ObjectMapper());
    }

    JdbcFederatedCompositeCorpusManifestStore(JdbcClient jdbcClient, ObjectMapper objectMapper) {
        this.jdbcClient = jdbcClient;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    void createSchema() {
        jdbcClient
                .sql(
                        """
                        create table if not exists federated_composite_corpus_manifests (
                            composition_sha256 text primary key,
                            composition_version text not null,
                            mode text not null,
                            corpus_profile text not null,
                            sources_json text not null,
                            federated_record_count bigint not null,
                            captured_at timestamp with time zone not null
                        )
                        """)
                .update();
        jdbcClient
                .sql(
                        """
                        create index if not exists federated_composite_corpus_profile_captured
                        on federated_composite_corpus_manifests (corpus_profile, captured_at)
                        """)
                .update();
    }

    @Override
    public void save(FederatedCompositeCorpusManifest manifest) {
        try {
            jdbcClient
                    .sql(
                            """
                            insert into federated_composite_corpus_manifests (
                                composition_sha256, composition_version, mode, corpus_profile,
                                sources_json, federated_record_count, captured_at
                            ) values (
                                :compositionSha256, :compositionVersion, :mode, :corpusProfile,
                                :sourcesJson, :federatedRecordCount, :capturedAt
                            )
                            """)
                    .param("compositionSha256", manifest.compositionSha256())
                    .param("compositionVersion", manifest.compositionVersion())
                    .param("mode", manifest.mode())
                    .param("corpusProfile", manifest.corpusProfile().name())
                    .param("sourcesJson", json(manifest.sources()))
                    .param("federatedRecordCount", manifest.federatedRecordCount())
                    .param("capturedAt", manifest.capturedAt())
                    .update();
            return;
        } catch (DuplicateKeyException duplicateKey) {
            FederatedCompositeCorpusManifest existing = findByCompositionSha256(manifest.compositionSha256())
                    .orElseThrow(() -> duplicateKey);
            if (!sameIdentity(existing, manifest)) {
                throw new IllegalStateException(
                        "Composite corpus SHA-256 is already associated with different composition evidence",
                        duplicateKey);
            }
        }
    }

    @Override
    public Optional<FederatedCompositeCorpusManifest> findByCompositionSha256(String compositionSha256) {
        return jdbcClient
                .sql(
                        """
                        select * from federated_composite_corpus_manifests
                        where composition_sha256 = :compositionSha256
                        """)
                .param("compositionSha256", compositionSha256)
                .query(this::mapManifest)
                .optional();
    }

    @Override
    public List<FederatedCompositeCorpusManifest> findRecent(CorpusProfile corpusProfile, int limit) {
        return jdbcClient
                .sql(
                        """
                        select * from federated_composite_corpus_manifests
                        where corpus_profile = :corpusProfile
                        order by captured_at desc, composition_sha256 desc
                        limit :limit
                        """)
                .param("corpusProfile", corpusProfile.name())
                .param("limit", Math.max(1, Math.min(limit, 1_000)))
                .query(this::mapManifest)
                .list();
    }

    private FederatedCompositeCorpusManifest mapManifest(ResultSet resultSet, int rowNumber) throws SQLException {
        try {
            return new FederatedCompositeCorpusManifest(
                    resultSet.getString("composition_version"),
                    resultSet.getString("mode"),
                    CorpusProfile.valueOf(resultSet.getString("corpus_profile")),
                    parseSources(resultSet.getString("sources_json")),
                    resultSet.getLong("federated_record_count"),
                    resultSet.getString("composition_sha256"),
                    resultSet.getObject("captured_at", OffsetDateTime.class));
        } catch (JsonProcessingException exception) {
            throw new SQLException("Composite corpus sources could not be parsed.", exception);
        }
    }

    private boolean sameIdentity(
            FederatedCompositeCorpusManifest left, FederatedCompositeCorpusManifest right) {
        if (!left.compositionVersion().equals(right.compositionVersion())
                || !left.mode().equals(right.mode())
                || left.corpusProfile() != right.corpusProfile()
                || left.federatedRecordCount() != right.federatedRecordCount()
                || left.sources().size() != right.sources().size()) {
            return false;
        }
        for (int index = 0; index < left.sources().size(); index++) {
            FederatedCompositeCorpusSource leftSource = left.sources().get(index);
            FederatedCompositeCorpusSource rightSource = right.sources().get(index);
            if (leftSource.sourceSystem() != rightSource.sourceSystem()
                    || leftSource.requestedRecordCount() != rightSource.requestedRecordCount()
                    || !leftSource.snapshotId().equals(rightSource.snapshotId())
                    || !leftSource.sha256().equals(rightSource.sha256())) {
                return false;
            }
        }
        return true;
    }

    private String json(List<FederatedCompositeCorpusSource> sources) {
        List<Map<String, Object>> values = sources.stream().map(this::sourceValues).toList();
        try {
            return objectMapper.writeValueAsString(values);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Composite corpus sources could not be serialized.", exception);
        }
    }

    private Map<String, Object> sourceValues(FederatedCompositeCorpusSource source) {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("sourceSystem", source.sourceSystem().name());
        values.put("requestedRecordCount", source.requestedRecordCount());
        values.put("snapshotId", source.snapshotId());
        values.put("runId", source.runId());
        values.put("runAdapterVersion", source.runAdapterVersion());
        values.put("recordAdapterVersions", source.recordAdapterVersions());
        values.put("retainedRecordCount", source.retainedRecordCount());
        values.put("sha256", source.sha256());
        values.put("snapshotCapturedAt", source.snapshotCapturedAt().toString());
        return values;
    }

    private List<FederatedCompositeCorpusSource> parseSources(String json) throws JsonProcessingException {
        List<Map<String, Object>> values = objectMapper.readValue(json, SOURCE_LIST);
        List<FederatedCompositeCorpusSource> sources = new ArrayList<>();
        for (Map<String, Object> value : values) {
            @SuppressWarnings("unchecked")
            List<String> recordAdapterVersions = ((List<Object>) value.getOrDefault("recordAdapterVersions", List.of()))
                    .stream()
                    .map(String::valueOf)
                    .toList();
            sources.add(new FederatedCompositeCorpusSource(
                    FederatedSourceSystem.valueOf(String.valueOf(value.get("sourceSystem"))),
                    number(value, "requestedRecordCount"),
                    String.valueOf(value.get("snapshotId")),
                    String.valueOf(value.get("runId")),
                    String.valueOf(value.get("runAdapterVersion")),
                    recordAdapterVersions,
                    number(value, "retainedRecordCount"),
                    String.valueOf(value.get("sha256")),
                    OffsetDateTime.parse(String.valueOf(value.get("snapshotCapturedAt")))));
        }
        return List.copyOf(sources);
    }

    private long number(Map<String, Object> values, String key) {
        Object value = values.get(key);
        if (!(value instanceof Number number)) {
            throw new IllegalArgumentException("Composite corpus source field " + key + " must be numeric");
        }
        return number.longValue();
    }
}
