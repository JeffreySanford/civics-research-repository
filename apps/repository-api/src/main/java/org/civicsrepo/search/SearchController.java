package org.civicsrepo.search;

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

    @GetMapping
    public SearchResponse searchResearchObjects(
            @RequestParam(required = false, name = "q") String query,
            @RequestParam(required = false) ResearchProgram program,
            @RequestParam(required = false) String geography,
            @RequestParam(required = false) Integer vintageYear,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int pageSize) {
        return searchService.search(query, program, geography, vintageYear, page, pageSize);
    }
}
