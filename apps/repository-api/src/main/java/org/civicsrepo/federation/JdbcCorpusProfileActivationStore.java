package org.civicsrepo.federation;

import jakarta.annotation.PostConstruct;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** PostgreSQL/H2-compatible singleton persistence for the active corpus profile. */
@Component
public class JdbcCorpusProfileActivationStore implements CorpusProfileActivationStore {
    private static final int ACTIVE_ROW_ID = 1;

    private final JdbcClient jdbcClient;

    public JdbcCorpusProfileActivationStore(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    @PostConstruct
    void createSchema() {
        jdbcClient
                .sql(
                        """
                        create table if not exists corpus_profile_activation (
                            id integer primary key,
                            profile text not null,
                            projection_id text not null,
                            projection_object_count bigint not null,
                            activated_at timestamp with time zone not null
                        )
                        """)
                .update();
    }

    @Override
    public Optional<CorpusProfileActivation> findActive() {
        return jdbcClient
                .sql("select * from corpus_profile_activation where id = :id")
                .param("id", ACTIVE_ROW_ID)
                .query(this::mapActivation)
                .optional();
    }

    @Override
    @Transactional
    public void save(CorpusProfileActivation activation) {
        int updated = jdbcClient
                .sql(
                        """
                        update corpus_profile_activation set
                            profile = :profile,
                            projection_id = :projectionId,
                            projection_object_count = :projectionObjectCount,
                            activated_at = :activatedAt
                        where id = :id
                        """)
                .param("profile", activation.profile().name())
                .param("projectionId", activation.projectionId())
                .param("projectionObjectCount", activation.projectionObjectCount())
                .param("activatedAt", activation.activatedAt())
                .param("id", ACTIVE_ROW_ID)
                .update();

        if (updated == 0) {
            jdbcClient
                    .sql(
                            """
                            insert into corpus_profile_activation (
                                id, profile, projection_id, projection_object_count, activated_at
                            ) values (:id, :profile, :projectionId, :projectionObjectCount, :activatedAt)
                            """)
                    .param("id", ACTIVE_ROW_ID)
                    .param("profile", activation.profile().name())
                    .param("projectionId", activation.projectionId())
                    .param("projectionObjectCount", activation.projectionObjectCount())
                    .param("activatedAt", activation.activatedAt())
                    .update();
        }
    }

    private CorpusProfileActivation mapActivation(ResultSet resultSet, int rowNumber) throws SQLException {
        return new CorpusProfileActivation(
                CorpusProfile.valueOf(resultSet.getString("profile")),
                resultSet.getString("projection_id"),
                resultSet.getLong("projection_object_count"),
                resultSet.getObject("activated_at", OffsetDateTime.class));
    }
}
