package org.civicsrepo.admin;

import java.util.List;
import org.civicsrepo.federation.FederatedHarvestException;
import org.civicsrepo.federation.FederatedHarvestRunService;
import org.civicsrepo.federation.FederatedMetadataCatalog;
import org.civicsrepo.federation.FederatedSourceSystem;
import org.civicsrepo.federation.HarvestRun;
import org.civicsrepo.federation.HarvestRunStore;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Local-demo operator endpoints for bounded federated metadata harvesting. */
@RestController
@RequestMapping("/admin/federation/harvest")
public class FederationHarvestAdminController {
    private static final int MAX_PAGE_SIZE = 10_000;
    private static final int MAX_PAGES = 100_000;

    private final FederatedHarvestRunService harvestRunService;
    private final HarvestRunStore harvestRunStore;
    private final FederatedMetadataCatalog metadataCatalog;

    public FederationHarvestAdminController(
            FederatedHarvestRunService harvestRunService,
            HarvestRunStore harvestRunStore,
            FederatedMetadataCatalog metadataCatalog) {
        this.harvestRunService = harvestRunService;
        this.harvestRunStore = harvestRunStore;
        this.metadataCatalog = metadataCatalog;
    }

    /** Inspect retained metadata and the durable run that would be resumed before mutating the source. */
    @GetMapping("/status")
    public FederationHarvestStatusResponse status(
            @RequestParam(defaultValue = "DATA_GOV") FederatedSourceSystem sourceSystem) {
        FederationHarvestResponse resumable = harvestRunStore
                .findResumable(sourceSystem)
                .map(FederationHarvestResponse::from)
                .orElse(null);
        List<HarvestRun> recent = harvestRunStore.findRecent(sourceSystem, 1);
        FederationHarvestResponse latest = recent.isEmpty() ? null : FederationHarvestResponse.from(recent.getFirst());
        return new FederationHarvestStatusResponse(sourceSystem, metadataCatalog.count(sourceSystem), resumable, latest);
    }

    /** Run a new harvest or resume the current bounded run for this source. */
    @PostMapping
    public FederationHarvestResponse harvest(@RequestBody FederationHarvestRequest request) {
        validate(request);
        return execute(() -> harvestRunService.runBounded(
                request.sourceSystem(), request.pageSize(), request.maxPages()));
    }

    /**
     * Cancel any resumable run, clear its source checkpoint, and begin again at source offset zero.
     *
     * <p>This does not delete metadata already retained locally. It resets source traversal, not the
     * federated corpus.
     */
    @PostMapping("/restart")
    public FederationHarvestResponse restart(@RequestBody FederationHarvestRequest request) {
        validate(request);
        return execute(() -> harvestRunService.restartFromBeginning(
                request.sourceSystem(), request.pageSize(), request.maxPages()));
    }

    private FederationHarvestResponse execute(HarvestOperation operation) {
        try {
            HarvestRun run = operation.run();
            return FederationHarvestResponse.from(run);
        } catch (FederatedHarvestException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, exception.getMessage(), exception);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, exception.getMessage(), exception);
        }
    }

    private void validate(FederationHarvestRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Harvest request is required.");
        }
        if (request.sourceSystem() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "sourceSystem is required.");
        }
        if (request.pageSize() < 1 || request.pageSize() > MAX_PAGE_SIZE) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "pageSize must be between 1 and " + MAX_PAGE_SIZE + ".");
        }
        if (request.maxPages() < 1 || request.maxPages() > MAX_PAGES) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "maxPages must be between 1 and " + MAX_PAGES + ".");
        }
    }

    @FunctionalInterface
    private interface HarvestOperation {
        HarvestRun run();
    }
}
