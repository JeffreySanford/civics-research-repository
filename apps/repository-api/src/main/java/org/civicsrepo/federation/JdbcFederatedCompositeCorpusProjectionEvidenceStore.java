package org.civicsrepo.federation;

import jakarta.annotation.PostConstruct;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.civicsrepo.generated.dto.RepositorySource;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** PostgreSQL/H2-compatible durable composite-corpus to projection evidence history. */
@Component
public class JdbcFederatedCompositeCorpusProjectionEvidenceStore
        implements FederatedCompositeCorpusProjectionEvidenceStore {
    private final JdbcClient jdbcClient;

    public JdbcFederatedCompositeCorpusProjectionEvidenceStore(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    @PostConstruct
    void createSchema() {
        jdbcClient
                .sql(
                        """
                        create table if not exists federated_composite_projection_evidence (
                            composition_sha256 text not null,
                            projection_id text not null,
                            corpus_profile text not null,
                            federated_record_count bigint not null,
                            projection_source text not null,
                            projection_object_count integer not null,
                            projection_rebuilt_at timestamp with time zone not null,
                            linked_at timestamp with time zone not null,
                            primary key (composition_sha256, projection_id)
                        )
                        """)
                .update();
        jdbcClient
                .sql(
                        """
                        create index if not exists federated_composite_projection_profile_linked
                        on federated_composite_projection_evidence (corpus_profile, linked_at)
                        """)
                .update();
    }

    @Override
    public void save(FederatedCompositeCorpusProjectionEvidence evidence) {
        try {
            jdbcClient
                    .sql(
                            """
                            insert into federated_composite_projection_evidence (
                                composition_sha256, projection_id, corpus_profile,
                                federated_record_count, projection_source, projection_object_count,
                                projection_rebuilt_at, linked_at
                            ) values (
                                :compositionSha256, :projectionId, :corpusProfile,
                                :federatedRecordCount, :projectionSource, :projectionObjectCount,
                                :projectionRebuiltAt, :linkedAt
                            )
                            """)
                    .param("compositionSha256", evidence.compositionSha256())
                    .param("projectionId", evidence.projectionId())
                    .param("corpusProfile", evidence.corpusProfile().name())
                    .param("federatedRecordCount", evidence.federatedRecordCount())
                    .param("projectionSource", evidence.projectionSource().getValue())
                    .param("projectionObjectCount", evidence.projectionObjectCount())
                    .param("projectionRebuiltAt", evidence.projectionRebuiltAt())
                    .param("linkedAt", evidence.linkedAt())
                    .update();
            return;
        } catch (DuplicateKeyException duplicateKey) {
            FederatedCompositeCorpusProjectionEvidence existing = findExact(
                            evidence.compositionSha256(), evidence.projectionId())
                    .orElseThrow(() -> duplicateKey);
            if (!sameIdentity(existing, evidence)) {
                throw new IllegalStateException(
                        "Composite projection identity is already associated with different evidence",
                        duplicateKey);
            }
        }
    }

    @Override
    public Optional<FederatedCompositeCorpusProjectionEvidence> findLatestByCompositionSha256(
            String compositionSha256) {
        return jdbcClient
                .sql(
                        """
                        select * from federated_composite_projection_evidence
                        where composition_sha256 = :compositionSha256
                        order by linked_at desc, projection_id desc
                        limit 1
                        """)
                .param("compositionSha256", compositionSha256)
                .query(this::mapEvidence)
                .optional();
    }

    @Override
    public List<FederatedCompositeCorpusProjectionEvidence> findRecent(CorpusProfile corpusProfile, int limit) {
        return jdbcClient
                .sql(
                        """
                        select * from federated_composite_projection_evidence
                        where corpus_profile = :corpusProfile
                        order by linked_at desc, composition_sha256 desc, projection_id desc
                        limit :limit
                        """)
                .param("corpusProfile", corpusProfile.name())
                .param("limit", Math.max(1, Math.min(limit, 1_000)))
                .query(this::mapEvidence)
                .list();
    }

    private Optional<FederatedCompositeCorpusProjectionEvidence> findExact(
            String compositionSha256, String projectionId) {
        return jdbcClient
                .sql(
                        """
                        select * from federated_composite_projection_evidence
                        where composition_sha256 = :compositionSha256
                          and projection_id = :projectionId
                        """)
                .param("compositionSha256", compositionSha256)
                .param("projectionId", projectionId)
                .query(this::mapEvidence)
                .optional();
    }

    private boolean sameIdentity(
            FederatedCompositeCorpusProjectionEvidence left,
            FederatedCompositeCorpusProjectionEvidence right) {
        return left.compositionSha256().equals(right.compositionSha256())
                && left.corpusProfile() == right.corpusProfile()
                && left.federatedRecordCount() == right.federatedRecordCount()
                && left.projectionId().equals(right.projectionId())
                && left.projectionSource() == right.projectionSource()
                && left.projectionObjectCount() == right.projectionObjectCount();
    }

    private FederatedCompositeCorpusProjectionEvidence mapEvidence(ResultSet resultSet, int rowNumber)
            throws SQLException {
        return new FederatedCompositeCorpusProjectionEvidence(
                resultSet.getString("composition_sha256"),
                CorpusProfile.valueOf(resultSet.getString("corpus_profile")),
                resultSet.getLong("federated_record_count"),
                resultSet.getString("projection_id"),
                RepositorySource.fromValue(resultSet.getString("projection_source")),
                resultSet.getInt("projection_object_count"),
                resultSet.getObject("projection_rebuilt_at", OffsetDateTime.class),
                resultSet.getObject("linked_at", OffsetDateTime.class));
    }
}
