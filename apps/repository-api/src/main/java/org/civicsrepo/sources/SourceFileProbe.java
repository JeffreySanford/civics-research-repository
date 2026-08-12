package org.civicsrepo.sources;

import java.util.Optional;

/**
 * Reads what a publishing host says about a source file.
 *
 * <p>An interface so the metadata adapters can be tested without network access, and so a sync run
 * can be pointed at a stub. Implementations must never throw: an unreachable publisher is an
 * expected condition, not an error, and it must degrade to compiled metadata rather than failing
 * the sync.
 */
public interface SourceFileProbe {
    Optional<SourceFileFacts> probe(String url);
}
