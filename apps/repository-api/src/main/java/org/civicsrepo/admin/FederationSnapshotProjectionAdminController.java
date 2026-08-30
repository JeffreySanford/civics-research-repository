package org.civicsrepo.admin;

import java.util.List;
import org.civicsrepo.federation.FederatedSnapshotProjectionCaptureService;
import org.civicsrepo.federation.FederatedSnapshotProjectionEvidence;
import org.civicsrepo.federation.FederatedSnapshotProjectionEvidenceStore;
import org.civicsrepo.federation.FederatedSourceSystem;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Operator endpoints for defensible bounded-snapshot to search-projection linkage. */
@RestController
@RequestMapping("/admin/federation/snapshots")
public class FederationSnapshotProjectionAdminController {
    private static final int MAX_HISTORY = 1_000;

    private final FederatedSnapshotProjectionCaptureService captureService;
    private final FederatedSnapshotProjectionEvidenceStore evidenceStore;

    public FederationSnapshotProjectionAdminController(
            FederatedSnapshotProjectionCaptureService captureService,
            FederatedSnapshotProjectionEvidenceStore evidenceStore) {
        this.captureService = captureService;
        this.evidenceStore = evidenceStore;
    }

    /** Capture the run checkpoint, rebuild combined discovery, and link only if the checkpoint stays stable. */
    @PostMapping("/runs/{runId}/project")
    public FederatedSnapshotProjectionEvidence captureAndProject(@PathVariable String runId) {
        try {
            return captureService.captureAndProject(runId);
        } catch (IllegalArgumentException | IllegalStateException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, exception.getMessage(), exception);
        }
    }

    /** Read newest source snapshot-to-projection relationships. */
    @GetMapping("/projections")
    public List<FederatedSnapshotProjectionEvidence> recent(
            @RequestParam FederatedSourceSystem sourceSystem,
            @RequestParam(defaultValue = "20") int limit) {
        if (limit < 1 || limit > MAX_HISTORY) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "limit must be between 1 and " + MAX_HISTORY + ".");
        }
        return evidenceStore.findRecent(sourceSystem, limit);
    }
}
