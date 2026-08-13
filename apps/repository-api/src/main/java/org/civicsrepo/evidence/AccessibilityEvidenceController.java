package org.civicsrepo.evidence;

import org.civicsrepo.generated.dto.AccessibilityEvidence;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/accessibility/evidence")
public class AccessibilityEvidenceController {
    private final AccessibilityEvidenceService evidenceService;

    public AccessibilityEvidenceController(AccessibilityEvidenceService evidenceService) {
        this.evidenceService = evidenceService;
    }

    @GetMapping
    public List<AccessibilityEvidence> getAccessibilityEvidence() {
        return evidenceService.listEvidence();
    }
}
