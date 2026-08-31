package org.civicsrepo.federation;

import java.util.List;
import java.util.Optional;

/** Durable immutable history for evidence-grade composite federated corpora. */
public interface FederatedCompositeCorpusManifestStore {
    void save(FederatedCompositeCorpusManifest manifest);

    Optional<FederatedCompositeCorpusManifest> findByCompositionSha256(String compositionSha256);

    List<FederatedCompositeCorpusManifest> findRecent(CorpusProfile corpusProfile, int limit);
}
