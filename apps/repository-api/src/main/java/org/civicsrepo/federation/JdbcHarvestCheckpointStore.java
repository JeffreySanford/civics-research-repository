package org.civicsrepo.federation;

import jakarta.annotation.PostConstruct;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** JDBC checkpoint store shared by every federated source adapter. */
@Component
public class JdbcHarvestCheckpointStore implements HarvestCheckpointStore {
    private final JdbcClient jdbcClient;

    public JdbcHarvestCheckpointStore(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    @PostConstruct
    void createSchema() {
        jdbcClient
                .sql(
                        """
                        create table if not exists federated_harvest_checkpoints (
                            source_system text primary key,
                            cursor_value text,
                            accepted_count bigint not null,
                            updated_at timestamp with time zone not null
                        )
                        """)
                .update();
    }

    @Override
    public Optional<HarvestCheckpoint> find(FederatedSourceSystem sourceSystem) {
        return jdbcClient
                .sql("select * from federated_harvest_checkpoints where source_system = :sourceSystem")
                .param("sourceSystem", sourceSystem.name())
                .query(this::mapCheckpoint)
                .optional();
    }

    @Override
    public void save(HarvestCheckpoint checkpoint) {
        int updated = jdbcClient
                .sql(
                        """
                        update federated_harvest_checkpoints set
                            cursor_value = :cursor,
                            accepted_count = :acceptedCount,
                            updated_at = :updatedAt
                        where source_system = :sourceSystem
                        """)
                .param("sourceSystem", checkpoint.sourceSystem().name())
                .param("cursor", checkpoint.cursor())
                .param("acceptedCount", checkpoint.acceptedCount())
                .param("updatedAt", checkpoint.updatedAt())
                .update();

        if (updated == 0) {
            jdbcClient
                    .sql(
                            """
                            insert into federated_harvest_checkpoints
                                (source_system, cursor_value, accepted_count, updated_at)
                            values (:sourceSystem, :cursor, :acceptedCount, :updatedAt)
                            """)
                    .param("sourceSystem", checkpoint.sourceSystem().name())
                    .param("cursor", checkpoint.cursor())
                    .param("acceptedCount", checkpoint.acceptedCount())
                    .param("updatedAt", checkpoint.updatedAt())
                    .update();
        }
    }

    @Override
    public void clear(FederatedSourceSystem sourceSystem) {
        jdbcClient
                .sql("delete from federated_harvest_checkpoints where source_system = :sourceSystem")
                .param("sourceSystem", sourceSystem.name())
                .update();
    }

    private HarvestCheckpoint mapCheckpoint(ResultSet resultSet, int rowNumber) throws SQLException {
        return new HarvestCheckpoint(
                FederatedSourceSystem.valueOf(resultSet.getString("source_system")),
                resultSet.getString("cursor_value"),
                resultSet.getLong("accepted_count"),
                resultSet.getObject("updated_at", OffsetDateTime.class));
    }
}
