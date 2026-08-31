package org.civicsrepo.admin;

import org.civicsrepo.federation.CorpusProfile;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Starts long-running guarded corpus growth while progress is read from /admin/reindex/progress. */
@RestController
@RequestMapping("/admin/corpus/scale")
public class CorpusProfileScaleController {
    private final CorpusProfileScaleService scaleService;

    public CorpusProfileScaleController(CorpusProfileScaleService scaleService) {
        this.scaleService = scaleService;
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
}
