package org.civicsrepo.admin;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.civicsrepo.admin.CorpusProfileActivationProgress.Phase;
import org.civicsrepo.federation.CorpusProfile;
import org.springframework.stereotype.Component;

/** Thread-safe in-memory progress for the single operator profile activation allowed at a time. */
@Component
public class CorpusProfileActivationProgressTracker {
    private final AtomicReference<State> state = new AtomicReference<>(State.idle());

    public String begin(CorpusProfile profile) {
        Objects.requireNonNull(profile, "profile");
        while (true) {
            State current = state.get();
            if (current.phase.active()) {
                throw new IllegalStateException(
                        "Corpus profile activation is already in progress for " + current.profile + ".");
            }
            OffsetDateTime now = now();
            State next = new State(
                    UUID.randomUUID().toString(),
                    profile,
                    Phase.PREPARING,
                    0,
                    null,
                    now,
                    now,
                    null,
                    "Preparing deterministic corpus projection.");
            if (state.compareAndSet(current, next)) {
                return next.operationId;
            }
        }
    }

    public void harvesting(long processedRecords, long totalRecords) {
        long safeTotal = Math.max(0, totalRecords);
        long safeProcessed = Math.max(0, Math.min(processedRecords, safeTotal));
        updateActive(
                Phase.HARVESTING,
                safeProcessed,
                safeTotal,
                "Harvesting and retaining federated metadata from the authoritative source.",
                false);
    }

    public void snapshotting(long targetRecords) {
        long safeTarget = Math.max(0, targetRecords);
        updateActive(
                Phase.SNAPSHOTTING,
                safeTarget,
                safeTarget,
                "Capturing the deterministic bounded corpus snapshot.",
                false);
    }

    public void projectionStarted(long totalDocuments) {
        updateActive(
                Phase.PROJECTING,
                0,
                Math.max(0, totalDocuments),
                "Building Solr and OpenSearch projections.",
                false);
    }

    public void projected(long processedDocuments, long totalDocuments) {
        long safeTotal = Math.max(0, totalDocuments);
        long safeProcessed = Math.max(0, Math.min(processedDocuments, safeTotal));
        updateActive(
                Phase.PROJECTING,
                safeProcessed,
                safeTotal,
                "Building Solr and OpenSearch projections.",
                false);
    }

    public void verifying(long processedDocuments, long totalDocuments) {
        long safeTotal = Math.max(0, totalDocuments);
        long safeProcessed = Math.max(0, Math.min(processedDocuments, safeTotal));
        updateActive(
                Phase.VERIFYING,
                safeProcessed,
                safeTotal,
                "Committing indexes and verifying projection identity and document-count parity.",
                false);
    }

    public void capturingEvidence(long processedDocuments, long totalDocuments) {
        long safeTotal = Math.max(0, totalDocuments);
        long safeProcessed = Math.max(0, Math.min(processedDocuments, safeTotal));
        updateActive(
                Phase.CAPTURING_EVIDENCE,
                safeProcessed,
                safeTotal,
                "Capturing the immutable local storage footprint for this profile.",
                false);
    }

    public void complete(long processedDocuments, long totalDocuments) {
        complete(processedDocuments, totalDocuments, "Corpus profile activation completed.");
    }

    public void complete(long processedDocuments, long totalDocuments, String message) {
        long safeTotal = Math.max(0, totalDocuments);
        long safeProcessed = Math.max(0, Math.min(processedDocuments, safeTotal));
        String safeMessage = message == null || message.isBlank()
                ? "Corpus profile activation completed."
                : message;
        updateActive(Phase.COMPLETED, safeProcessed, safeTotal, safeMessage, true);
    }

    public void fail(Throwable failure) {
        String message = failure == null || failure.getMessage() == null || failure.getMessage().isBlank()
                ? "Corpus profile activation failed."
                : failure.getMessage();
        while (true) {
            State current = state.get();
            if (!current.phase.active()) {
                return;
            }
            OffsetDateTime now = now();
            State next = new State(
                    current.operationId,
                    current.profile,
                    Phase.FAILED,
                    current.processedDocuments,
                    current.totalDocuments,
                    current.startedAt,
                    now,
                    now,
                    message);
            if (state.compareAndSet(current, next)) {
                return;
            }
        }
    }

    public CorpusProfileActivationProgress current() {
        State current = state.get();
        OffsetDateTime observedAt = current.completedAt == null ? now() : current.completedAt;
        long elapsedMs = current.startedAt == null
                ? 0
                : Math.max(0, Duration.between(current.startedAt, observedAt).toMillis());
        Double rate = elapsedMs > 0 && current.processedDocuments > 0
                ? (current.processedDocuments * 1000.0) / elapsedMs
                : null;
        return new CorpusProfileActivationProgress(
                current.operationId,
                current.profile,
                current.phase,
                current.processedDocuments,
                current.totalDocuments,
                percent(current.processedDocuments, current.totalDocuments, current.phase),
                current.startedAt,
                current.updatedAt,
                current.completedAt,
                elapsedMs,
                rate,
                current.message);
    }

    private void updateActive(
            Phase phase,
            long processedDocuments,
            Long totalDocuments,
            String message,
            boolean completed) {
        while (true) {
            State current = state.get();
            if (!current.phase.active()) {
                return;
            }
            OffsetDateTime now = now();
            State next = new State(
                    current.operationId,
                    current.profile,
                    phase,
                    processedDocuments,
                    totalDocuments,
                    current.startedAt,
                    now,
                    completed ? now : null,
                    message);
            if (state.compareAndSet(current, next)) {
                return;
            }
        }
    }

    private static int percent(long processedDocuments, Long totalDocuments, Phase phase) {
        if (phase == Phase.COMPLETED) {
            return 100;
        }
        if (totalDocuments == null || totalDocuments <= 0) {
            return 0;
        }
        return (int) Math.min(100, Math.floor((processedDocuments * 100.0) / totalDocuments));
    }

    private static OffsetDateTime now() {
        return OffsetDateTime.now(ZoneOffset.UTC);
    }

    private record State(
            String operationId,
            CorpusProfile profile,
            Phase phase,
            long processedDocuments,
            Long totalDocuments,
            OffsetDateTime startedAt,
            OffsetDateTime updatedAt,
            OffsetDateTime completedAt,
            String message) {
        private static State idle() {
            return new State(null, null, Phase.IDLE, 0, null, null, now(), null, "No corpus activation is running.");
        }
    }
}
