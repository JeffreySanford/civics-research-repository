package org.civicsrepo.repository;

import org.civicsrepo.repository.DiscoveryProjectionService.ProjectionState;
import org.civicsrepo.search.SearchService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Rebuilds the discovery projection from DSpace on demand.
 *
 * <p>The projection must always be reconstructible from the repository, so that has to be an
 * operation someone can actually run — after a sync, after a DSpace restore, or when the index is
 * suspected stale. Unauthenticated for the same deliberate local-demo reasons as the sync
 * endpoints; see planning/DECISIONS.md under "Admin API Authentication".
 */
@RestController
@RequestMapping("/admin/reindex")
public class ReindexController {
    private final DiscoveryProjectionService discoveryProjectionService;
    private final SearchService searchService;

    public ReindexController(DiscoveryProjectionService discoveryProjectionService, SearchService searchService) {
        this.discoveryProjectionService = discoveryProjectionService;
        this.searchService = searchService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.ACCEPTED)
    public ProjectionState reindex() {
        return discoveryProjectionService.reindex(searchService.fixtureDocuments());
    }

    /** What the discovery index currently holds, without rebuilding it. */
    @GetMapping
    public ProjectionState projectionState() {
        return discoveryProjectionService.state();
    }
}
