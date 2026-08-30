package org.civicsrepo.federation;

import jakarta.annotation.PostConstruct;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.civicsrepo.generated.dto.RepositorySource;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** PostgreSQL/H2-compatible durable snapshot-to-projection evidence store. */
@Component
public class JdbcFederatedSnapshotProjectionEvidenceStore implements FederatedSnapshotProjectionEvidenceStore {
    private final JdbcClient jdbcClient;

    public JdbcFederatedSnapshotProjectionEvidenceStore(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    @PostConstruct
    void createSchema() {
        jdbcClient
                .sql(
                        """
                        create table if not exists federated_snapshot_projection_evidence (
                            snapshot_id text not null,
                            projection_id text not null,
                            run_id text not null,
                            source_system text not null,
                            snapshot_sha256 text not null,
                            snapshot_retained_record_count bigint not null,
                            projection_source text not null,
                            projection_object_count integer not null,
                            projection_rebuilt_at timestamp with time zone not null,
                            linked_at timestamp with time zone not null,
                            primary key (snapshot_id, projection_id)
                        )
                        """)
                .update();
        jdbcClient
                .sql(
                        """
                        create index if not exists federated_snapshot_projection_evidence_source_linked
                        on federated_snapshot_projection_evidence (source_system, linked_at)
                        """)
                .update();
    }

    @Override
    @Transactional
    public void save(FederatedSnapshotProjectionEvidence evidence) {
        Map<String, Object> values = Map.ofEntries(
                Map.entry("snapshotId", evidence.snapshotId()),
                Map.entry("projectionId", evidence.projectionId()),
                Map.entry("runId", evidence.runId()),
                Map.entry("sourceSystem", evidence.sourceSystem().name()),
                Map.entry("snapshotSha256", evidence.snapshotSha256()),
                Map.entry("snapshotRetainedRecordCount", evidence.snapshotRetainedRecordCount()),
                Map.entry("projectionSource", evidence.projectionSource().getValue()),
                Map.entry("projectionObjectCount", evidence.projectionObjectCount()),
                Map.entry("projectionRebuiltAt", evidence.projectionRebuiltAt()),
                Map.entry("linkedAt", evidence.linkedAt()));

        int updated = jdbcClient
                .sql(
                        """
                        update federated_snapshot_projection_evidence set
                            run_id = :runId,
                            source_system = :sourceSystem,
                            snapshot_sha256 = :snapshotSha256,
                            snapshot_retained_record_count = :snapshotRetainedRecordCount,
                            projection_source = :projectionSource,
                            projection_object_count = :projectionObjectCount,
                            projection_rebuilt_at = :projectionRebuiltAt,
                            linked_at = :linkedAt
                        where snapshot_id = :snapshotId and projection_id = :projectionId
                        """)
                .params(values)
                .update();

        if (updated == 0) {
            jdbcClient
                    .sql(
                            """
                            insert into federated_snapshot_projection_evidence (
                                snapshot_id, projection_id, run_id, source_system, snapshot_sha256,
                                snapshot_retained_record_count, projection_source, projection_object_count,
                                projection_rebuilt_at, linked_at
                            ) values (
                                :snapshotId, :projectionId, :runId, :sourceSystem, :snapshotSha256,
                                :snapshotRetainedRecordCount, :projectionSource, :projectionObjectCount,
                                :projectionRebuiltAt, :linkedAt
                            )
                            """)
                    .params(values)
                    .update();
        }
    }

    @Override
    public List<FederatedSnapshotProjectionEvidence> findRecent(FederatedSourceSystem sourceSystem, int limit) {
        return jdbcClient
                .sql(
                        """
                        select * from federated_snapshot_projection_evidence
                        where source_system = :sourceSystem
                        order by linked_at desc, snapshot_id desc, projection_id desc
                        limit :limit
                        """)
                .param("sourceSystem", sourceSystem.name())
                .param("limit", Math.max(1, Math.min(limit, 1_000)))
                .query(this::mapEvidence)
                .list();
    }

    private FederatedSnapshotProjectionEvidence mapEvidence(ResultSet resultSet, int rowNumber) throws SQLException {
        return new FederatedSnapshotProjectionEvidence(
                resultSet.getString("snapshot_id"),
                resultSet.getString("run_id"),
                FederatedSourceSystem.valueOf(resultSet.getString("source_system")),
                resultSet.getString("snapshot_sha256"),
                resultSet.getLong("snapshot_retained_record_count"),
                resultSet.getString("projection_id"),
                RepositorySource.fromValue(resultSet.getString("projection_source")),
                resultSet.getInt("projection_object_count"),
                resultSet.getObject("projection_rebuilt_at", OffsetDateTime.class),
                resultSet.getObject("linked_at", OffsetDateTime.class));
    }
}
