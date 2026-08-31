package org.civicsrepo.federation;

import java.util.Objects;

/** Explicit source quota and immutable bounded snapshot selected for a composite corpus. */
public record FederatedCompositeCorpusSourceRequest(
        FederatedSourceSystem sourceSystem, long requestedRecordCount, String snapshotId) {

    public FederatedCompositeCorpusSourceRequest {
        Objects.requireNonNull(sourceSystem, "sourceSystem");
        if (requestedRecordCount < 1) {
            throw new IllegalArgumentException("requestedRecordCount must be at least 1");
        }
        if (snapshotId == null || snapshotId.isBlank()) {
            throw new IllegalArgumentException("snapshotId must not be blank");
        }
        snapshotId = snapshotId.trim();
    }
}
