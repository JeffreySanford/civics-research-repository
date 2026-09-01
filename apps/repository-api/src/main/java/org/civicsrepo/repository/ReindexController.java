package org.civicsrepo.repository;

import org.civicsrepo.admin.CorpusProfileActivationProgress;
import org.civicsrepo.admin.CorpusProfileActivationService;
import org.civicsrepo.admin.ExactCompositeCorpusActivationService;
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
 * projection identity and count. FEDERATED_1M is stricter: it is activated only through the exact
 * C2 composite evidence path rather than a generic first-million retained prefix. When no profile
 * is supplied, the currently active profile is rebuilt; before any activation has been persisted
 * that defaults to CURATED_DEMO.
 *
 * <p>Unauthenticated for the same deliberate local-demo reasons as the sync endpoints; see
 * planning/DECISIONS.md under "Admin API Authentication".
 */
@RestController
@RequestMapping("/admin/reindex")
public class ReindexController {
    private final DiscoveryProjectionService discoveryProjectionService;
    private final CorpusProfileActivationService activationService;
    private final ExactCompositeCorpusActivationService exactCompositeActivationService;

    public ReindexController(
            DiscoveryProjectionService discoveryProjectionService,
            CorpusProfileActivationService activationService,
            ExactCompositeCorpusActivationService exactCompositeActivationService) {
        this.discoveryProjectionService = discoveryProjectionService;
        this.activationService = activationService;
        this.exactCompositeActivationService = exactCompositeActivationService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.ACCEPTED)
    public DiscoveryProjectionState reindex(@RequestParam(required = false) CorpusProfile profile) {
        ProjectionState projected;
        if (profile == null) {
            projected = activationService.rebuildActiveProfile();
        } else if (profile == CorpusProfile.FEDERATED_1M) {
            projected = exactCompositeActivationService.activate(profile);
        } else {
            projected = activationService.activate(profile);
        }
        return response(projected);
    }

    /** What the discovery index currently holds, without rebuilding it. */
    @GetMapping
    public DiscoveryProjectionState projectionState() {
        return response(discoveryProjectionService.state());
    }

    /** Live batch progress for the most recent or currently running corpus-profile activation. */
    @GetMapping("/progress")
    public CorpusProfileActivationProgress activationProgress() {
        return activationService.currentProgress();
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
