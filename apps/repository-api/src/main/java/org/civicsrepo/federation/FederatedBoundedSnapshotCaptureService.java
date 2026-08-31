package org.civicsrepo.federation;

import org.springframework.stereotype.Service;

/** Generates and persists operator-requested bounded corpus evidence. */
@Service
public class FederatedBoundedSnapshotCaptureService {
    private final FederatedCorpusManifestService manifestService;
    private final FederatedBoundedSnapshotManifestStore manifestStore;

    public FederatedBoundedSnapshotCaptureService(
            FederatedCorpusManifestService manifestService,
            FederatedBoundedSnapshotManifestStore manifestStore) {
        this.manifestService = manifestService;
        this.manifestStore = manifestStore;
    }

    public FederatedBoundedSnapshotManifest capture(String runId) {
        FederatedBoundedSnapshotManifest manifest = manifestService.generateBoundedSnapshot(runId);
        manifestStore.save(manifest);
        return manifest;
    }

    /** Persist exactly the deterministic stable-ID prefix requested by a named scale profile. */
    public FederatedBoundedSnapshotManifest capture(String runId, long recordLimit) {
        FederatedBoundedSnapshotManifest manifest = manifestService.generateBoundedSnapshot(runId, recordLimit);
        if (manifest.retainedRecordCount() != recordLimit) {
            throw new IllegalStateException(
                    "Bounded snapshot requires " + recordLimit + " retained records; only "
                            + manifest.retainedRecordCount() + " are available.");
        }
        manifestStore.save(manifest);
        return manifest;
    }
}
