package org.civicsrepo.federation;

import java.time.OffsetDateTime;
import java.util.Objects;

/** Durable evidence for one resumable federated source harvest. */
public record HarvestRun(
        String id,
        FederatedSourceSystem sourceSystem,
        String adapterVersion,
        HarvestRunStatus status,
        int pageSize,
        int pageCount,
        long acceptedCount,
        long rejectedCount,
        long skippedCount,
        String cursor,
        OffsetDateTime startedAt,
        OffsetDateTime updatedAt,
        OffsetDateTime completedAt,
        String failureMessage) {

    public HarvestRun {
        id = requireText(id, "id");
        Objects.requireNonNull(sourceSystem, "sourceSystem");
        adapterVersion = requireText(adapterVersion, "adapterVersion");
        Objects.requireNonNull(status, "status");
        if (pageSize < 1 || pageSize > 10_000) {
            throw new IllegalArgumentException("pageSize must be between 1 and 10000");
        }
        if (pageCount < 0 || acceptedCount < 0 || rejectedCount < 0 || skippedCount < 0) {
            throw new IllegalArgumentException("Harvest run counters must not be negative");
        }
        Objects.requireNonNull(startedAt, "startedAt");
        Objects.requireNonNull(updatedAt, "updatedAt");
        failureMessage = normalizeOptional(failureMessage);
        cursor = normalizeOptional(cursor);
        if (isTerminal(status) && completedAt == null) {
            throw new IllegalArgumentException("Terminal harvest runs require completedAt");
        }
        if (!isTerminal(status) && completedAt != null) {
            throw new IllegalArgumentException("Non-terminal harvest runs must not set completedAt");
        }
        if (status != HarvestRunStatus.FAILED && failureMessage != null) {
            throw new IllegalArgumentException("Only failed harvest runs may carry failureMessage");
        }
    }

    public boolean resumable() {
        return status == HarvestRunStatus.RUNNING || status == HarvestRunStatus.PAUSED;
    }

    public static boolean isTerminal(HarvestRunStatus status) {
        return status == HarvestRunStatus.COMPLETED
                || status == HarvestRunStatus.FAILED
                || status == HarvestRunStatus.CANCELLED;
    }

    private static String requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        return value.trim();
    }

    private static String normalizeOptional(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
