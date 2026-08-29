package org.civicsrepo.federation;

import jakarta.annotation.PostConstruct;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** JDBC-backed immutable storage history for corpus/profile measurements. */
@Component
public class JdbcCorpusStorageMeasurementStore implements CorpusStorageMeasurementStore {
    private final JdbcClient jdbcClient;

    public JdbcCorpusStorageMeasurementStore(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    @PostConstruct
    void createSchema() {
        jdbcClient
                .sql(
                        """
                        create table if not exists corpus_storage_measurements (
                            id text primary key,
                            profile text not null,
                            topology text not null,
                            active_projection_count bigint not null,
                            retained_federated_count bigint not null,
                            projection_id text,
                            application_postgres_bytes bigint,
                            dspace_stored_bytes bigint,
                            solr_index_bytes bigint,
                            opensearch_index_bytes bigint,
                            captured_at timestamp with time zone not null
                        )
                        """)
                .update();
    }

    @Override
    public void save(CorpusStorageMeasurement measurement) {
        jdbcClient
                .sql(
                        """
                        insert into corpus_storage_measurements (
                            id, profile, topology, active_projection_count, retained_federated_count,
                            projection_id, application_postgres_bytes, dspace_stored_bytes,
                            solr_index_bytes, opensearch_index_bytes, captured_at
                        ) values (
                            :id, :profile, :topology, :activeProjectionCount, :retainedFederatedCount,
                            :projectionId, :applicationPostgresBytes, :dspaceStoredBytes,
                            :solrIndexBytes, :openSearchIndexBytes, :capturedAt
                        )
                        """)
                .param("id", measurement.id())
                .param("profile", measurement.profile().name())
                .param("topology", measurement.topology().name())
                .param("activeProjectionCount", measurement.activeProjectionCount())
                .param("retainedFederatedCount", measurement.retainedFederatedCount())
                .param("projectionId", measurement.projectionId())
                .param("applicationPostgresBytes", measurement.applicationPostgresBytes())
                .param("dspaceStoredBytes", measurement.dspaceStoredBytes())
                .param("solrIndexBytes", measurement.solrIndexBytes())
                .param("openSearchIndexBytes", measurement.openSearchIndexBytes())
                .param("capturedAt", measurement.capturedAt())
                .update();
    }

    @Override
    public List<CorpusStorageMeasurement> findRecent(int limit) {
        return jdbcClient
                .sql("select * from corpus_storage_measurements order by captured_at desc, id desc limit :limit")
                .param("limit", safeLimit(limit))
                .query(this::mapMeasurement)
                .list();
    }

    @Override
    public List<CorpusStorageMeasurement> findRecentByProfile(CorpusProfile profile, int limit) {
        return jdbcClient
                .sql(
                        """
                        select * from corpus_storage_measurements
                        where profile = :profile
                        order by captured_at desc, id desc
                        limit :limit
                        """)
                .param("profile", profile.name())
                .param("limit", safeLimit(limit))
                .query(this::mapMeasurement)
                .list();
    }

    private CorpusStorageMeasurement mapMeasurement(ResultSet resultSet, int rowNumber) throws SQLException {
        return new CorpusStorageMeasurement(
                resultSet.getString("id"),
                CorpusProfile.valueOf(resultSet.getString("profile")),
                DeploymentTopology.valueOf(resultSet.getString("topology")),
                resultSet.getLong("active_projection_count"),
                resultSet.getLong("retained_federated_count"),
                resultSet.getString("projection_id"),
                nullableLong(resultSet, "application_postgres_bytes"),
                nullableLong(resultSet, "dspace_stored_bytes"),
                nullableLong(resultSet, "solr_index_bytes"),
                nullableLong(resultSet, "opensearch_index_bytes"),
                resultSet.getObject("captured_at", OffsetDateTime.class));
    }

    private Long nullableLong(ResultSet resultSet, String column) throws SQLException {
        long value = resultSet.getLong(column);
        return resultSet.wasNull() ? null : value;
    }

    private int safeLimit(int limit) {
        return Math.max(1, Math.min(limit, 1_000));
    }
}
