package org.civicsrepo.admin;

import java.util.List;
import org.civicsrepo.federation.CorpusProfile;
import org.civicsrepo.federation.FederatedCompositeCorpusCaptureRequest;
import org.civicsrepo.federation.FederatedCompositeCorpusManifest;
import org.civicsrepo.federation.FederatedCompositeCorpusManifestService;
import org.civicsrepo.federation.FederatedCompositeCorpusManifestStore;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Operator endpoints for immutable multi-source corpus composition evidence. */
@RestController
@RequestMapping("/admin/federation/compositions")
public class FederatedCompositeCorpusAdminController {
    private static final int MAX_HISTORY = 1_000;

    private final FederatedCompositeCorpusManifestService manifestService;
    private final FederatedCompositeCorpusManifestStore manifestStore;

    public FederatedCompositeCorpusAdminController(
            FederatedCompositeCorpusManifestService manifestService,
            FederatedCompositeCorpusManifestStore manifestStore) {
        this.manifestService = manifestService;
        this.manifestStore = manifestStore;
    }

    /** Compose already-captured bounded source snapshots into one durable corpus identity. */
    @PostMapping
    public FederatedCompositeCorpusManifest capture(@RequestBody FederatedCompositeCorpusCaptureRequest request) {
        try {
            return manifestService.capture(request.corpusProfile(), request.sources());
        } catch (IllegalArgumentException | IllegalStateException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, exception.getMessage(), exception);
        }
    }

    /** Read recent immutable composition evidence for one named corpus profile. */
    @GetMapping
    public List<FederatedCompositeCorpusManifest> recent(
            @RequestParam CorpusProfile corpusProfile,
            @RequestParam(defaultValue = "20") int limit) {
        if (limit < 1 || limit > MAX_HISTORY) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "limit must be between 1 and " + MAX_HISTORY + ".");
        }
        return manifestStore.findRecent(corpusProfile, limit);
    }

    /** Resolve one exact composition identity without mutating evidence. */
    @GetMapping("/{compositionSha256}")
    public FederatedCompositeCorpusManifest byCompositionSha256(@PathVariable String compositionSha256) {
        return manifestStore
                .findByCompositionSha256(compositionSha256)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Unknown composite corpus composition SHA-256."));
    }
}
