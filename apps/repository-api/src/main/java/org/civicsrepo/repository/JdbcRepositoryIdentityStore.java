package org.civicsrepo.repository;

import jakarta.annotation.PostConstruct;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * Persists what each source identifier resolved to in the repository.
 *
 * <p>Lives in the application database, not in DSpace. DSpace owns the item; this table records the
 * correspondence between the identifier this system assigns and the item DSpace created, which is
 * information neither side holds on its own. It is rebuildable — dropping it costs a re-resolution,
 * not data — so it is a projection of truth rather than a second source of it.
 *
 * <p>Written on three separate occasions, because each learns a different fact: an apply learns the
 * UUID, a source probe learns freshness, a reindex learns when discovery last saw the object. Each
 * writes only its own columns, so a reindex cannot blank a UUID that sync recorded.
 */
@Component
public class JdbcRepositoryIdentityStore implements RepositoryIdentityStore {
    private static final Logger LOGGER = LoggerFactory.getLogger(JdbcRepositoryIdentityStore.class);

    private final JdbcClient jdbcClient;

    public JdbcRepositoryIdentityStore(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    @PostConstruct
    void createSchema() {
        jdbcClient
                .sql(
                        """
                        create table if not exists repository_objects (
                            source_identifier text primary key,
                            dspace_uuid text,
                            source_url text,
                            source_checked_at timestamp with time zone,
                            indexed_at timestamp with time zone,
                            updated_at timestamp with time zone not null
                        )
                        """)
                .update();
    }

    /**
     * Update first, insert when nothing was updated.
     *
     * <p>Not `on conflict … do update`: PostgreSQL supports it and H2 does not, and the context
     * tests run against H2. Two statements work on both and say the intent plainly, which is worth
     * more here than saving a round trip on a table written a few hundred times per rebuild.
     */
    @Override
    public void recordDspaceItem(String sourceIdentifier, String dspaceUuid, String sourceUrl) {
        if (sourceIdentifier == null || sourceIdentifier.isBlank() || dspaceUuid == null || dspaceUuid.isBlank()) {
            return;
        }

        OffsetDateTime now = OffsetDateTime.now();
        int updated = jdbcClient
                .sql(
                        """
                        update repository_objects set
                            dspace_uuid = :dspaceUuid,
                            source_url = coalesce(:sourceUrl, source_url),
                            source_checked_at = :checkedAt,
                            updated_at = :updatedAt
                        where source_identifier = :sourceIdentifier
                        """)
                .param("sourceIdentifier", sourceIdentifier)
                .param("dspaceUuid", dspaceUuid)
                .param("sourceUrl", sourceUrl)
                .param("checkedAt", now)
                .param("updatedAt", now)
                .update();

        if (updated == 0) {
            jdbcClient
                    .sql(
                            """
                            insert into repository_objects
                                (source_identifier, dspace_uuid, source_url, source_checked_at, updated_at)
                            values (:sourceIdentifier, :dspaceUuid, :sourceUrl, :checkedAt, :updatedAt)
                            """)
                    .param("sourceIdentifier", sourceIdentifier)
                    .param("dspaceUuid", dspaceUuid)
                    .param("sourceUrl", sourceUrl)
                    .param("checkedAt", now)
                    .param("updatedAt", now)
                    .update();
        }
    }

    /**
     * Stamps the objects the projection just indexed.
     *
     * <p>An object discovery has seen but sync has not yet touched still gets a row, so a missing
     * UUID is a fact about sync rather than about whether the object exists.
     */
    @Override
    public void recordIndexed(List<String> sourceIdentifiers) {
        OffsetDateTime indexedAt = OffsetDateTime.now();
        int recorded = 0;

        for (String sourceIdentifier : sourceIdentifiers) {
            if (sourceIdentifier == null || sourceIdentifier.isBlank()) {
                continue;
            }

            int updated = jdbcClient
                    .sql(
                            """
                            update repository_objects set indexed_at = :indexedAt, updated_at = :updatedAt
                            where source_identifier = :sourceIdentifier
                            """)
                    .param("sourceIdentifier", sourceIdentifier)
                    .param("indexedAt", indexedAt)
                    .param("updatedAt", indexedAt)
                    .update();

            if (updated == 0) {
                jdbcClient
                        .sql(
                                """
                                insert into repository_objects (source_identifier, indexed_at, updated_at)
                                values (:sourceIdentifier, :indexedAt, :updatedAt)
                                """)
                        .param("sourceIdentifier", sourceIdentifier)
                        .param("indexedAt", indexedAt)
                        .param("updatedAt", indexedAt)
                        .update();
            }
            recorded++;
        }

        LOGGER.info("Recorded discovery indexing for {} research objects.", recorded);
    }

    @Override
    public Optional<RepositoryIdentity> findBySourceIdentifier(String sourceIdentifier) {
        return jdbcClient
                .sql(
                        """
                        select source_identifier, dspace_uuid, source_url, source_checked_at, indexed_at
                        from repository_objects
                        where source_identifier = :sourceIdentifier
                        """)
                .param("sourceIdentifier", sourceIdentifier)
                .query(this::mapIdentity)
                .optional();
    }

    @Override
    public List<RepositoryIdentity> findAll() {
        return jdbcClient
                .sql(
                        """
                        select source_identifier, dspace_uuid, source_url, source_checked_at, indexed_at
                        from repository_objects
                        order by source_identifier
                        """)
                .query(this::mapIdentity)
                .list();
    }

    @Override
    public int countWithDspaceUuid() {
        return jdbcClient
                .sql("select count(*) from repository_objects where dspace_uuid is not null")
                .query(Integer.class)
                .single();
    }

    private RepositoryIdentity mapIdentity(ResultSet resultSet, int rowNumber) throws SQLException {
        return new RepositoryIdentity(
                resultSet.getString("source_identifier"),
                resultSet.getString("dspace_uuid"),
                resultSet.getString("source_url"),
                offsetDateTime(resultSet, "source_checked_at"),
                offsetDateTime(resultSet, "indexed_at"));
    }

    private OffsetDateTime offsetDateTime(ResultSet resultSet, String column) throws SQLException {
        var value = resultSet.getObject(column, OffsetDateTime.class);
        return resultSet.wasNull() ? null : value;
    }
}
