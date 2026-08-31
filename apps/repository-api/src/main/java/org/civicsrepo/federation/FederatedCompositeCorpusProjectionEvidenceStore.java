package org.civicsrepo.federation;

import java.util.List;
import java.util.Optional;

/** Durable history linking immutable composite identities to discovery projection identities. */
public interface FederatedCompositeCorpusProjectionEvidenceStore {
    void save(FederatedCompositeCorpusProjectionEvidence evidence);

    Optional<FederatedCompositeCorpusProjectionEvidence> findLatestByCompositionSha256(
            String compositionSha256);

    List<FederatedCompositeCorpusProjectionEvidence> findRecent(CorpusProfile corpusProfile, int limit);
}
