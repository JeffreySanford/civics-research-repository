package org.civicsrepo.search;

import java.util.List;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.generated.dto.SearchResponse;
import org.civicsrepo.generated.dto.SourceSystem;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/search")
public class SearchController {
    private final SearchService searchService;
    private final SearchCursorService searchCursorService;

    /** Compatibility constructor retained for focused controller tests of the offset endpoint. */
    public SearchController(SearchService searchService) {
        this(searchService, null);
    }

    @Autowired
    public SearchController(SearchService searchService, SearchCursorService searchCursorService) {
        this.searchService = searchService;
        this.searchCursorService = searchCursorService;
    }

    /**
     * @param program repeatable data-driven program names; results match any selected value. Absent
     *     means every program. Values come from indexed metadata and are not limited to the legacy
     *     curated ResearchProgram enum.
     * @param publisher optional exact publisher facet value from indexed metadata.
     * @param sourceSystem optional controlled authoritative source-system facet value.
     */
    @GetMapping
    public SearchResponse searchResearchObjects(
            @RequestParam(required = false, name = "q") String query,
            @RequestParam(required = false) List<String> program,
            @RequestParam(required = false) String publisher,
            @RequestParam(required = false) SourceSystem sourceSystem,
            @RequestParam(required = false) String geography,
            @RequestParam(required = false) ResearchObjectType contentType,
            @RequestParam(required = false) Integer vintageYear,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int pageSize) {
        return searchService.search(
                query,
                program == null ? List.of() : program,
                publisher,
                sourceSystem,
                geography,
                contentType,
                vintageYear,
                page,
                pageSize);
    }

    /**
     * Preferred forward-only traversal for large result sets. Existing `/search?page=` bookmarks
     * remain valid; cursor clients opt into this endpoint and resend only the opaque nextCursor
     * returned by the previous page with the same query/filter/page-size state.
     */
    @GetMapping("/cursor")
    public SearchCursorPage searchResearchObjectsWithCursor(
            @RequestParam(required = false, name = "q") String query,
            @RequestParam(required = false) List<String> program,
            @RequestParam(required = false) String publisher,
            @RequestParam(required = false) SourceSystem sourceSystem,
            @RequestParam(required = false) String geography,
            @RequestParam(required = false) ResearchObjectType contentType,
            @RequestParam(required = false) Integer vintageYear,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "25") int pageSize) {
        if (searchCursorService == null) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE, "Cursor search service is not configured.");
        }
        return searchCursorService.search(
                query,
                program == null ? List.of() : program,
                publisher,
                sourceSystem,
                geography,
                contentType,
                vintageYear,
                cursor,
                pageSize);
    }
}
