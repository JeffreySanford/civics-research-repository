package org.civicsrepo.dspace;

import java.util.Optional;

public interface DspaceItemStateReader {
    Optional<DspaceItemPayload> findBySourceIdentifier(String sourceIdentifier);
}
