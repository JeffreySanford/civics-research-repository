package org.civicsrepo.federation;

import java.time.OffsetDateTime;
import java.util.Objects;

/** Immutable measured storage footprint for one corpus/profile/topology point in time. */
public record CorpusStorageMeasurement(
        String id,
        CorpusProfile profile,
        DeploymentTopology topology,
        long activeProjectionCount,
        long retainedFederatedCount,
        String projectionId,
        Long applicationPostgresBytes,
        Long dspaceStoredBytes,
        Long solrIndexBytes,
        Long openSearchIndexBytes,
        OffsetDateTime capturedAt) {

    public CorpusStorageMeasurement {
        id = requireText(id, "id");
        Objects.requireNonNull(profile, "profile");
        Objects.requireNonNull(topology, "topology");
        Objects.requireNonNull(capturedAt, "capturedAt");
        if (activeProjectionCount < 0 || retainedFederatedCount < 0) {
            throw new IllegalArgumentException("record counts must be non-negative");
        }
        requireNonNegative(applicationPostgresBytes, "applicationPostgresBytes");
        requireNonNegative(dspaceStoredBytes, "dspaceStoredBytes");
        requireNonNegative(solrIndexBytes, "solrIndexBytes");
        requireNonNegative(openSearchIndexBytes, "openSearchIndexBytes");
        if (projectionId != null && !projectionId.matches("^[0-9a-f]{64}$")) {
            throw new IllegalArgumentException("projectionId must be a lowercase SHA-256 value");
        }
    }

    public long totalMeasuredLocalBytes() {
        return value(applicationPostgresBytes)
                + value(dspaceStoredBytes)
                + value(solrIndexBytes)
                + value(openSearchIndexBytes);
    }

    private static long value(Long bytes) {
        return bytes == null ? 0 : bytes;
    }

    private static void requireNonNegative(Long value, String field) {
        if (value != null && value < 0) {
            throw new IllegalArgumentException(field + " must be non-negative");
        }
    }

    private static String requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        return value;
    }
}
