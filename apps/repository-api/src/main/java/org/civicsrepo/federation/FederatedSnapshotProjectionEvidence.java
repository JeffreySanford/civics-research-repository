package org.civicsrepo.federation;

import java.time.OffsetDateTime;
import java.util.Objects;
import org.civicsrepo.generated.dto.RepositorySource;

/** Durable proof that one bounded source snapshot was used to build one combined search projection. */
public record FederatedSnapshotProjectionEvidence(
        String snapshotId,
        String runId,
        FederatedSourceSystem sourceSystem,
        String snapshotSha256,
        long snapshotRetainedRecordCount,
        String projectionId,
        RepositorySource projectionSource,
        int projectionObjectCount,
        OffsetDateTime projectionRebuiltAt,
        OffsetDateTime linkedAt) {

    public FederatedSnapshotProjectionEvidence {
        snapshotId = requireText(snapshotId, "snapshotId");
        runId = requireText(runId, "runId");
        Objects.requireNonNull(sourceSystem, "sourceSystem");
        snapshotSha256 = requireSha(snapshotSha256, "snapshotSha256");
        if (snapshotRetainedRecordCount < 0) {
            throw new IllegalArgumentException("snapshotRetainedRecordCount must not be negative");
        }
        projectionId = requireSha(projectionId, "projectionId");
        Objects.requireNonNull(projectionSource, "projectionSource");
        if (projectionObjectCount < 0) {
            throw new IllegalArgumentException("projectionObjectCount must not be negative");
        }
        Objects.requireNonNull(projectionRebuiltAt, "projectionRebuiltAt");
        Objects.requireNonNull(linkedAt, "linkedAt");
    }

    private static String requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        return value.trim();
    }

    private static String requireSha(String value, String field) {
        String normalized = requireText(value, field);
        if (!normalized.matches("[0-9a-f]{64}")) {
            throw new IllegalArgumentException(field + " must be a lowercase SHA-256 hex digest");
        }
        return normalized;
    }
}
