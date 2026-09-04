package org.civicsrepo.search;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.civicsrepo.generated.dto.AccessLevel;
import org.civicsrepo.generated.dto.FacetGroup;
import org.civicsrepo.generated.dto.FacetValue;
import org.civicsrepo.generated.dto.RepositorySource;
import org.civicsrepo.generated.dto.ResearchObjectOrigin;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SearchResponse;
import org.civicsrepo.generated.dto.SearchResult;
import org.civicsrepo.generated.dto.SourceSystem;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * C2.1-only OpenSearch adapter that removes redundant unfiltered aggregation wrappers and groups
 * facets with identical filter scopes. The ordinary {@link OpenSearchProjectionClient} remains the
 * baseline implementation used by the application and certified C2 history.
 */
@Component
public class OpenSearchC21OptimizedClient {
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(10);

    private static final List<FacetSpec> FACETS = List.of(
            new FacetSpec("program", "program", "Program", "programName", "programName", 100, false),
            new FacetSpec("publisher", "publisher", "Publisher", "publisher.keyword", "publisher", 100, false),
            new FacetSpec("sourceSystem", "sourceSystem", "Source", "sourceSystem", "sourceSystem", 25, false),
            new FacetSpec("geography", "geography", "Geography", "geography.keyword", "geography", 100, false),
            new FacetSpec("contentType", "type", "Type", "contentType", "contentType", 25, false),
            new FacetSpec("vintageYear", "vintageYear", "Year", "vintageYear", "vintageYear", 50, true));

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String baseUrl;
    private final String index;

    public OpenSearchC21OptimizedClient(
            @Value("${civics.opensearch.base-url:}") String baseUrl,
            @Value("${civics.opensearch.index:discovery-comparison}") String index) {
        this.objectMapper = new ObjectMapper();
        this.httpClient = HttpClient.newBuilder().connectTimeout(REQUEST_TIMEOUT).build();
        this.baseUrl = stripTrailingSlash(baseUrl);
        this.index = validateIndex(index);
    }

    public SearchExecution searchWithDiagnostics(SearchComparisonCriteria criteria) {
        if (baseUrl.isBlank() || index.isBlank()) {
            throw new IllegalStateException("C2.1 OpenSearch comparison is disabled.");
        }

        AggregationPlan aggregationPlan = aggregationPlan(criteria);
        Map<String, Object> requestBody = searchRequest(criteria, aggregationPlan);
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(baseUrl + "/" + index + "/_search"))
                    .timeout(REQUEST_TIMEOUT)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(requestBody)))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 300) {
                throw new IllegalStateException(
                        "C2.1 optimized OpenSearch search failed with HTTP " + response.statusCode());
            }

            String responseBody = response.body();
            return new SearchExecution(
                    toSearchResponse(criteria, responseBody, aggregationPlan),
                    engineReportedMillis(responseBody));
        } catch (IOException exception) {
            throw new IllegalStateException("C2.1 optimized OpenSearch search request failed.", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("C2.1 optimized OpenSearch search request was interrupted.", exception);
        }
    }

    Map<String, Object> requestForTest(SearchComparisonCriteria criteria) {
        AggregationPlan plan = aggregationPlan(criteria);
        return searchRequest(criteria, plan);
    }

    private Map<String, Object> searchRequest(SearchComparisonCriteria criteria, AggregationPlan aggregationPlan) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("from", criteria.page() * criteria.pageSize());
        body.put("size", criteria.pageSize());
        body.put("track_total_hits", true);
        body.put("query", queryClause(criteria.query()));

        List<Map<String, Object>> allFilters = filterClauses(criteria, null);
        if (!allFilters.isEmpty()) {
            body.put("post_filter", Map.of("bool", Map.of("filter", allFilters)));
        }
        body.put("aggs", aggregationPlan.aggregations());
        return body;
    }

    private AggregationPlan aggregationPlan(SearchComparisonCriteria criteria) {
        List<FilterScopeGroup> groups = new ArrayList<>();
        for (FacetSpec facet : FACETS) {
            List<Map<String, Object>> filters = filterClauses(criteria, facet.excludedField());
            FilterScopeGroup group = groups.stream()
                    .filter((candidate) -> candidate.filters.equals(filters))
                    .findFirst()
                    .orElseGet(() -> {
                        FilterScopeGroup created = new FilterScopeGroup(filters);
                        groups.add(created);
                        return created;
                    });
            group.facets.add(facet);
        }

        Map<String, Object> aggregations = new LinkedHashMap<>();
        Map<String, String> sharedScopeByFacet = new LinkedHashMap<>();
        int sharedScopeIndex = 0;
        for (FilterScopeGroup group : groups) {
            if (group.filters.isEmpty()) {
                for (FacetSpec facet : group.facets) {
                    aggregations.put(facet.scopeName(), termsAggregation(facet));
                }
                continue;
            }

            sharedScopeIndex += 1;
            String sharedScope = "c2_1_shared_scope_" + String.format("%02d", sharedScopeIndex);
            Map<String, Object> nested = new LinkedHashMap<>();
            for (FacetSpec facet : group.facets) {
                nested.put(facet.scopeName(), termsAggregation(facet));
                sharedScopeByFacet.put(facet.aggregationName(), sharedScope);
            }
            aggregations.put(
                    sharedScope,
                    Map.of(
                            "filter", Map.of("bool", Map.of("filter", group.filters)),
                            "aggs", nested));
        }

        return new AggregationPlan(aggregations, sharedScopeByFacet);
    }

    private Map<String, Object> termsAggregation(FacetSpec facet) {
        Map<String, Object> terms = new LinkedHashMap<>();
        terms.put("field", facet.indexField());
        terms.put("size", facet.size());
        if (facet.sortDescending()) {
            terms.put("order", Map.of("_key", "desc"));
        }
        return Map.of("terms", terms);
    }

    private Map<String, Object> queryClause(String query) {
        if (normalize(query).isBlank()) {
            return Map.of("match_all", Map.of());
        }

        Map<String, Object> weightedTerms = Map.of(
                "multi_match",
                Map.of(
                        "query", query,
                        "fields",
                                List.of(
                                        "title^5",
                                        "geography^4",
                                        "subjects^3",
                                        "programName^3",
                                        "authors^3",
                                        "summary^2",
                                        "citation^1",
                                        "publisher^0.5"),
                        "minimum_should_match", "2<67%"));

        List<Map<String, Object>> phraseBoosts = List.of(
                Map.of("match_phrase", Map.of("title", Map.of("query", query, "boost", 8))),
                Map.of("match_phrase", Map.of("geography", Map.of("query", query, "boost", 6))),
                Map.of("match_phrase", Map.of("summary", Map.of("query", query, "boost", 2))));

        return Map.of("bool", Map.of("must", List.of(weightedTerms), "should", phraseBoosts));
    }

    private List<Map<String, Object>> filterClauses(SearchComparisonCriteria criteria, String excludedField) {
        List<Map<String, Object>> filters = new ArrayList<>();
        if (!"programName".equals(excludedField) && !criteria.programs().isEmpty()) {
            filters.add(Map.of("terms", Map.of("programName", criteria.programs())));
        }
        if (!"publisher".equals(excludedField) && criteria.publisher() != null) {
            filters.add(Map.of("term", Map.of("publisher.keyword", criteria.publisher())));
        }
        if (!"sourceSystem".equals(excludedField) && criteria.sourceSystem() != null) {
            filters.add(Map.of("term", Map.of("sourceSystem", criteria.sourceSystem().getValue())));
        }
        if (criteria.localId() != null) {
            filters.add(Map.of("term", Map.of("id", criteria.localId())));
        }
        if (criteria.doi() != null) {
            filters.add(Map.of("term", Map.of("doi", criteria.doi())));
        }
        if (!"geography".equals(excludedField) && criteria.geography() != null) {
            filters.add(Map.of("term", Map.of("geography.keyword", criteria.geography())));
        }
        if (!"contentType".equals(excludedField) && criteria.contentType() != null) {
            filters.add(Map.of("term", Map.of("contentType", criteria.contentType().getValue())));
        }
        if (!"vintageYear".equals(excludedField) && criteria.vintageYear() != null) {
            filters.add(Map.of("term", Map.of("vintageYear", criteria.vintageYear())));
        }
        return List.copyOf(filters);
    }

    private SearchResponse toSearchResponse(
            SearchComparisonCriteria criteria,
            String responseBody,
            AggregationPlan aggregationPlan)
            throws IOException {
        JsonNode root = objectMapper.readTree(responseBody);
        List<SearchResult> results = new ArrayList<>();
        for (JsonNode hit : root.path("hits").path("hits")) {
            JsonNode document = hit.path("_source");
            results.add(new SearchResult(
                            document.path("id").asText(),
                            document.path("title").asText(),
                            ResearchObjectType.fromValue(document.path("contentType").asText()),
                            ResearchProgram.fromValue(document.path("program").asText()),
                            document.path("publisher").asText(),
                            document.path("summary").asText(),
                            URI.create(document.path("sourceUrl").asText()),
                            ResearchObjectOrigin.fromValue(document.path("origin").asText()),
                            SourceSystem.fromValue(document.path("sourceSystem").asText()))
                    .programName(document.path("programName").asText())
                    .geography(textOrNull(document, "geography"))
                    .vintageYear(integerOrNull(document, "vintageYear"))
                    .accessLevel(accessLevel(document)));
        }

        int totalResults = Math.toIntExact(root.path("hits").path("total").path("value").asLong(0));
        Set<String> programs = criteria.programs().stream().map(this::normalize).collect(Collectors.toSet());
        JsonNode aggregations = root.path("aggregations");

        return new SearchResponse(
                RepositorySource.FIXTURE,
                criteria.query(),
                criteria.page(),
                criteria.pageSize(),
                totalResults,
                results,
                List.of(
                        facetGroup(
                                "program",
                                "Program",
                                facetBuckets(aggregations, aggregationPlan, "program"),
                                programs),
                        facetGroup(
                                "publisher",
                                "Publisher",
                                facetBuckets(aggregations, aggregationPlan, "publisher"),
                                criteria.publisher() == null
                                        ? Set.of()
                                        : Set.of(normalize(criteria.publisher()))),
                        facetGroup(
                                "sourceSystem",
                                "Source",
                                facetBuckets(aggregations, aggregationPlan, "sourceSystem"),
                                criteria.sourceSystem() == null
                                        ? Set.of()
                                        : Set.of(normalize(criteria.sourceSystem().getValue()))),
                        facetGroup(
                                "geography",
                                "Geography",
                                facetBuckets(aggregations, aggregationPlan, "geography"),
                                criteria.geography() == null
                                        ? Set.of()
                                        : Set.of(normalize(criteria.geography()))),
                        facetGroup(
                                "type",
                                "Type",
                                facetBuckets(aggregations, aggregationPlan, "contentType"),
                                criteria.contentType() == null
                                        ? Set.of()
                                        : Set.of(normalize(criteria.contentType().getValue()))),
                        facetGroup(
                                "vintageYear",
                                "Year",
                                facetBuckets(aggregations, aggregationPlan, "vintageYear"),
                                criteria.vintageYear() == null
                                        ? Set.of()
                                        : Set.of(normalize(String.valueOf(criteria.vintageYear()))))));
    }

    private JsonNode facetBuckets(JsonNode aggregations, AggregationPlan plan, String aggregationName) {
        String sharedScope = plan.sharedScopeByFacet().get(aggregationName);
        JsonNode facet = sharedScope == null
                ? aggregations.path(aggregationName + "_scope")
                : aggregations.path(sharedScope).path(aggregationName + "_scope");
        return facet.path("buckets");
    }

    private FacetGroup facetGroup(String field, String label, JsonNode buckets, Set<String> selected) {
        List<FacetValue> values = new ArrayList<>();
        for (JsonNode bucket : buckets) {
            String value = bucket.path("key_as_string").asText(bucket.path("key").asText());
            values.add(new FacetValue(
                    value,
                    value.replace('_', ' '),
                    bucket.path("doc_count").asInt(0),
                    selected.contains(normalize(value))));
        }
        return new FacetGroup(field, label, values);
    }

    private Long engineReportedMillis(String responseBody) throws IOException {
        JsonNode took = objectMapper.readTree(responseBody).path("took");
        return took.isNumber() ? Math.max(0L, took.asLong()) : null;
    }

    private AccessLevel accessLevel(JsonNode document) {
        String value = document.path("accessLevel").asText();
        if (value.isBlank()) {
            return AccessLevel.PUBLIC;
        }
        try {
            return AccessLevel.fromValue(value);
        } catch (IllegalArgumentException exception) {
            return AccessLevel.RESTRICTED;
        }
    }

    private String textOrNull(JsonNode document, String field) {
        JsonNode value = document.path(field);
        return value.isMissingNode() || value.isNull() || value.asText().isBlank() ? null : value.asText();
    }

    private Integer integerOrNull(JsonNode document, String field) {
        JsonNode value = document.path(field);
        return value.isMissingNode() || value.isNull() ? null : value.asInt();
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase();
    }

    private String stripTrailingSlash(String value) {
        if (value == null) {
            return "";
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private String validateIndex(String value) {
        String candidate = value == null ? "" : value.trim();
        if (!candidate.isEmpty() && !candidate.matches("[a-z0-9][a-z0-9._-]*")) {
            throw new IllegalArgumentException("OpenSearch index name contains unsupported characters: " + candidate);
        }
        return candidate;
    }

    private record FacetSpec(
            String aggregationName,
            String responseField,
            String label,
            String indexField,
            String excludedField,
            int size,
            boolean sortDescending) {
        String scopeName() {
            return aggregationName + "_scope";
        }
    }

    private static final class FilterScopeGroup {
        private final List<Map<String, Object>> filters;
        private final List<FacetSpec> facets = new ArrayList<>();

        private FilterScopeGroup(List<Map<String, Object>> filters) {
            this.filters = filters;
        }
    }

    private record AggregationPlan(
            Map<String, Object> aggregations,
            Map<String, String> sharedScopeByFacet) {}
}
