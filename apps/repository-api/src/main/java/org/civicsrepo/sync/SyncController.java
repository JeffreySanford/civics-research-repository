package org.civicsrepo.sync;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Admin sync endpoints.
 *
 * <p><strong>Unauthenticated by deliberate choice for the local demo.</strong> {@code POST} with
 * {@code mode: APPLY} performs real DSpace writes, and the CORS policy in
 * {@link org.civicsrepo.config.WebConfig} restricts browser origins only — it is not an access
 * control for direct clients such as {@code curl}. This is acceptable because the stack binds to
 * localhost and holds only public federal data. Adding authentication is a prerequisite for any
 * shared or deployed environment; see planning/DECISIONS.md ("Admin API Authentication").
 */
@RestController
@RequestMapping("/admin/sync")
public class SyncController {
    private final SyncService syncService;

    public SyncController(SyncService syncService) {
        this.syncService = syncService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.ACCEPTED)
    public SyncJob startSync(@Valid @RequestBody SyncRequest request) {
        return syncService.runSync(request);
    }

    @GetMapping
    public List<SyncJob> listSyncJobs() {
        return syncService.findRecentJobs();
    }

    @GetMapping("/{syncJobId}")
    public SyncJob getSyncJob(@PathVariable String syncJobId) {
        return syncService
                .findJob(syncJobId)
                .orElseThrow(() ->
                        new ResponseStatusException(HttpStatus.NOT_FOUND, "Sync job not found: " + syncJobId));
    }
}
