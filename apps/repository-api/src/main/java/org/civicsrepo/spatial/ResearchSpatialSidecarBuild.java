package org.civicsrepo.spatial;

import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Objects;
import org.civicsrepo.federation.FederatedSourceSystem;

/** Versioned build metadata for one source's independently rebuildable spatial sidecar. */
public record ResearchSpatialSidecarBuild(
        String buildId,
        FederatedSourceSystem sourceSystem,
        int schemaVersion,
        OffsetDateTime sourceSnapshotAt,
        OffsetDateTime capturedAt,
        String compositionSha256,
        String projectionId,
        Status status,
        long rowCount,
        String failureMessage,
        OffsetDateTime completedAt) {

    public enum Status {
        RUNNING,
        COMPLETE,
        FAILED
    }

    public ResearchSpatialSidecarBuild {
        buildId = requireText(buildId, "buildId");
        Objects.requireNonNull(sourceSystem, "sourceSystem");
        if (schemaVersion < 1) {
            throw new IllegalArgumentException("schemaVersion must be positive");
        }
        sourceSnapshotAt = databaseTimestamp(sourceSnapshotAt, "sourceSnapshotAt");
        capturedAt = databaseTimestamp(capturedAt, "capturedAt");
        compositionSha256 = requireSha(compositionSha256, "compositionSha256");
        projectionId = requireSha(projectionId, "projectionId");
        Objects.requireNonNull(status, "status");
        if (rowCount < 0) {
            throw new IllegalArgumentException("rowCount must not be negative");
        }
        if (completedAt != null) {
            completedAt = databaseTimestamp(completedAt, "completedAt");
        }
        if (status == Status.COMPLETE && completedAt == null) {
            throw new IllegalArgumentException("completedAt is required for a complete build");
        }
        if (status == Status.FAILED && (failureMessage == null || failureMessage.isBlank())) {
            throw new IllegalArgumentException("failureMessage is required for a failed build");
        }
    }

    private static OffsetDateTime databaseTimestamp(OffsetDateTime value, String field) {
        return Objects.requireNonNull(value, field).truncatedTo(ChronoUnit.MICROS);
    }

    private static String requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        return value.trim();
    }

    private static String requireSha(String value, String field) {
        if (value == null || !value.matches("[0-9a-f]{64}")) {
            throw new IllegalArgumentException(field + " must be a lowercase SHA-256 hex digest");
        }
        return value;
    }
}
