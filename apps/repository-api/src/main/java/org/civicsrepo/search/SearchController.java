package org.civicsrepo.search;

import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SearchResponse;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/search")
public class SearchController {
    private final SearchService searchService;

    public SearchController(SearchService searchService) {
        this.searchService = searchService;
    }

    /**
     * @param program repeatable; results match any selected program. Absent means every program,
     *     which is why the frontend sends its defaults explicitly rather than relying on omission.
     */
    @GetMapping
    public SearchResponse searchResearchObjects(
            @RequestParam(required = false, name = "q") String query,
            @RequestParam(required = false) List<ResearchProgram> program,
            @RequestParam(required = false) String geography,
            @RequestParam(required = false) ResearchObjectType contentType,
            @RequestParam(required = false) Integer vintageYear,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int pageSize) {
        return searchService.search(
                query,
                program == null ? List.of() : program,
                geography,
                contentType,
                vintageYear,
                page,
                pageSize);
    }
}
