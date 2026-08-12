package org.civicsrepo.sources;

import java.util.Optional;

/**
 * A probe that reports nothing, for tests.
 *
 * <p>Unit tests must not depend on census.gov being reachable, and must not be slowed by it. Using
 * this also exercises the path that matters most: the adapter falling back to compiled metadata
 * when the publisher cannot be asked.
 */
public class OfflineSourceFileProbe implements SourceFileProbe {
    @Override
    public Optional<SourceFileFacts> probe(String url) {
        return Optional.empty();
    }
}
