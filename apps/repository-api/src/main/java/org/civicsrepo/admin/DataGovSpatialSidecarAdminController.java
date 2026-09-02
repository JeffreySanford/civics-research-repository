package org.civicsrepo.admin;

import org.civicsrepo.federation.FederatedSourceSystem;
import org.civicsrepo.spatial.DataGovSpatialSidecarRefreshResult;
import org.civicsrepo.spatial.DataGovSpatialSidecarService;
import org.civicsrepo.spatial.ResearchSpatialSidecarBuild;
import org.civicsrepo.spatial.ResearchSpatialSidecarStore;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Local operator endpoints for the independently rebuildable Data.gov spatial sidecar. */
@RestController
@RequestMapping("/admin/spatial/datagov")
public class DataGovSpatialSidecarAdminController {
    private static final int DEFAULT_PAGE_SIZE = 1_000;
    private static final int DEFAULT_MAX_PAGES = 2_000;

    private final DataGovSpatialSidecarService sidecarService;
    private final ResearchSpatialSidecarStore sidecarStore;

    public DataGovSpatialSidecarAdminController(
            DataGovSpatialSidecarService sidecarService, ResearchSpatialSidecarStore sidecarStore) {
        this.sidecarService = sidecarService;
        this.sidecarStore = sidecarStore;
    }

    @GetMapping("/status")
    public StatusResponse status() {
        ResearchSpatialSidecarBuild active = sidecarStore
                .findActiveBuild(FederatedSourceSystem.DATA_GOV)
                .orElse(null);
        return new StatusResponse(
                active,
                active == null ? 0 : sidecarStore.countActive(FederatedSourceSystem.DATA_GOV));
    }

    @PostMapping("/rebuild")
    public DataGovSpatialSidecarRefreshResult rebuild(@RequestBody(required = false) RebuildRequest request) {
        RebuildRequest effective = request == null ? new RebuildRequest(null, null) : request;
        try {
            return sidecarService.rebuild(effective.effectivePageSize(), effective.effectiveMaxPages());
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, exception.getMessage(), exception);
        } catch (IllegalStateException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, exception.getMessage(), exception);
        }
    }

    public record RebuildRequest(Integer pageSize, Integer maxPages) {
        int effectivePageSize() {
            return pageSize == null ? DEFAULT_PAGE_SIZE : pageSize;
        }

        int effectiveMaxPages() {
            return maxPages == null ? DEFAULT_MAX_PAGES : maxPages;
        }
    }

    public record StatusResponse(ResearchSpatialSidecarBuild activeBuild, long activeRowCount) {}
}
