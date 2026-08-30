package org.civicsrepo.federation;

import java.util.List;
import java.util.Optional;

/** Durable store for reproducible federated corpus manifests. */
public interface FederatedCorpusManifestStore {
    void save(FederatedCorpusManifest manifest);

    Optional<FederatedCorpusManifest> findByRunId(String runId);

    List<FederatedCorpusManifest> findRecent(FederatedSourceSystem sourceSystem, int limit);
}
