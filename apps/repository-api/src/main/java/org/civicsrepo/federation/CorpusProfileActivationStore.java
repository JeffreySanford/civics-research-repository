package org.civicsrepo.federation;

import java.util.Optional;

/** Durable singleton state for the profile represented by the active search projection. */
public interface CorpusProfileActivationStore {
    Optional<CorpusProfileActivation> findActive();

    void save(CorpusProfileActivation activation);
}
