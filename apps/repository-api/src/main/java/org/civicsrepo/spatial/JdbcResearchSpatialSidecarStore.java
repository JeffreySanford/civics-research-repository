package org.civicsrepo.spatial;

import jakarta.annotation.PostConstruct;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import javax.sql.DataSource;
import org.civicsrepo.federation.FederatedSourceSystem;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** PostgreSQL/H2-compatible versioned persistence for research spatial evidence. */
@Component
public class JdbcResearchSpatialSidecarStore implements ResearchSpatialSidecarStore {
    private static final int WRITE_BATCH_SIZE = 1_000;
    private static final String UPDATE_ROW_SQL =
            """
            update research_spatial_sidecar_rows set
                schema_version = ?, source_snapshot_at = ?, captured_at = ?,
                composition_sha256 = ?, projection_id = ?, geometry_json = ?, geometry_type = ?,
                geometry_status = ?, min_lon = ?, min_lat = ?, max_lon = ?, max_lat = ?,
                source_centroid_lon = ?, source_centroid_lat = ?, source_centroid_method = ?,
                render_lon = ?, render_lat = ?, render_point_method = ?, raw_dcat_spatial = ?,
                provenance_json = ?, validation_json = ?
            where build_id = ? and source_system = ? and source_identifier = ?
            """;
    private static final String INSERT_RETAINED_ROW_SQL =
            """
            insert into research_spatial_sidecar_rows (
                build_id, source_system, source_identifier, schema_version,
                source_snapshot_at, captured_at, composition_sha256, projection_id,
                geometry_json, geometry_type, geometry_status,
                min_lon, min_lat, max_lon, max_lat,
                source_centroid_lon, source_centroid_lat, source_centroid_method,
                render_lon, render_lat, render_point_method, raw_dcat_spatial,
                provenance_json, validation_json
            )
            select ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            where exists (
                select 1 from federated_research_objects
                where source_system = ? and source_identifier = ?
            )
            """;

    private final JdbcClient jdbcClient;
    private final JdbcTemplate jdbcTemplate;

    @Autowired
    public JdbcResearchSpatialSidecarStore(JdbcClient jdbcClient, DataSource dataSource) {
        this(jdbcClient, new JdbcTemplate(dataSource));
    }

    JdbcResearchSpatialSidecarStore(JdbcClient jdbcClient, JdbcTemplate jdbcTemplate) {
        this.jdbcClient = jdbcClient;
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    void createSchema() {
        jdbcClient
                .sql(
                        """
                        create table if not exists research_spatial_sidecar_builds (
                            build_id text primary key,
                            source_system text not null,
                            schema_version integer not null,
                            source_snapshot_at timestamp with time zone not null,
                            captured_at timestamp with time zone not null,
                            composition_sha256 text not null,
                            projection_id text not null,
                            status text not null,
                            row_count bigint not null,
                            failure_message text,
                            completed_at timestamp with time zone
                        )
                        """)
                .update();
        jdbcClient
                .sql(
                        """
                        create index if not exists research_spatial_sidecar_build_source_capture
                        on research_spatial_sidecar_builds (source_system, captured_at)
                        """)
                .update();
        jdbcClient
                .sql(
                        """
                        create table if not exists research_spatial_sidecar_rows (
                            build_id text not null,
                            source_system text not null,
                            source_identifier text not null,
                            schema_version integer not null,
                            source_snapshot_at timestamp with time zone not null,
                            captured_at timestamp with time zone not null,
                            composition_sha256 text not null,
                            projection_id text not null,
                            geometry_json text,
                            geometry_type text,
                            geometry_status text not null,
                            min_lon double precision,
                            min_lat double precision,
                            max_lon double precision,
                            max_lat double precision,
                            source_centroid_lon double precision,
                            source_centroid_lat double precision,
                            source_centroid_method text,
                            render_lon double precision,
                            render_lat double precision,
                            render_point_method text,
                            raw_dcat_spatial text,
                            provenance_json text not null,
                            validation_json text not null,
                            primary key (build_id, source_system, source_identifier)
                        )
                        """)
                .update();
        jdbcClient
                .sql(
                        """
                        create index if not exists research_spatial_sidecar_rows_source_identifier
                        on research_spatial_sidecar_rows (source_system, source_identifier)
                        """)
                .update();
        jdbcClient
                .sql(
                        """
                        create index if not exists research_spatial_sidecar_rows_build_bounds
                        on research_spatial_sidecar_rows (build_id, min_lon, max_lon, min_lat, max_lat)
                        """)
                .update();
        jdbcClient
                .sql(
                        """
                        create table if not exists research_spatial_sidecar_activation (
                            source_system text primary key,
                            build_id text not null,
                            activated_at timestamp with time zone not null
                        )
                        """)
                .update();
    }

    @Override
    public void beginBuild(ResearchSpatialSidecarBuild build) {
        if (build.status() != ResearchSpatialSidecarBuild.Status.RUNNING) {
            throw new IllegalArgumentException("A new spatial sidecar build must start in RUNNING state.");
        }
        jdbcClient
                .sql(
                        """
                        insert into research_spatial_sidecar_builds (
                            build_id, source_system, schema_version, source_snapshot_at, captured_at,
                            composition_sha256, projection_id, status, row_count, failure_message, completed_at
                        ) values (
                            :buildId, :sourceSystem, :schemaVersion, :sourceSnapshotAt, :capturedAt,
                            :compositionSha256, :projectionId, :status, 0, null, null
                        )
                        """)
                .param("buildId", build.buildId())
                .param("sourceSystem", build.sourceSystem().name())
                .param("schemaVersion", build.schemaVersion())
                .param("sourceSnapshotAt", build.sourceSnapshotAt())
                .param("capturedAt", build.capturedAt())
                .param("compositionSha256", build.compositionSha256())
                .param("projectionId", build.projectionId())
                .param("status", build.status().name())
                .update();
    }

    @Override
    @Transactional
    public int upsertRetainedBatch(String buildId, List<ResearchSpatialSidecarRecord> records) {
        if (records == null || records.isEmpty()) {
            return 0;
        }
        ResearchSpatialSidecarBuild build = findBuild(buildId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown spatial sidecar build: " + buildId));
        if (build.status() != ResearchSpatialSidecarBuild.Status.RUNNING) {
            throw new IllegalStateException("Spatial sidecar build is not RUNNING: " + buildId);
        }

        List<ResearchSpatialSidecarRecord> coalesced = coalesce(records);
        for (ResearchSpatialSidecarRecord record : coalesced) {
            requireBuildIdentity(build, record);
        }

        int[][] updateCounts = jdbcTemplate.batchUpdate(
                UPDATE_ROW_SQL,
                coalesced,
                WRITE_BATCH_SIZE,
                (statement, record) -> bindUpdate(statement, buildId, record));
        List<ResearchSpatialSidecarRecord> inserts = recordsWithNoUpdate(coalesced, updateCounts);
        if (inserts.isEmpty()) {
            return coalesced.size();
        }
        int[][] insertCounts = jdbcTemplate.batchUpdate(
                INSERT_RETAINED_ROW_SQL,
                inserts,
                WRITE_BATCH_SIZE,
                (statement, record) -> bindInsert(statement, buildId, record));
        return coalesced.size() - countZeroUpdates(insertCounts);
    }

    @Override
    public long countBuildRows(String buildId) {
        return jdbcClient
                .sql("select count(*) from research_spatial_sidecar_rows where build_id = :buildId")
                .param("buildId", buildId)
                .query(Long.class)
                .single();
    }

    @Override
    @Transactional
    public ResearchSpatialSidecarBuild completeAndActivate(String buildId) {
        ResearchSpatialSidecarBuild build = findBuild(buildId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown spatial sidecar build: " + buildId));
        if (build.status() != ResearchSpatialSidecarBuild.Status.RUNNING) {
            throw new IllegalStateException("Only a RUNNING spatial sidecar build can be completed.");
        }
        long rowCount = countBuildRows(buildId);
        OffsetDateTime completedAt = OffsetDateTime.now();
        jdbcClient
                .sql(
                        """
                        update research_spatial_sidecar_builds
                        set status = :status, row_count = :rowCount, completed_at = :completedAt
                        where build_id = :buildId and status = :running
                        """)
                .param("status", ResearchSpatialSidecarBuild.Status.COMPLETE.name())
                .param("rowCount", rowCount)
                .param("completedAt", completedAt)
                .param("buildId", buildId)
                .param("running", ResearchSpatialSidecarBuild.Status.RUNNING.name())
                .update();

        int updated = jdbcClient
                .sql(
                        """
                        update research_spatial_sidecar_activation
                        set build_id = :buildId, activated_at = :activatedAt
                        where source_system = :sourceSystem
                        """)
                .param("buildId", buildId)
                .param("activatedAt", completedAt)
                .param("sourceSystem", build.sourceSystem().name())
                .update();
        if (updated == 0) {
            jdbcClient
                    .sql(
                            """
                            insert into research_spatial_sidecar_activation (source_system, build_id, activated_at)
                            values (:sourceSystem, :buildId, :activatedAt)
                            """)
                    .param("sourceSystem", build.sourceSystem().name())
                    .param("buildId", buildId)
                    .param("activatedAt", completedAt)
                    .update();
        }
        return findBuild(buildId).orElseThrow();
    }

    @Override
    public ResearchSpatialSidecarBuild failBuild(String buildId, String failureMessage) {
        ResearchSpatialSidecarBuild build = findBuild(buildId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown spatial sidecar build: " + buildId));
        if (build.status() != ResearchSpatialSidecarBuild.Status.RUNNING) {
            return build;
        }
        String safeMessage = failureMessage == null || failureMessage.isBlank() ? "Unknown spatial sidecar failure" : failureMessage.trim();
        OffsetDateTime completedAt = OffsetDateTime.now();
        jdbcClient
                .sql(
                        """
                        update research_spatial_sidecar_builds
                        set status = :status, row_count = :rowCount, failure_message = :failureMessage,
                            completed_at = :completedAt
                        where build_id = :buildId
                        """)
                .param("status", ResearchSpatialSidecarBuild.Status.FAILED.name())
                .param("rowCount", countBuildRows(buildId))
                .param("failureMessage", safeMessage)
                .param("completedAt", completedAt)
                .param("buildId", buildId)
                .update();
        return findBuild(buildId).orElseThrow();
    }

    @Override
    public Optional<ResearchSpatialSidecarBuild> findActiveBuild(FederatedSourceSystem sourceSystem) {
        return jdbcClient
                .sql(
                        """
                        select b.* from research_spatial_sidecar_builds b
                        join research_spatial_sidecar_activation a on a.build_id = b.build_id
                        where a.source_system = :sourceSystem and b.status = :status
                        """)
                .param("sourceSystem", sourceSystem.name())
                .param("status", ResearchSpatialSidecarBuild.Status.COMPLETE.name())
                .query(this::mapBuild)
                .optional();
    }

    @Override
    public Optional<ResearchSpatialSidecarRecord> findActive(
            FederatedSourceSystem sourceSystem, String sourceIdentifier) {
        return jdbcClient
                .sql(
                        """
                        select r.* from research_spatial_sidecar_rows r
                        join research_spatial_sidecar_activation a
                          on a.build_id = r.build_id and a.source_system = r.source_system
                        where r.source_system = :sourceSystem and r.source_identifier = :sourceIdentifier
                        """)
                .param("sourceSystem", sourceSystem.name())
                .param("sourceIdentifier", sourceIdentifier)
                .query(this::mapRecord)
                .optional();
    }

    @Override
    public long countActive(FederatedSourceSystem sourceSystem) {
        return jdbcClient
                .sql(
                        """
                        select count(*) from research_spatial_sidecar_rows r
                        join research_spatial_sidecar_activation a
                          on a.build_id = r.build_id and a.source_system = r.source_system
                        where r.source_system = :sourceSystem
                        """)
                .param("sourceSystem", sourceSystem.name())
                .query(Long.class)
                .single();
    }

    private Optional<ResearchSpatialSidecarBuild> findBuild(String buildId) {
        return jdbcClient
                .sql("select * from research_spatial_sidecar_builds where build_id = :buildId")
                .param("buildId", buildId)
                .query(this::mapBuild)
                .optional();
    }

    private List<ResearchSpatialSidecarRecord> coalesce(List<ResearchSpatialSidecarRecord> records) {
        Map<String, ResearchSpatialSidecarRecord> byIdentifier = new LinkedHashMap<>();
        for (ResearchSpatialSidecarRecord record : records) {
            byIdentifier.put(record.sourceSystem().name() + "\u001f" + record.sourceIdentifier(), record);
        }
        return List.copyOf(byIdentifier.values());
    }

    private void requireBuildIdentity(ResearchSpatialSidecarBuild build, ResearchSpatialSidecarRecord record) {
        if (record.sourceSystem() != build.sourceSystem()
                || record.schemaVersion() != build.schemaVersion()
                || !record.sourceSnapshotAt().equals(build.sourceSnapshotAt())
                || !record.compositionSha256().equals(build.compositionSha256())
                || !record.projectionId().equals(build.projectionId())) {
            throw new IllegalArgumentException("Spatial sidecar row identity does not match its build.");
        }
    }

    private List<ResearchSpatialSidecarRecord> recordsWithNoUpdate(
            List<ResearchSpatialSidecarRecord> records, int[][] updateCounts) {
        List<ResearchSpatialSidecarRecord> inserts = new ArrayList<>();
        int index = 0;
        for (int[] batch : updateCounts) {
            for (int count : batch) {
                if (count == 0) {
                    inserts.add(records.get(index));
                }
                index += 1;
            }
        }
        if (index != records.size()) {
            throw new IllegalStateException("JDBC batch update count did not match the spatial sidecar batch size.");
        }
        return inserts;
    }

    private int countZeroUpdates(int[][] counts) {
        int zero = 0;
        for (int[] batch : counts) {
            for (int count : batch) {
                if (count == 0) {
                    zero += 1;
                }
            }
        }
        return zero;
    }

    private void bindUpdate(PreparedStatement statement, String buildId, ResearchSpatialSidecarRecord record)
            throws SQLException {
        statement.setInt(1, record.schemaVersion());
        statement.setObject(2, record.sourceSnapshotAt());
        statement.setObject(3, record.capturedAt());
        statement.setString(4, record.compositionSha256());
        statement.setString(5, record.projectionId());
        setString(statement, 6, record.geometryJson());
        setString(statement, 7, record.geometryType());
        statement.setString(8, record.geometryStatus().name());
        setDouble(statement, 9, record.minLon());
        setDouble(statement, 10, record.minLat());
        setDouble(statement, 11, record.maxLon());
        setDouble(statement, 12, record.maxLat());
        setDouble(statement, 13, record.sourceCentroidLon());
        setDouble(statement, 14, record.sourceCentroidLat());
        setString(statement, 15, record.sourceCentroidMethod());
        setDouble(statement, 16, record.renderLon());
        setDouble(statement, 17, record.renderLat());
        setString(statement, 18, record.renderPointMethod());
        setString(statement, 19, record.rawDcatSpatial());
        statement.setString(20, record.provenanceJson());
        statement.setString(21, record.validationJson());
        statement.setString(22, buildId);
        statement.setString(23, record.sourceSystem().name());
        statement.setString(24, record.sourceIdentifier());
    }

    private void bindInsert(PreparedStatement statement, String buildId, ResearchSpatialSidecarRecord record)
            throws SQLException {
        statement.setString(1, buildId);
        statement.setString(2, record.sourceSystem().name());
        statement.setString(3, record.sourceIdentifier());
        statement.setInt(4, record.schemaVersion());
        statement.setObject(5, record.sourceSnapshotAt());
        statement.setObject(6, record.capturedAt());
        statement.setString(7, record.compositionSha256());
        statement.setString(8, record.projectionId());
        setString(statement, 9, record.geometryJson());
        setString(statement, 10, record.geometryType());
        statement.setString(11, record.geometryStatus().name());
        setDouble(statement, 12, record.minLon());
        setDouble(statement, 13, record.minLat());
        setDouble(statement, 14, record.maxLon());
        setDouble(statement, 15, record.maxLat());
        setDouble(statement, 16, record.sourceCentroidLon());
        setDouble(statement, 17, record.sourceCentroidLat());
        setString(statement, 18, record.sourceCentroidMethod());
        setDouble(statement, 19, record.renderLon());
        setDouble(statement, 20, record.renderLat());
        setString(statement, 21, record.renderPointMethod());
        setString(statement, 22, record.rawDcatSpatial());
        statement.setString(23, record.provenanceJson());
        statement.setString(24, record.validationJson());
        statement.setString(25, record.sourceSystem().name());
        statement.setString(26, record.sourceIdentifier());
    }

    private void setDouble(PreparedStatement statement, int index, Double value) throws SQLException {
        if (value == null) {
            statement.setNull(index, Types.DOUBLE);
        } else {
            statement.setDouble(index, value);
        }
    }

    private void setString(PreparedStatement statement, int index, String value) throws SQLException {
        if (value == null || value.isBlank()) {
            statement.setNull(index, Types.VARCHAR);
        } else {
            statement.setString(index, value);
        }
    }

    private ResearchSpatialSidecarBuild mapBuild(ResultSet resultSet, int rowNumber) throws SQLException {
        return new ResearchSpatialSidecarBuild(
                resultSet.getString("build_id"),
                FederatedSourceSystem.valueOf(resultSet.getString("source_system")),
                resultSet.getInt("schema_version"),
                resultSet.getObject("source_snapshot_at", OffsetDateTime.class),
                resultSet.getObject("captured_at", OffsetDateTime.class),
                resultSet.getString("composition_sha256"),
                resultSet.getString("projection_id"),
                ResearchSpatialSidecarBuild.Status.valueOf(resultSet.getString("status")),
                resultSet.getLong("row_count"),
                resultSet.getString("failure_message"),
                resultSet.getObject("completed_at", OffsetDateTime.class));
    }

    private ResearchSpatialSidecarRecord mapRecord(ResultSet resultSet, int rowNumber) throws SQLException {
        return new ResearchSpatialSidecarRecord(
                FederatedSourceSystem.valueOf(resultSet.getString("source_system")),
                resultSet.getString("source_identifier"),
                resultSet.getInt("schema_version"),
                resultSet.getObject("source_snapshot_at", OffsetDateTime.class),
                resultSet.getObject("captured_at", OffsetDateTime.class),
                resultSet.getString("composition_sha256"),
                resultSet.getString("projection_id"),
                resultSet.getString("geometry_json"),
                resultSet.getString("geometry_type"),
                SpatialGeometryStatus.valueOf(resultSet.getString("geometry_status")),
                nullableDouble(resultSet, "min_lon"),
                nullableDouble(resultSet, "min_lat"),
                nullableDouble(resultSet, "max_lon"),
                nullableDouble(resultSet, "max_lat"),
                nullableDouble(resultSet, "source_centroid_lon"),
                nullableDouble(resultSet, "source_centroid_lat"),
                resultSet.getString("source_centroid_method"),
                nullableDouble(resultSet, "render_lon"),
                nullableDouble(resultSet, "render_lat"),
                resultSet.getString("render_point_method"),
                resultSet.getString("raw_dcat_spatial"),
                resultSet.getString("provenance_json"),
                resultSet.getString("validation_json"));
    }

    private Double nullableDouble(ResultSet resultSet, String column) throws SQLException {
        double value = resultSet.getDouble(column);
        return resultSet.wasNull() ? null : value;
    }
}
