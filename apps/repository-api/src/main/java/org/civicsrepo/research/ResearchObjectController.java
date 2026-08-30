package org.civicsrepo.research;

import org.civicsrepo.generated.dto.ResearchObjectDetail;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/research")
public final class ResearchObjectController {
    private final ResearchObjectService researchObjectService;

    public ResearchObjectController(ResearchObjectService researchObjectService) {
        this.researchObjectService = researchObjectService;
    }

    @GetMapping("/{researchId}")
    public ResearchObjectDetail getResearchObject(@PathVariable String researchId) {
        return researchObjectService.getResearchObject(researchId);
    }
}
