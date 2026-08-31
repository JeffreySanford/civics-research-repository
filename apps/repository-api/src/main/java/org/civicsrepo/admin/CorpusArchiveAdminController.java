package org.civicsrepo.admin;

import java.util.List;
import org.civicsrepo.admin.CorpusArchiveService.ArchiveNotFoundException;
import org.civicsrepo.admin.CorpusArchiveService.CorpusArchiveRestoreResult;
import org.civicsrepo.admin.CorpusArchiveService.CorpusArchiveSummary;
import org.civicsrepo.federation.CorpusProfile;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Operator-controlled lifecycle endpoints for durable local federated corpus archives. */
@RestController
@RequestMapping("/admin/corpus/archives")
public class CorpusArchiveAdminController {
    private final CorpusArchiveService archiveService;

    public CorpusArchiveAdminController(CorpusArchiveService archiveService) {
        this.archiveService = archiveService;
    }

    @GetMapping
    public List<CorpusArchiveSummary> list() {
        return execute(archiveService::list);
    }

    @PostMapping
    public CorpusArchiveSummary create(@RequestBody CorpusArchiveCreateRequest request) {
        if (request == null || request.profile() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Archive profile is required.");
        }
        return execute(() -> archiveService.create(request.profile(), request.label()));
    }

    @PostMapping("/{archiveId}/verify")
    public CorpusArchiveSummary verify(@PathVariable String archiveId) {
        return execute(() -> archiveService.verify(archiveId));
    }

    @PostMapping("/{archiveId}/freshness")
    public CorpusArchiveSummary freshness(@PathVariable String archiveId) {
        return execute(() -> archiveService.checkFreshness(archiveId));
    }

    @PostMapping("/{archiveId}/restore")
    public CorpusArchiveRestoreResult restore(
            @PathVariable String archiveId, @RequestBody CorpusArchiveRestoreRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Restore request is required.");
        }
        return execute(() -> archiveService.restore(
                archiveId, request.replaceExisting(), request.activateProfileAfterRestore()));
    }

    @DeleteMapping("/{archiveId}")
    public void delete(@PathVariable String archiveId) {
        execute(() -> {
            archiveService.delete(archiveId);
            return null;
        });
    }

    private <T> T execute(Operation<T> operation) {
        try {
            return operation.run();
        } catch (ArchiveNotFoundException exception) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, exception.getMessage(), exception);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, exception.getMessage(), exception);
        } catch (IllegalStateException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, exception.getMessage(), exception);
        }
    }

    @FunctionalInterface
    private interface Operation<T> {
        T run();
    }

    public record CorpusArchiveCreateRequest(CorpusProfile profile, String label) {}

    public record CorpusArchiveRestoreRequest(boolean replaceExisting, CorpusProfile activateProfileAfterRestore) {}
}
