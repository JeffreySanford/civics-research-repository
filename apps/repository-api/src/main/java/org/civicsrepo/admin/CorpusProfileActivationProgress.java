package org.civicsrepo.admin;

import java.time.OffsetDateTime;
import org.civicsrepo.federation.CorpusProfile;

/** Live operator-facing state for one corpus-profile activation. */
public record CorpusProfileActivationProgress(
        String operationId,
        CorpusProfile profile,
        Phase phase,
        long processedDocuments,
        Long totalDocuments,
        int percentComplete,
        OffsetDateTime startedAt,
        OffsetDateTime updatedAt,
        OffsetDateTime completedAt,
        long elapsedMs,
        Double documentsPerSecond,
        String message) {

    public enum Phase {
        IDLE,
        PREPARING,
        PROJECTING,
        VERIFYING,
        COMPLETED,
        FAILED;

        public boolean active() {
            return this == PREPARING || this == PROJECTING || this == VERIFYING;
        }
    }
}
