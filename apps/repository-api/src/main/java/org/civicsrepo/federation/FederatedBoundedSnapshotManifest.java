package org.civicsrepo.federation;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Objects;

/**
 * Reproducible evidence for an intentionally bounded federated corpus checkpoint.
 *
 * <p>Unlike {@link FederatedCorpusManifest}, this model does not claim the publisher source was
 * exhausted. It is intended for controlled 1K/10K/100K evidence where a resumable run may remain
 * {@link HarvestRunStatus#PAUSED}.
 */
public record FederatedBoundedSnapshotManifest(
        String manifestVersion,
        String mode,
        String snapshotId,
        String runId,
        FederatedSourceSystem sourceSystem,
        String runAdapterVersion,
        List<String> recordAdapterVersions,
        HarvestRunStatus runStatus,
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
        String cursor,
        OffsetDateTime runStartedAt,
        OffsetDateTime runUpdatedAt,
        OffsetDateTime capturedAt) {

    public static final String MODE = "BOUNDED_SNAPSHOT";

    public FederatedBoundedSnapshotManifest {
        manifestVersion = requireText(manifestVersion, "manifestVersion");
        mode = requireText(mode, "mode");
        if (!MODE.equals(mode)) {
            throw new IllegalArgumentException("mode must be " + MODE);
        }
        snapshotId = requireText(snapshotId, "snapshotId");
        runId = requireText(runId, "runId");
        Objects.requireNonNull(sourceSystem, "sourceSystem");
        runAdapterVersion = requireText(runAdapterVersion, "runAdapterVersion");
        recordAdapterVersions = recordAdapterVersions == null ? List.of() : List.copyOf(recordAdapterVersions);
        Objects.requireNonNull(runStatus, "runStatus");
        if (runStatus != HarvestRunStatus.PAUSED && runStatus != HarvestRunStatus.COMPLETED) {
            throw new IllegalArgumentException("Bounded snapshots require a PAUSED or COMPLETED harvest run");
        }
        if (retainedRecordCount < 0 || acceptedCount < 0 || rejectedCount < 0 || skippedCount < 0) {
            throw new IllegalArgumentException("Snapshot counters must not be negative");
        }
        firstRecordId = normalizeOptional(firstRecordId);
        lastRecordId = normalizeOptional(lastRecordId);
        sha256 = requireText(sha256, "sha256");
        if (!sha256.matches("[0-9a-f]{64}")) {
            throw new IllegalArgumentException("sha256 must be a lowercase SHA-256 hex digest");
        }
        if (pageSize < 1 || pageCount < 0) {
            throw new IllegalArgumentException("Snapshot run paging values are invalid");
        }
        cursor = normalizeOptional(cursor);
        Objects.requireNonNull(runStartedAt, "runStartedAt");
        Objects.requireNonNull(runUpdatedAt, "runUpdatedAt");
        Objects.requireNonNull(capturedAt, "capturedAt");
        if ((firstRecordId == null) != (lastRecordId == null)) {
            throw new IllegalArgumentException("Snapshot first/last record IDs must both be present or absent");
        }
        if (retainedRecordCount == 0 && firstRecordId != null) {
            throw new IllegalArgumentException("An empty snapshot cannot carry record IDs");
        }
        if (retainedRecordCount > 0 && firstRecordId == null) {
            throw new IllegalArgumentException("A non-empty snapshot requires first/last record IDs");
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
