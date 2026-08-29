package org.civicsrepo.search;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import org.civicsrepo.generated.dto.FacetGroup;
import org.civicsrepo.generated.dto.RepositorySource;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.generated.dto.ResearchProgram;
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

/**
 * Runs one normalized discovery request against the application-owned Solr and OpenSearch
 * projections.
 *
 * <p>This is a comparison service, not a search-engine router. Solr remains the production-shaped
 * discovery path while OpenSearch is measured beside it. DSpace remains authoritative for both.
 */
@Service
public class SearchComparisonService {
    private static final int DEFAULT_PAGE_SIZE = 10;

    private final DiscoveryIndex solr;
    private final OpenSearchProjectionClient openSearch;
    private final DiscoveryProjectionService projectionService;

    public SearchComparisonService(
            DiscoveryIndex solr,
            OpenSearchProjectionClient openSearch,
            DiscoveryProjectionService projectionService) {
        this.solr = solr;
        this.openSearch = openSearch;
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
                        "Compare program, geography, research-object type and vintage filters while preserving self-excluding facets."));
    }

    public SearchComparisonResponse run(SearchComparisonRequest request) {
        SearchComparisonScenarioId scenario = Objects.requireNonNull(request.getScenario(), "scenario is required");
        String query = request.getQuery() == null ? "" : request.getQuery();
        List<ResearchProgram> programs = request.getPrograms() == null ? List.of() : request.getPrograms();
        String geography = request.getGeography();
        ResearchObjectType contentType = request.getContentType();
        Integer vintageYear = request.getVintageYear();
        int page = Math.max(0, request.getPage() == null ? 0 : request.getPage());
        int pageSize = Math.max(
                1,
                Math.min(
                        100,
                        request.getPageSize() == null ? DEFAULT_PAGE_SIZE : request.getPageSize()));

        SearchEngineComparison solrResult = runSolr(
                query, programs, geography, contentType, vintageYear, page, pageSize);
        SearchEngineComparison openSearchResult = runOpenSearch(
                query, programs, geography, contentType, vintageYear, page, pageSize);

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

    private SearchEngineComparison runSolr(
            String query,
            List<ResearchProgram> programs,
            String geography,
            ResearchObjectType contentType,
            Integer vintageYear,
            int page,
            int pageSize) {
        boolean enabled = solr.isEnabled();
        boolean reachable = enabled && solr.isReachable();
        if (!enabled || !reachable) {
            return unavailable(
                    SearchComparisonEngine.SOLR,
                    enabled,
                    reachable,
                    solr.indexName(),
                    solr.documentCount(),
                    enabled ? "Solr discovery core is not reachable." : "Solr discovery is disabled.");
        }

        long started = System.nanoTime();
        try {
            SearchResponse response =
                    solr.search(query, programs, geography, contentType, vintageYear, page, pageSize);
            return completed(
                    SearchComparisonEngine.SOLR,
                    solr.indexName(),
                    solr.documentCount(),
                    elapsedMillis(started),
                    response,
                    targetWarning(solr.indexName()));
        } catch (RuntimeException exception) {
            return unavailable(
                    SearchComparisonEngine.SOLR,
                    true,
                    true,
                    solr.indexName(),
                    solr.documentCount(),
                    exception.getMessage(),
                    elapsedMillis(started));
        }
    }

    private SearchEngineComparison runOpenSearch(
            String query,
            List<ResearchProgram> programs,
            String geography,
            ResearchObjectType contentType,
            Integer vintageYear,
            int page,
            int pageSize) {
        boolean enabled = openSearch.isEnabled();
        boolean reachable = enabled && openSearch.isReachable();
        if (!enabled || !reachable) {
            return unavailable(
                    SearchComparisonEngine.OPENSEARCH,
                    enabled,
                    reachable,
                    openSearch.indexName(),
                    openSearch.documentCount(),
                    enabled ? "OpenSearch is not reachable." : "OpenSearch comparison is disabled.");
        }

        long started = System.nanoTime();
        try {
            SearchResponse response = openSearch.search(
                    query, programs, geography, contentType, vintageYear, page, pageSize);
            return completed(
                    SearchComparisonEngine.OPENSEARCH,
                    openSearch.indexName(),
                    openSearch.documentCount(),
                    elapsedMillis(started),
                    response,
                    targetWarning(openSearch.indexName()));
        } catch (RuntimeException exception) {
            return unavailable(
                    SearchComparisonEngine.OPENSEARCH,
                    true,
                    true,
                    openSearch.indexName(),
                    openSearch.documentCount(),
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
