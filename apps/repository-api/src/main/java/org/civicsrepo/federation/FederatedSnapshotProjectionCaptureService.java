package org.civicsrepo.federation;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Objects;
import org.civicsrepo.admin.CorpusProfileActivationService;
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
    private final CorpusProfileActivationService activationService;

    public FederatedSnapshotProjectionCaptureService(
            FederatedBoundedSnapshotCaptureService snapshotCaptureService,
            FederatedCorpusManifestService manifestService,
            DiscoveryProjectionService projectionService,
            SearchService searchService,
            FederatedSnapshotProjectionEvidenceStore evidenceStore,
            CorpusProfileActivationService activationService) {
        this.snapshotCaptureService = snapshotCaptureService;
        this.manifestService = manifestService;
        this.projectionService = projectionService;
        this.searchService = searchService;
        this.evidenceStore = evidenceStore;
        this.activationService = activationService;
    }

    /**
     * Capture the current bounded checkpoint, infer its exact named profile when one exists, rebuild
     * discovery, and persist the relationship.
     */
    public FederatedSnapshotProjectionEvidence captureAndProject(String runId) {
        FederatedBoundedSnapshotManifest before = snapshotCaptureService.capture(runId);
        CorpusProfile profile = profileFor(before.retainedRecordCount());
        return projectStableCheckpoint(runId, profile, before);
    }

    /**
     * Capture exactly the deterministic prefix represented by a named profile, then rebuild and
     * link that same profile projection.
     *
     * <p>This decouples evidence tiers from publisher page boundaries: a 100K profile remains an
     * exact 100,000-record snapshot/projection even when the retained source contains slightly more
     * than 100,000 records.
     */
    public FederatedSnapshotProjectionEvidence captureAndProject(String runId, CorpusProfile profile) {
        Objects.requireNonNull(profile, "profile");
        if (profile == CorpusProfile.CURATED_DEMO) {
            throw new IllegalArgumentException("CURATED_DEMO does not use a federated snapshot.");
        }
        FederatedBoundedSnapshotManifest before = captureForProfile(runId, profile);
        return projectStableCheckpoint(runId, profile, before);
    }

    private FederatedSnapshotProjectionEvidence projectStableCheckpoint(
            String runId, CorpusProfile profile, FederatedBoundedSnapshotManifest before) {
        ProjectionState projected = projectionService.reindex(profile, searchService.fixtureDocuments());
        String projectionId = projectionService.currentProjectionId();
        if (projectionId == null || projectionId.isBlank()) {
            throw new IllegalStateException("Discovery projection completed without a projectionId");
        }
        if (projected.rebuiltAt() == null) {
            throw new IllegalStateException("Discovery projection completed without rebuiltAt evidence");
        }

        FederatedBoundedSnapshotManifest after = regenerateForProfile(runId, profile);
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
        activationService.recordSuccessfulProjection(profile, projected);
        return evidence;
    }

    private FederatedBoundedSnapshotManifest captureForProfile(String runId, CorpusProfile profile) {
        if (profile.targetRecordCount().isPresent()) {
            return snapshotCaptureService.capture(runId, profile.targetRecordCount().getAsLong());
        }
        return snapshotCaptureService.capture(runId);
    }

    private FederatedBoundedSnapshotManifest regenerateForProfile(String runId, CorpusProfile profile) {
        if (profile.targetRecordCount().isPresent()) {
            return manifestService.generateBoundedSnapshot(runId, profile.targetRecordCount().getAsLong());
        }
        return manifestService.generateBoundedSnapshot(runId);
    }

    private CorpusProfile profileFor(long retainedRecordCount) {
        for (CorpusProfile profile : CorpusProfile.values()) {
            if (profile.targetRecordCount().isPresent()
                    && profile.targetRecordCount().getAsLong() == retainedRecordCount) {
                return profile;
            }
        }
        return CorpusProfile.FULL;
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
