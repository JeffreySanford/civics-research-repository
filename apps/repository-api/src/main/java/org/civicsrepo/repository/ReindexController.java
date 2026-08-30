package org.civicsrepo.repository;

import org.civicsrepo.admin.CorpusProfileActivationService;
import org.civicsrepo.federation.CorpusProfile;
import org.civicsrepo.generated.dto.DiscoveryProjectionState;
import org.civicsrepo.repository.DiscoveryProjectionService.ProjectionState;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Rebuilds the discovery projection from the selected corpus profile on demand.
 *
 * <p>The projection remains reconstructible from authoritative metadata. A requested profile is
 * recorded as active only after every enabled search target completes on the same deterministic
 * projection identity and count. When no profile is supplied, the currently active profile is
 * rebuilt; before any activation has been persisted that defaults to CURATED_DEMO.
 *
 * <p>Unauthenticated for the same deliberate local-demo reasons as the sync endpoints; see
 * planning/DECISIONS.md under "Admin API Authentication".
 */
@RestController
@RequestMapping("/admin/reindex")
public class ReindexController {
    private final DiscoveryProjectionService discoveryProjectionService;
    private final CorpusProfileActivationService activationService;

    public ReindexController(
            DiscoveryProjectionService discoveryProjectionService,
            CorpusProfileActivationService activationService) {
        this.discoveryProjectionService = discoveryProjectionService;
        this.activationService = activationService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.ACCEPTED)
    public DiscoveryProjectionState reindex(@RequestParam(required = false) CorpusProfile profile) {
        ProjectionState projected = profile == null
                ? activationService.rebuildActiveProfile()
                : activationService.activate(profile);
        return response(projected);
    }

    /** What the discovery index currently holds, without rebuilding it. */
    @GetMapping
    public DiscoveryProjectionState projectionState() {
        return response(discoveryProjectionService.state());
    }

    private DiscoveryProjectionState response(ProjectionState state) {
        DiscoveryProjectionState response = new DiscoveryProjectionState(state.source(), state.objectCount());
        if (state.rebuiltAt() != null) {
            response.rebuiltAt(state.rebuiltAt());
        }
        String projectionId = discoveryProjectionService.currentProjectionId();
        if (projectionId != null && !projectionId.isBlank()) {
            response.projectionId(projectionId);
        }
        return response;
    }
}
