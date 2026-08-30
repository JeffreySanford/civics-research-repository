package org.civicsrepo.federation;

import java.time.OffsetDateTime;
import java.util.Objects;

/** Persisted identity of the corpus profile that successfully produced the active search projection. */
public record CorpusProfileActivation(
        CorpusProfile profile,
        String projectionId,
        long projectionObjectCount,
        OffsetDateTime activatedAt) {
    public CorpusProfileActivation {
        Objects.requireNonNull(profile, "profile");
        if (projectionId == null || projectionId.isBlank()) {
            throw new IllegalArgumentException("projectionId must not be blank");
        }
        if (projectionObjectCount < 0) {
            throw new IllegalArgumentException("projectionObjectCount must not be negative");
        }
        Objects.requireNonNull(activatedAt, "activatedAt");
    }
}
