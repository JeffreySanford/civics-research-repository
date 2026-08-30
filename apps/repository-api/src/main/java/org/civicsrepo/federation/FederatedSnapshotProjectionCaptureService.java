package org.civicsrepo.federation;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Objects;
import org.civicsrepo.repository.DiscoveryProjectionService;
import org.civicsrepo.repository.DiscoveryProjectionService.ProjectionState;
import org.civicsrepo.search.SearchService;
import org.springframework.stereotype.Service;

/** Rebuilds discovery and records a projection link only when the bounded checkpoint stayed stable. */
@Service
public class FederatedSnapshotProjectionCaptureService {
    private final FederatedBoundedSnapshotCaptureService snapshotCaptureService;
    private final FederatedCorpusManifestService manifestService;
    private final DiscoveryProjectionService projectionService;
    private final SearchService searchService;
    private final FederatedSnapshotProjectionEvidenceStore evidenceStore;

    public FederatedSnapshotProjectionCaptureService(
            FederatedBoundedSnapshotCaptureService snapshotCaptureService,
            FederatedCorpusManifestService manifestService,
            DiscoveryProjectionService projectionService,
            SearchService searchService,
            FederatedSnapshotProjectionEvidenceStore evidenceStore) {
        this.snapshotCaptureService = snapshotCaptureService;
        this.manifestService = manifestService;
        this.projectionService = projectionService;
        this.searchService = searchService;
        this.evidenceStore = evidenceStore;
    }

    /**
     * Capture a bounded checkpoint, rebuild the combined projection, and persist the relationship.
     *
     * <p>The source checkpoint is scanned again after reindex. If its content identity, counters,
     * cursor, status or run update time changed while projection was running, no relationship is
     * recorded. The pre-projection snapshot remains valid point-in-time evidence on its own.
     */
    public FederatedSnapshotProjectionEvidence captureAndProject(String runId) {
        FederatedBoundedSnapshotManifest before = snapshotCaptureService.capture(runId);
        ProjectionState projected = projectionService.reindex(searchService.fixtureDocuments());
        String projectionId = projectionService.currentProjectionId();
        if (projectionId == null || projectionId.isBlank()) {
            throw new IllegalStateException("Discovery projection completed without a projectionId");
        }
        if (projected.rebuiltAt() == null) {
            throw new IllegalStateException("Discovery projection completed without rebuiltAt evidence");
        }

        FederatedBoundedSnapshotManifest after = manifestService.generateBoundedSnapshot(runId);
        if (!sameCheckpoint(before, after)) {
            throw new IllegalStateException(
                    "Federated checkpoint changed during discovery projection; projection evidence was not linked");
        }

        FederatedSnapshotProjectionEvidence evidence = new FederatedSnapshotProjectionEvidence(
                before.snapshotId(),
                before.runId(),
                before.sourceSystem(),
                before.sha256(),
                before.retainedRecordCount(),
                projectionId,
                projected.source(),
                projected.objectCount(),
                projected.rebuiltAt(),
                OffsetDateTime.now(ZoneOffset.UTC));
        evidenceStore.save(evidence);
        return evidence;
    }

    private boolean sameCheckpoint(
            FederatedBoundedSnapshotManifest before, FederatedBoundedSnapshotManifest after) {
        return before.snapshotId().equals(after.snapshotId())
                && before.runId().equals(after.runId())
                && before.runStatus() == after.runStatus()
                && before.retainedRecordCount() == after.retainedRecordCount()
                && before.acceptedCount() == after.acceptedCount()
                && before.rejectedCount() == after.rejectedCount()
                && before.skippedCount() == after.skippedCount()
                && before.pageCount() == after.pageCount()
                && Objects.equals(before.cursor(), after.cursor())
                && before.runUpdatedAt().isEqual(after.runUpdatedAt());
    }
}
