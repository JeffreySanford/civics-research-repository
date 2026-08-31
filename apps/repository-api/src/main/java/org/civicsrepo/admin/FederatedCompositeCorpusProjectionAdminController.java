package org.civicsrepo.admin;

import java.util.List;
import org.civicsrepo.federation.CorpusProfile;
import org.civicsrepo.federation.FederatedCompositeCorpusProjectionEvidence;
import org.civicsrepo.federation.FederatedCompositeCorpusProjectionEvidenceStore;
import org.civicsrepo.federation.FederatedCompositeCorpusProjectionService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Operator endpoints for exact composite-corpus to discovery-projection linkage evidence. */
@RestController
@RequestMapping("/admin/federation/compositions")
public class FederatedCompositeCorpusProjectionAdminController {
    private static final int MAX_HISTORY = 1_000;
    private static final String SHA256_PATTERN = "[0-9a-f]{64}";

    private final FederatedCompositeCorpusProjectionService projectionService;
    private final FederatedCompositeCorpusProjectionEvidenceStore evidenceStore;

    public FederatedCompositeCorpusProjectionAdminController(
            FederatedCompositeCorpusProjectionService projectionService,
            FederatedCompositeCorpusProjectionEvidenceStore evidenceStore) {
        this.projectionService = projectionService;
        this.evidenceStore = evidenceStore;
    }

    /** Rebuild search from the exact composed source quotas and persist the linkage if stable. */
    @PostMapping("/{compositionSha256}/project")
    public FederatedCompositeCorpusProjectionEvidence project(@PathVariable String compositionSha256) {
        requireSha(compositionSha256);
        try {
            return projectionService.project(compositionSha256);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, exception.getMessage(), exception);
        } catch (IllegalStateException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, exception.getMessage(), exception);
        }
    }

    /** Resolve the newest projection relationship for one exact composition identity. */
    @GetMapping("/{compositionSha256}/projection")
    public FederatedCompositeCorpusProjectionEvidence latestProjection(
            @PathVariable String compositionSha256) {
        requireSha(compositionSha256);
        return evidenceStore
                .findLatestByCompositionSha256(compositionSha256)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "No search projection evidence exists for this composition."));
    }

    /** Read newest composition-to-projection relationships for one named corpus profile. */
    @GetMapping("/projections")
    public List<FederatedCompositeCorpusProjectionEvidence> recentProjections(
            @RequestParam CorpusProfile corpusProfile,
            @RequestParam(defaultValue = "20") int limit) {
        if (limit < 1 || limit > MAX_HISTORY) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "limit must be between 1 and " + MAX_HISTORY + ".");
        }
        return evidenceStore.findRecent(corpusProfile, limit);
    }

    private void requireSha(String compositionSha256) {
        if (compositionSha256 == null || !compositionSha256.matches(SHA256_PATTERN)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "compositionSha256 must be a lowercase SHA-256 hex digest.");
        }
    }
}
