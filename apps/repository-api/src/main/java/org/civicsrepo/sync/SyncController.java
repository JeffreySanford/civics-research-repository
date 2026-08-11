package org.civicsrepo.sync;

import jakarta.validation.Valid;
import java.util.NoSuchElementException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

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

    @GetMapping("/{syncJobId}")
    public SyncJob getSyncJob(@PathVariable String syncJobId) {
        return syncService
                .findJob(syncJobId)
                .orElseThrow(() -> new NoSuchElementException("Sync job not found: " + syncJobId));
    }
}
