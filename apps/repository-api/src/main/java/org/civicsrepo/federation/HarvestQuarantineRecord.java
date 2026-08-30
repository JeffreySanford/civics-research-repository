package org.civicsrepo.federation;

import java.time.OffsetDateTime;
import java.util.Objects;

/** Persisted evidence for one record-level normalization rejection. */
public record HarvestQuarantineRecord(
        String id,
        String runId,
        FederatedSourceSystem sourceSystem,
        String sourceIdentifier,
        String message,
        String rawSnippet,
        OffsetDateTime observedAt) {

    public HarvestQuarantineRecord {
        id = requireText(id, "id");
        runId = requireText(runId, "runId");
        Objects.requireNonNull(sourceSystem, "sourceSystem");
        sourceIdentifier = normalize(sourceIdentifier);
        message = requireText(message, "message");
        rawSnippet = normalize(rawSnippet);
        Objects.requireNonNull(observedAt, "observedAt");
    }

    private static String requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        return value.trim();
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
