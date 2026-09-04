package org.civicsrepo.search;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import org.civicsrepo.generated.dto.FacetGroup;
import org.civicsrepo.generated.dto.RepositorySource;
import org.civicsrepo.generated.dto.SearchComparisonEngine;
import org.civicsrepo.generated.dto.SearchComparisonProjection;
import org.civicsrepo.generated.dto.SearchComparisonRequest;
import org.civicsrepo.generated.dto.SearchComparisonResponse;
import org.civicsrepo.generated.dto.SearchComparisonScenario;
import org.civicsrepo.generated.dto.SearchComparisonScenarioId;
import org.civicsrepo.generated.dto.SearchEngineComparison;
import org.civicsrepo.generated.dto.SearchResponse;
import org.civicsrepo.generated.dto.SearchResult;
import org.civicsrepo.repository.DiscoveryProjectionService;
import org.civicsrepo.repository.DiscoveryProjectionService.ProjectionState;
import org.civicsrepo.repository.DiscoveryProjectionService.ProjectionTargetState;
import org.springframework.stereotype.Service;

/** Runs one normalized discovery request against the application-owned Solr and OpenSearch projections. */
@Service
public class SearchComparisonService {
    private static final int DEFAULT_PAGE_SIZE = 10;

    private final DiscoveryIndex solr;
    private final OpenSearchProjectionClient openSearch;
    private final OpenSearchC21OptimizedClient c21OpenSearch;
    private final DiscoveryProjectionService projectionService;

    public SearchComparisonService(
            DiscoveryIndex solr,
            OpenSearchProjectionClient openSearch,
            OpenSearchC21OptimizedClient c21OpenSearch,
            DiscoveryProjectionService projectionService) {
        this.solr = solr;
        this.openSearch = openSearch;
        this.c21OpenSearch = c21OpenSearch;
        this.projectionService = projectionService;
    }

    public List<SearchComparisonScenario> scenarios() {
        return List.of(
                new SearchComparisonScenario(
                        SearchComparisonScenarioId.FACETED_SEARCH,
                        "Facets vs aggregations",
                        "Compare Solr field facets with OpenSearch terms aggregations over the same research objects."),
                new SearchComparisonScenario(
                        SearchComparisonScenarioId.FULL_TEXT_RELEVANCE,
                        "Full-text relevance",
                        "Compare weighted title, geography, subject, author, summary, citation and publisher matching."),
                new SearchComparisonScenario(
                        SearchComparisonScenarioId.FILTERING,
                        "Filtering",
                        "Compare exact identifiers plus publisher, source, program, geography, research-object type and vintage filters while preserving self-excluding facets."));
    }

    public SearchComparisonResponse run(SearchComparisonRequest request) {
        return run(
                request,
                SearchComparisonExecutionOrder.SOLR_FIRST,
                OpenSearchComparisonTreatment.BASELINE_SCOPED_FILTERS);
    }

    public SearchComparisonResponse run(SearchComparisonRequest request, SearchComparisonExecutionOrder executionOrder) {
        return run(request, executionOrder, OpenSearchComparisonTreatment.BASELINE_SCOPED_FILTERS);
    }

    public SearchComparisonResponse run(
            SearchComparisonRequest request,
            SearchComparisonExecutionOrder executionOrder,
            OpenSearchComparisonTreatment openSearchTreatment) {
        SearchComparisonScenarioId scenario = Objects.requireNonNull(request.getScenario(), "scenario is required");
        SearchComparisonExecutionOrder order = Objects.requireNonNull(executionOrder, "executionOrder is required");
        OpenSearchComparisonTreatment treatment =
                Objects.requireNonNull(openSearchTreatment, "openSearchTreatment is required");
        SearchComparisonCriteria criteria = new SearchComparisonCriteria(
                request.getQuery(),
                request.getPrograms(),
                request.getPublisher(),
                request.getSourceSystem(),
                request.getLocalId(),
                request.getDoi(),
                request.getGeography(),
                request.getContentType(),
                request.getVintageYear(),
                request.getPage() == null ? 0 : request.getPage(),
                request.getPageSize() == null ? DEFAULT_PAGE_SIZE : request.getPageSize());

        SearchEngineComparison solrResult;
        SearchEngineComparison openSearchResult;
        if (order == SearchComparisonExecutionOrder.OPENSEARCH_FIRST) {
            openSearchResult = runOpenSearch(criteria, treatment);
            solrResult = runSolr(criteria);
        } else {
            solrResult = runSolr(criteria);
            openSearchResult = runOpenSearch(criteria, treatment);
        }

        ProjectionState projection = projectionService.state();
        SearchComparisonProjection projectionDto =
                new SearchComparisonProjection(projection.source(), projection.objectCount());
        if (projectionService.currentProjectionId() != null) {
            projectionDto.projectionId(projectionService.currentProjectionId());
        }
        if (projection.rebuiltAt() != null) {
            projectionDto.rebuiltAt(projection.rebuiltAt());
        }

        return new SearchComparisonResponse(
                scenario,
                projectionDto,
                sameProjection(projection),
                solrResult,
                openSearchResult);
    }

    private SearchEngineComparison runSolr(SearchComparisonCriteria criteria) {
        boolean enabled = solr.isEnabled();
        Optional<Integer> indexedCount = enabled ? solr.documentCount() : Optional.empty();
        boolean reachable = enabled && indexedCount.isPresent();
        if (!enabled || !reachable) {
            return unavailable(
                    SearchComparisonEngine.SOLR,
                    enabled,
                    reachable,
                    solr.indexName(),
                    indexedCount,
                    enabled ? "Solr discovery core is not reachable." : "Solr discovery is disabled.");
        }

        long started = System.nanoTime();
        try {
            SearchExecution execution = solr.searchWithDiagnostics(criteria);
            long elapsedMs = elapsedMillis(started);
            return completed(
                    SearchComparisonEngine.SOLR,
                    solr.indexName(),
                    indexedCount,
                    elapsedMs,
                    execution.response(),
                    execution.engineReportedMs(),
                    targetWarning(solr.indexName()));
        } catch (RuntimeException exception) {
            return unavailable(
                    SearchComparisonEngine.SOLR,
                    true,
                    true,
                    solr.indexName(),
                    indexedCount,
                    exception.getMessage(),
                    elapsedMillis(started));
        }
    }

    private SearchEngineComparison runOpenSearch(
            SearchComparisonCriteria criteria, OpenSearchComparisonTreatment treatment) {
        boolean enabled = openSearch.isEnabled();
        Optional<Integer> indexedCount = enabled ? openSearch.documentCount() : Optional.empty();
        boolean reachable = enabled && indexedCount.isPresent();
        if (!enabled || !reachable) {
            return unavailable(
                    SearchComparisonEngine.OPENSEARCH,
                    enabled,
                    reachable,
                    openSearch.indexName(),
                    indexedCount,
                    enabled ? "OpenSearch is not reachable." : "OpenSearch comparison is disabled.");
        }

        long started = System.nanoTime();
        try {
            SearchExecution execution = treatment == OpenSearchComparisonTreatment.C2_1_OPTIMIZED_EQUIVALENT
                    ? c21OpenSearch.searchWithDiagnostics(criteria)
                    : openSearch.searchWithDiagnostics(criteria);
            long elapsedMs = elapsedMillis(started);
            return completed(
                    SearchComparisonEngine.OPENSEARCH,
                    openSearch.indexName(),
                    indexedCount,
                    elapsedMs,
                    execution.response(),
                    execution.engineReportedMs(),
                    targetWarning(openSearch.indexName()));
        } catch (RuntimeException exception) {
            return unavailable(
                    SearchComparisonEngine.OPENSEARCH,
                    true,
                    true,
                    openSearch.indexName(),
                    indexedCount,
                    exception.getMessage(),
                    elapsedMillis(started));
        }
    }

    private SearchEngineComparison completed(
            SearchComparisonEngine engine,
            String indexName,
            Optional<Integer> indexedCount,
            long elapsedMs,
            SearchResponse response,
            Long engineReportedMs,
            String warning) {
        List<SearchResult> results = response.getResults() == null ? List.of() : response.getResults();
        List<FacetGroup> facets = response.getFacets() == null ? List.of() : response.getFacets();
        SearchEngineComparison comparison = new SearchEngineComparison(
                        engine,
                        true,
                        true,
                        indexName,
                        elapsedMs,
                        results.size(),
                        results,
                        facets)
                .totalHits(response.getTotalResults());
        indexedCount.ifPresent(comparison::indexedDocumentCount);
        if (engineReportedMs != null) {
            comparison.engineReportedMs(engineReportedMs);
        }
        if (warning != null && !warning.isBlank()) {
            comparison.warning(warning);
        }
        return comparison;
    }

    private SearchEngineComparison unavailable(
            SearchComparisonEngine engine,
            boolean enabled,
            boolean reachable,
            String indexName,
            Optional<Integer> indexedCount,
            String warning) {
        return unavailable(engine, enabled, reachable, indexName, indexedCount, warning, 0L);
    }

    private SearchEngineComparison unavailable(
            SearchComparisonEngine engine,
            boolean enabled,
            boolean reachable,
            String indexName,
            Optional<Integer> indexedCount,
            String warning,
            long elapsedMs) {
        SearchEngineComparison comparison = new SearchEngineComparison(
                engine, enabled, reachable, indexName, elapsedMs, 0, List.of(), List.of());
        indexedCount.ifPresent(comparison::indexedDocumentCount);
        if (warning != null && !warning.isBlank()) {
            comparison.warning(warning);
        }
        return comparison;
    }

    private boolean sameProjection(ProjectionState projection) {
        String currentProjectionId = projectionService.currentProjectionId();
        if (currentProjectionId == null) {
            return false;
        }

        ProjectionTargetState solrState = projectionService.targetState(solr.indexName());
        ProjectionTargetState openSearchState = projectionService.targetState(openSearch.indexName());
        return targetHasCurrentProjection(solrState, currentProjectionId, projection.objectCount())
                && targetHasCurrentProjection(openSearchState, currentProjectionId, projection.objectCount());
    }

    private boolean targetHasCurrentProjection(
            ProjectionTargetState state, String currentProjectionId, int expectedCount) {
        return state != null
                && state.enabled()
                && state.projected()
                && currentProjectionId.equals(state.projectionId())
                && state.documentCount() != null
                && state.documentCount() == expectedCount;
    }

    private String targetWarning(String indexName) {
        ProjectionTargetState targetState = projectionService.targetState(indexName);
        if (targetState == null) {
            return "No projection outcome has been recorded for this engine in the current API process.";
        }
        return targetState.warning();
    }

    private long elapsedMillis(long started) {
        return Math.max(0L, TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started));
    }
}
