package org.civicsrepo.federation;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Objects;

/** Immutable provenance for one bounded source slice inside a composite federated corpus. */
public record FederatedCompositeCorpusSource(
        FederatedSourceSystem sourceSystem,
        long requestedRecordCount,
        String snapshotId,
        String runId,
        String runAdapterVersion,
        List<String> recordAdapterVersions,
        long retainedRecordCount,
        String sha256,
        OffsetDateTime snapshotCapturedAt) {

    public FederatedCompositeCorpusSource {
        Objects.requireNonNull(sourceSystem, "sourceSystem");
        if (requestedRecordCount < 1) {
            throw new IllegalArgumentException("requestedRecordCount must be at least 1");
        }
        snapshotId = requireText(snapshotId, "snapshotId");
        runId = requireText(runId, "runId");
        runAdapterVersion = requireText(runAdapterVersion, "runAdapterVersion");
        recordAdapterVersions = recordAdapterVersions == null
                ? List.of()
                : recordAdapterVersions.stream().map(String::trim).sorted().toList();
        if (retainedRecordCount != requestedRecordCount) {
            throw new IllegalArgumentException("retainedRecordCount must equal requestedRecordCount");
        }
        sha256 = requireSha256(sha256, "sha256");
        if (!snapshotId.equals(sourceSystem.name() + ":" + sha256)) {
            throw new IllegalArgumentException("snapshotId must match sourceSystem and sha256");
        }
        Objects.requireNonNull(snapshotCapturedAt, "snapshotCapturedAt");
    }

    private static String requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        return value.trim();
    }

    private static String requireSha256(String value, String field) {
        String normalized = requireText(value, field);
        if (!normalized.matches("[0-9a-f]{64}")) {
            throw new IllegalArgumentException(field + " must be a lowercase SHA-256 hex digest");
        }
        return normalized;
    }
}
