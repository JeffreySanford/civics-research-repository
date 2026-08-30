package org.civicsrepo.federation;

import java.util.OptionalLong;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** PostgreSQL database footprint probe; unsupported test/local databases report unknown. */
@Component
public class ApplicationDatabaseStorageProbe {
    private final JdbcClient jdbcClient;

    public ApplicationDatabaseStorageProbe(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public OptionalLong databaseSizeBytes() {
        try {
            Long bytes = jdbcClient
                    .sql("select pg_database_size(current_database())")
                    .query(Long.class)
                    .single();
            return bytes == null || bytes < 0 ? OptionalLong.empty() : OptionalLong.of(bytes);
        } catch (RuntimeException exception) {
            // H2 and other non-PostgreSQL test databases intentionally land here. Unknown is more
            // accurate than fabricating zero bytes or teaching production code test-only SQL.
            return OptionalLong.empty();
        }
    }
}
