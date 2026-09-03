package org.civicsrepo.evidence;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/evidence/search-performance")
public class SearchPerformanceEvidenceController {
    private final SearchPerformanceEvidenceService evidenceService;

    public SearchPerformanceEvidenceController(SearchPerformanceEvidenceService evidenceService) {
        this.evidenceService = evidenceService;
    }

    @GetMapping
    public ResponseEntity<SearchPerformanceEvidence> getSearchPerformanceEvidence() {
        return evidenceService.latestEvidence()
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
