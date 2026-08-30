package org.civicsrepo.federation;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Objects;

/** Reproducible identity and run evidence for one retained federated source snapshot. */
public record FederatedCorpusManifest(
        String manifestVersion,
        String runId,
        FederatedSourceSystem sourceSystem,
        String runAdapterVersion,
        List<String> recordAdapterVersions,
        long retainedRecordCount,
        long acceptedCount,
        long rejectedCount,
        long skippedCount,
        String firstRecordId,
        String lastRecordId,
        String sha256,
        OffsetDateTime earliestSourceUpdatedAt,
        OffsetDateTime latestSourceUpdatedAt,
        int pageSize,
        int pageCount,
        String completionCursor,
        OffsetDateTime runStartedAt,
        OffsetDateTime runCompletedAt) {

    public FederatedCorpusManifest {
        manifestVersion = requireText(manifestVersion, "manifestVersion");
        runId = requireText(runId, "runId");
        Objects.requireNonNull(sourceSystem, "sourceSystem");
        runAdapterVersion = requireText(runAdapterVersion, "runAdapterVersion");
        recordAdapterVersions = recordAdapterVersions == null ? List.of() : List.copyOf(recordAdapterVersions);
        if (retainedRecordCount < 0 || acceptedCount < 0 || rejectedCount < 0 || skippedCount < 0) {
            throw new IllegalArgumentException("Manifest counters must not be negative");
        }
        firstRecordId = normalizeOptional(firstRecordId);
        lastRecordId = normalizeOptional(lastRecordId);
        sha256 = requireText(sha256, "sha256");
        if (!sha256.matches("[0-9a-f]{64}")) {
            throw new IllegalArgumentException("sha256 must be a lowercase SHA-256 hex digest");
        }
        if (pageSize < 1 || pageCount < 0) {
            throw new IllegalArgumentException("Manifest run paging values are invalid");
        }
        completionCursor = normalizeOptional(completionCursor);
        Objects.requireNonNull(runStartedAt, "runStartedAt");
        Objects.requireNonNull(runCompletedAt, "runCompletedAt");
        if ((firstRecordId == null) != (lastRecordId == null)) {
            throw new IllegalArgumentException("Manifest first/last record IDs must both be present or absent");
        }
        if (retainedRecordCount == 0 && firstRecordId != null) {
            throw new IllegalArgumentException("An empty manifest cannot carry record IDs");
        }
        if (retainedRecordCount > 0 && firstRecordId == null) {
            throw new IllegalArgumentException("A non-empty manifest requires first/last record IDs");
        }
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
