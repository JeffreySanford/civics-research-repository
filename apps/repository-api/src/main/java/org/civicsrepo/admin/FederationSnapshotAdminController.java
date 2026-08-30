package org.civicsrepo.admin;

import java.util.List;
import org.civicsrepo.federation.FederatedBoundedSnapshotCaptureService;
import org.civicsrepo.federation.FederatedBoundedSnapshotManifest;
import org.civicsrepo.federation.FederatedBoundedSnapshotManifestStore;
import org.civicsrepo.federation.FederatedSourceSystem;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Operator endpoints for durable bounded federation checkpoint evidence. */
@RestController
@RequestMapping("/admin/federation/snapshots")
public class FederationSnapshotAdminController {
    private static final int MAX_HISTORY = 1_000;

    private final FederatedBoundedSnapshotCaptureService captureService;
    private final FederatedBoundedSnapshotManifestStore manifestStore;

    public FederationSnapshotAdminController(
            FederatedBoundedSnapshotCaptureService captureService,
            FederatedBoundedSnapshotManifestStore manifestStore) {
        this.captureService = captureService;
        this.manifestStore = manifestStore;
    }

    /** Persist the current retained source state for a PAUSED or COMPLETED harvest run. */
    @PostMapping("/runs/{runId}")
    public FederatedBoundedSnapshotManifest capture(@PathVariable String runId) {
        try {
            return captureService.capture(runId);
        } catch (IllegalArgumentException | IllegalStateException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, exception.getMessage(), exception);
        }
    }

    /** Read the newest bounded checkpoints for one source. */
    @GetMapping
    public List<FederatedBoundedSnapshotManifest> recent(
            @RequestParam FederatedSourceSystem sourceSystem,
            @RequestParam(defaultValue = "20") int limit) {
        if (limit < 1 || limit > MAX_HISTORY) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "limit must be between 1 and " + MAX_HISTORY + ".");
        }
        return manifestStore.findRecent(sourceSystem, limit);
    }
}
