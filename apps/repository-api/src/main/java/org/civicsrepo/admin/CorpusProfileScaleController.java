package org.civicsrepo.admin;

import org.civicsrepo.federation.CorpusProfile;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Starts guarded corpus growth and exposes non-mutating evidence verification for named profiles. */
@RestController
@RequestMapping("/admin/corpus/scale")
public class CorpusProfileScaleController {
    private final CorpusProfileScaleService scaleService;
    private final CorpusScaleEvidenceService evidenceService;

    public CorpusProfileScaleController(
            CorpusProfileScaleService scaleService,
            CorpusScaleEvidenceService evidenceService) {
        this.scaleService = scaleService;
        this.evidenceService = evidenceService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.ACCEPTED)
    public CorpusProfileActivationProgress scale(@RequestParam CorpusProfile profile) {
        try {
            return scaleService.start(profile);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, exception.getMessage(), exception);
        } catch (IllegalStateException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, exception.getMessage(), exception);
        }
    }

    /** Verify the current live evidence chain for a named profile without changing corpus/search state. */
    @GetMapping("/evidence")
    public CorpusScaleEvidenceReport evidence(@RequestParam CorpusProfile profile) {
        try {
            return evidenceService.verify(profile);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, exception.getMessage(), exception);
        }
    }
}
