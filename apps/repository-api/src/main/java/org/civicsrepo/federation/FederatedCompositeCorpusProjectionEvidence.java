package org.civicsrepo.federation;

import java.time.OffsetDateTime;
import java.util.Objects;
import org.civicsrepo.generated.dto.RepositorySource;

/** Durable proof that one exact composite federated corpus built one discovery projection. */
public record FederatedCompositeCorpusProjectionEvidence(
        String compositionSha256,
        CorpusProfile corpusProfile,
        long federatedRecordCount,
        String projectionId,
        RepositorySource projectionSource,
        int projectionObjectCount,
        OffsetDateTime projectionRebuiltAt,
        OffsetDateTime linkedAt) {

    public FederatedCompositeCorpusProjectionEvidence {
        compositionSha256 = requireSha(compositionSha256, "compositionSha256");
        Objects.requireNonNull(corpusProfile, "corpusProfile");
        if (federatedRecordCount < 1) {
            throw new IllegalArgumentException("federatedRecordCount must be positive");
        }
        projectionId = requireSha(projectionId, "projectionId");
        Objects.requireNonNull(projectionSource, "projectionSource");
        if (projectionObjectCount < federatedRecordCount) {
            throw new IllegalArgumentException(
                    "projectionObjectCount must include at least the composed federated records");
        }
        Objects.requireNonNull(projectionRebuiltAt, "projectionRebuiltAt");
        Objects.requireNonNull(linkedAt, "linkedAt");
    }

    private static String requireSha(String value, String field) {
        if (value == null || !value.matches("[0-9a-f]{64}")) {
            throw new IllegalArgumentException(field + " must be a lowercase SHA-256 hex digest");
        }
        return value;
    }
}
