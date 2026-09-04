package org.civicsrepo.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import org.civicsrepo.generated.dto.SearchComparisonRequest;
import org.civicsrepo.generated.dto.SearchComparisonResponse;
import org.civicsrepo.generated.dto.SearchComparisonScenario;
import org.civicsrepo.generated.dto.SearchComparisonScenarioId;
import org.junit.jupiter.api.Test;

class SearchComparisonControllerTest {
    @Test
    void listsScenariosFromTheComparisonService() {
        SearchComparisonService service = mock(SearchComparisonService.class);
        SearchComparisonController controller = new SearchComparisonController(service);
        List<SearchComparisonScenario> scenarios = List.of(
                new SearchComparisonScenario(
                        SearchComparisonScenarioId.FACETED_SEARCH,
                        "Facets vs aggregations",
                        "Compare equivalent facet semantics."));
        when(service.scenarios()).thenReturn(scenarios);

        assertThat(controller.scenarios()).isSameAs(scenarios);
        verify(service).scenarios();
    }

    @Test
    void delegatesTheTypedComparisonRequestExecutionOrderAndTreatment() {
        SearchComparisonService service = mock(SearchComparisonService.class);
        SearchComparisonController controller = new SearchComparisonController(service);
        SearchComparisonRequest request = new SearchComparisonRequest(SearchComparisonScenarioId.FILTERING)
                .query("North Dakota workforce")
                .page(0)
                .pageSize(10);
        SearchComparisonResponse response = mock(SearchComparisonResponse.class);
        when(service.run(
                        request,
                        SearchComparisonExecutionOrder.OPENSEARCH_FIRST,
                        OpenSearchComparisonTreatment.C2_1_OPTIMIZED_EQUIVALENT))
                .thenReturn(response);

        assertThat(controller.run(
                        request,
                        SearchComparisonExecutionOrder.OPENSEARCH_FIRST,
                        OpenSearchComparisonTreatment.C2_1_OPTIMIZED_EQUIVALENT))
                .isSameAs(response);
        verify(service)
                .run(
                        request,
                        SearchComparisonExecutionOrder.OPENSEARCH_FIRST,
                        OpenSearchComparisonTreatment.C2_1_OPTIMIZED_EQUIVALENT);
    }
}
