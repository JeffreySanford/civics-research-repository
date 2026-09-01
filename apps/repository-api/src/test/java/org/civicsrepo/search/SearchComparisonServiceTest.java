package org.civicsrepo.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.civicsrepo.generated.dto.RepositorySource;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.generated.dto.SearchComparisonEngine;
import org.civicsrepo.generated.dto.SearchComparisonRequest;
import org.civicsrepo.generated.dto.SearchComparisonScenarioId;
import org.civicsrepo.generated.dto.SearchResponse;
import org.civicsrepo.generated.dto.SourceSystem;
import org.civicsrepo.repository.DiscoveryProjectionService;
import org.civicsrepo.repository.DiscoveryProjectionService.ProjectionState;
import org.civicsrepo.repository.DiscoveryProjectionService.ProjectionTargetState;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SearchComparisonServiceTest {
    private static final String PROJECTION_ID =
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    private DiscoveryIndex solr;
    private OpenSearchProjectionClient openSearch;
    private DiscoveryProjectionService projectionService;
    private SearchComparisonService service;

    @BeforeEach
    void setUp() {
        solr = mock(DiscoveryIndex.class);
        openSearch = mock(OpenSearchProjectionClient.class);
        projectionService = mock(DiscoveryProjectionService.class);
        service = new SearchComparisonService(solr, openSearch, projectionService);

        when(solr.indexName()).thenReturn("discovery");
        when(openSearch.indexName()).thenReturn("discovery-comparison");
        when(solr.documentCount()).thenReturn(Optional.of(181));
        when(openSearch.documentCount()).thenReturn(Optional.of(181));
        when(projectionService.state())
                .thenReturn(new ProjectionState(
                        RepositorySource.REPOSITORY,
                        181,
                        OffsetDateTime.parse("2026-08-29T13:03:07-05:00")));
        when(projectionService.currentProjectionId()).thenReturn(PROJECTION_ID);
        currentProjectionFor("discovery", PROJECTION_ID, 181, null);
        currentProjectionFor("discovery-comparison", PROJECTION_ID, 181, null);
    }

    @Test
    void runsBothEnginesAgainstTheSameDataDrivenProgramRequestAndVerifiesParity() {
        available(solr);
        available(openSearch);
        SearchComparisonCriteria expectedCriteria = new SearchComparisonCriteria(
                "reactor materials",
                List.of("Office of Science"),
                "Office of Science",
                SourceSystem.DOE_OSTI,
                "DOE_OSTI:12345",
                "10.11578/12345",
                null,
                ResearchObjectType.PUBLICATION,
                null,
                0,
                25);
        when(solr.searchWithDiagnostics(expectedCriteria))
                .thenReturn(execution(3, 6));
        when(openSearch.searchWithDiagnostics(expectedCriteria))
                .thenReturn(execution(3, 11));

        SearchComparisonRequest request = new SearchComparisonRequest(SearchComparisonScenarioId.FACETED_SEARCH)
                .query("reactor materials")
                .programs(List.of("Office of Science"))
                .publisher("Office of Science")
                .sourceSystem(SourceSystem.DOE_OSTI)
                .localId("DOE_OSTI:12345")
                .doi("10.11578/12345")
                .contentType(ResearchObjectType.PUBLICATION)
                .page(0)
                .pageSize(25);

        var result = service.run(request);

        assertThat(result.getScenario()).isEqualTo(SearchComparisonScenarioId.FACETED_SEARCH);
        assertThat(result.getSameProjection()).isTrue();
        assertThat(result.getProjection().getProjectionId()).isEqualTo(PROJECTION_ID);
        assertThat(result.getProjection().getObjectCount()).isEqualTo(181);
        assertThat(result.getSolr().getEngine()).isEqualTo(SearchComparisonEngine.SOLR);
        assertThat(result.getOpenSearch().getEngine()).isEqualTo(SearchComparisonEngine.OPENSEARCH);
        assertThat(result.getSolr().getTotalHits()).isEqualTo(3);
        assertThat(result.getOpenSearch().getTotalHits()).isEqualTo(3);
        assertThat(result.getSolr().getEngineReportedMs()).isEqualTo(6L);
        assertThat(result.getOpenSearch().getEngineReportedMs()).isEqualTo(11L);
        verify(solr).searchWithDiagnostics(expectedCriteria);
        verify(openSearch).searchWithDiagnostics(expectedCriteria);
    }

    @Test
    void reversesEngineExecutionOrderWithoutChangingTheResponseShape() {
        available(solr);
        available(openSearch);
        when(solr.searchWithDiagnostics(any(SearchComparisonCriteria.class)))
                .thenReturn(execution(2, 4));
        when(openSearch.searchWithDiagnostics(any(SearchComparisonCriteria.class)))
                .thenReturn(execution(2, 7));

        SearchComparisonRequest request = new SearchComparisonRequest(SearchComparisonScenarioId.FULL_TEXT_RELEVANCE)
                .query("workforce")
                .page(0)
                .pageSize(10);

        var result = service.run(request, SearchComparisonExecutionOrder.OPENSEARCH_FIRST);

        var order = inOrder(openSearch, solr);
        order.verify(openSearch).isEnabled();
        order.verify(openSearch).documentCount();
        SearchComparisonCriteria expected = new SearchComparisonCriteria(
                "workforce", List.of(), null, null, null, null, null, null, null, 0, 10);
        order.verify(openSearch).searchWithDiagnostics(expected);
        order.verify(solr).isEnabled();
        order.verify(solr).documentCount();
        order.verify(solr).searchWithDiagnostics(expected);
        assertThat(result.getSameProjection()).isTrue();
        assertThat(result.getSolr().getTotalHits()).isEqualTo(2);
        assertThat(result.getOpenSearch().getTotalHits()).isEqualTo(2);
    }

    @Test
    void keepsSolrResultWhenOpenSearchIsDown() {
        available(solr);
        when(openSearch.isEnabled()).thenReturn(true);
        when(openSearch.documentCount()).thenReturn(Optional.empty());
        when(solr.searchWithDiagnostics(any(SearchComparisonCriteria.class)))
                .thenReturn(execution(2, 5));

        var result = service.run(new SearchComparisonRequest(SearchComparisonScenarioId.FULL_TEXT_RELEVANCE)
                .query("workforce")
                .page(0)
                .pageSize(10));

        assertThat(result.getSolr().getReachable()).isTrue();
        assertThat(result.getSolr().getTotalHits()).isEqualTo(2);
        assertThat(result.getOpenSearch().getEnabled()).isTrue();
        assertThat(result.getOpenSearch().getReachable()).isFalse();
        assertThat(result.getOpenSearch().getWarning()).contains("not reachable");
    }

    @Test
    void isolatesOneEngineSearchFailureAndStillRunsTheOtherEngine() {
        available(solr);
        available(openSearch);
        when(solr.searchWithDiagnostics(any(SearchComparisonCriteria.class)))
                .thenThrow(new IllegalStateException("Solr request failed"));
        when(openSearch.searchWithDiagnostics(any(SearchComparisonCriteria.class)))
                .thenReturn(execution(4, 5));

        var result = service.run(new SearchComparisonRequest(SearchComparisonScenarioId.FILTERING)
                .query("jobs")
                .page(0)
                .pageSize(10));

        assertThat(result.getSolr().getWarning()).contains("Solr request failed");
        assertThat(result.getSolr().getReturnedHits()).isZero();
        assertThat(result.getOpenSearch().getTotalHits()).isEqualTo(4);
        verify(openSearch).searchWithDiagnostics(
                new SearchComparisonCriteria("jobs", List.of(), null, null, null, null, null, null, null, 0, 10));
    }

    @Test
    void reportsProjectionMismatchEvenWhenDocumentCountsMatch() {
        available(solr);
        available(openSearch);
        when(solr.searchWithDiagnostics(any(SearchComparisonCriteria.class)))
                .thenReturn(execution(1, 5));
        when(openSearch.searchWithDiagnostics(any(SearchComparisonCriteria.class)))
                .thenReturn(execution(1, 5));
        currentProjectionFor(
                "discovery-comparison",
                "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                181,
                null);

        var result = service.run(new SearchComparisonRequest(SearchComparisonScenarioId.FACETED_SEARCH));

        assertThat(result.getSameProjection()).isFalse();
        assertThat(result.getSolr().getIndexedDocumentCount()).isEqualTo(181);
        assertThat(result.getOpenSearch().getIndexedDocumentCount()).isEqualTo(181);
    }

    @Test
    void normalizesNullQueryAndOutOfRangePagingBeforeCallingEitherEngine() {
        available(solr);
        available(openSearch);
        when(solr.searchWithDiagnostics(any(SearchComparisonCriteria.class)))
                .thenReturn(execution(0, 5));
        when(openSearch.searchWithDiagnostics(any(SearchComparisonCriteria.class)))
                .thenReturn(execution(0, 5));

        service.run(new SearchComparisonRequest(SearchComparisonScenarioId.FILTERING)
                .page(-9)
                .pageSize(500));

        SearchComparisonCriteria expected = new SearchComparisonCriteria(
                "", List.of(), null, null, null, null, null, null, null, 0, 100);
        verify(solr).searchWithDiagnostics(expected);
        verify(openSearch).searchWithDiagnostics(expected);
    }

    @Test
    void exposesTheThreeCurrentComparisonScenarios() {
        assertThat(service.scenarios())
                .extracting((scenario) -> scenario.getId())
                .containsExactly(
                        SearchComparisonScenarioId.FACETED_SEARCH,
                        SearchComparisonScenarioId.FULL_TEXT_RELEVANCE,
                        SearchComparisonScenarioId.FILTERING);
    }

    private void available(DiscoveryProjectionTarget target) {
        when(target.isEnabled()).thenReturn(true);
    }

    private SearchResponse response(int total) {
        return new SearchResponse(RepositorySource.REPOSITORY, "", 0, 10, total, List.of(), List.of());
    }

    private SearchExecution execution(int total, long engineReportedMs) {
        return new SearchExecution(response(total), engineReportedMs);
    }

    private void currentProjectionFor(String indexName, String projectionId, int documentCount, String warning) {
        when(projectionService.targetState(indexName))
                .thenReturn(new ProjectionTargetState(indexName, true, true, projectionId, documentCount, warning));
    }
}
