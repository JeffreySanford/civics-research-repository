package org.civicsrepo.dspace;

import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
public class EmptyDspaceItemStateReader implements DspaceItemStateReader {
    @Override
    public Optional<DspaceItemPayload> findBySourceIdentifier(String sourceIdentifier) {
        return Optional.empty();
    }
}
