package org.civicsrepo.maps;

import java.util.List;
import org.civicsrepo.federation.FederatedSourceSystem;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.spatial.ResearchSpatialCoverageQueryService;
import org.civicsrepo.spatial.ResearchSpatialCoverageResponse;
import org.civicsrepo.spatial.ResearchSpatialCoverageUnavailableException;
import org.civicsrepo.spatial.ResearchSpatialViewport;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Bounded, sidecar-backed research coverage reads for the Maps experience. */
@RestController
@RequestMapping("/maps/research-coverage")
public class ResearchSpatialCoverageController {
    private final ResearchSpatialCoverageQueryService queryService;

    public ResearchSpatialCoverageController(ResearchSpatialCoverageQueryService queryService) {
        this.queryService = queryService;
    }

    @GetMapping
    public ResearchSpatialCoverageResponse getResearchSpatialCoverage(
            @RequestParam(required = false, name = "q") String query,
            @RequestParam(required = false) List<String> program,
            @RequestParam(required = false) String publisher,
            @RequestParam(defaultValue = "DATA_GOV") FederatedSourceSystem sourceSystem,
            @RequestParam(required = false) String geography,
            @RequestParam(required = false) ResearchObjectType contentType,
            @RequestParam(required = false) Integer vintageYear,
            @RequestParam double west,
            @RequestParam double south,
            @RequestParam double east,
            @RequestParam double north,
            @RequestParam(defaultValue = "200") int limit) {
        try {
            return queryService.query(
                    query,
                    program == null ? List.of() : program,
                    publisher,
                    sourceSystem,
                    geography,
                    contentType,
                    vintageYear,
                    new ResearchSpatialViewport(west, south, east, north),
                    limit);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, exception.getMessage(), exception);
        } catch (ResearchSpatialCoverageUnavailableException exception) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, exception.getMessage(), exception);
        }
    }
}
