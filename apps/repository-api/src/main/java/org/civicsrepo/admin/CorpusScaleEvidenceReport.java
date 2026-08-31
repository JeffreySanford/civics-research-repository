package org.civicsrepo.admin;

import java.time.OffsetDateTime;
import java.util.List;
import org.civicsrepo.federation.CorpusProfile;

/** Read-only evidence chain for a named corpus profile; this report never mutates runtime state. */
public record CorpusScaleEvidenceReport(
        CorpusProfile profile,
        boolean valid,
        Long targetFederatedRecordCount,
        long retainedFederatedRecordCount,
        CorpusProfile activeProfile,
        Long activationProjectionObjectCount,
        String activationProjectionId,
        int currentProjectionObjectCount,
        String currentProjectionId,
        boolean targetParity,
        boolean storageEvidencePresent,
        Long storageProjectionObjectCount,
        Long storageRetainedFederatedCount,
        String storageProjectionId,
        OffsetDateTime storageCapturedAt,
        List<String> violations) {
    public CorpusScaleEvidenceReport {
        violations = List.copyOf(violations);
    }
}
