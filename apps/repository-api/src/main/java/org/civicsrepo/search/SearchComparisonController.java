package org.civicsrepo.search;

import java.util.List;
import org.civicsrepo.generated.dto.SearchComparisonRequest;
import org.civicsrepo.generated.dto.SearchComparisonResponse;
import org.civicsrepo.generated.dto.SearchComparisonScenario;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/search/comparison")
public class SearchComparisonController {
    private final SearchComparisonService searchComparisonService;

    public SearchComparisonController(SearchComparisonService searchComparisonService) {
        this.searchComparisonService = searchComparisonService;
    }

    @GetMapping("/scenarios")
    public List<SearchComparisonScenario> scenarios() {
        return searchComparisonService.scenarios();
    }

    @PostMapping("/run")
    public SearchComparisonResponse run(
            @RequestBody SearchComparisonRequest request,
            @RequestParam(defaultValue = "SOLR_FIRST") SearchComparisonExecutionOrder order,
            @RequestParam(defaultValue = "BASELINE_SCOPED_FILTERS")
                    OpenSearchComparisonTreatment openSearchTreatment) {
        return searchComparisonService.run(request, order, openSearchTreatment);
    }
}
