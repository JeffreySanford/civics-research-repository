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
import java.util.Optional;
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

/** Rebuildable OpenSearch copy of the public discovery projection. */
@Component
public class OpenSearchProjectionClient implements DiscoveryProjectionTarget {
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(10);

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String baseUrl;
    private final String index;

    public OpenSearchProjectionClient(
            @Value("${civics.opensearch.base-url:}") String baseUrl,
            @Value("${civics.opensearch.index:discovery-comparison}") String index) {
        this.objectMapper = new ObjectMapper();
        this.httpClient = HttpClient.newBuilder().connectTimeout(REQUEST_TIMEOUT).build();
        this.baseUrl = stripTrailingSlash(baseUrl);
        this.index = validateIndex(index);
    }

    @Override
    public boolean isEnabled() {
        return !baseUrl.isBlank() && !index.isBlank();
    }

    @Override
    public boolean isReachable() {
        if (!isEnabled()) {
            return false;
        }

        try {
            HttpResponse<String> response = send(HttpRequest.newBuilder(URI.create(baseUrl + "/_cluster/health"))
                    .timeout(REQUEST_TIMEOUT)
                    .GET()
                    .build());
            return response.statusCode() < 300;
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            return false;
        }
    }

    @Override
    public String baseUrl() {
        return baseUrl;
    }

    @Override
    public String indexName() {
        return index;
    }

    @Override
    public Optional<Integer> documentCount() {
        if (!isEnabled()) {
            return Optional.empty();
        }

        try {
            HttpResponse<String> response = send(HttpRequest.newBuilder(indexUri("/_count"))
                    .timeout(REQUEST_TIMEOUT)
                    .GET()
                    .build());
            if (response.statusCode() == 404 || response.statusCode() >= 300) {
                return Optional.empty();
            }
            JsonNode root = objectMapper.readTree(response.body());
            return Optional.of(Math.max(0, root.path("count").asInt(0)));
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            return Optional.empty();
        }
    }

    @Override
    public void beginProjection() {
        if (!isEnabled()) {
            return;
        }
        try {
            deleteIndexIfPresent();
            createIndex();
        } catch (IOException exception) {
            throw new IllegalStateException("OpenSearch projection setup failed.", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("OpenSearch projection setup was interrupted.", exception);
        }
    }

    @Override
    public void indexBatch(List<DiscoveryDocument> objects) {
        if (!isEnabled() || objects == null || objects.isEmpty()) {
            return;
        }
        try {
            bulkIndex(objects);
        } catch (IOException exception) {
            throw new IllegalStateException("OpenSearch projection batch failed.", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("OpenSearch projection batch was interrupted.", exception);
        }
    }

    @Override
    public void completeProjection() {
        if (!isEnabled()) {
            return;
        }
        try {
            refreshIndex();
        } catch (IOException exception) {
            throw new IllegalStateException("OpenSearch projection refresh failed.", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("OpenSearch projection refresh was interrupted.", exception);
        }
    }

    @Override
    public void abortProjection() {
        if (!isEnabled()) {
            return;
        }
        try {
            deleteIndexIfPresent();
        } catch (IOException exception) {
            throw new IllegalStateException("OpenSearch partial projection cleanup failed.", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("OpenSearch partial projection cleanup was interrupted.", exception);
        }
    }

    /**
     * Runs the normalized comparison query against OpenSearch. Filters are applied as a post-filter
     * so aggregations can intentionally exclude their own selected field, matching Solr's tagged
     * facet behavior.
     */
    public SearchResponse search(
            String query,
            List<String> programs,
            String geography,
            ResearchObjectType contentType,
            Integer vintageYear,
            int page,
            int pageSize) {
        return searchWithDiagnostics(query, programs, geography, contentType, vintageYear, page, pageSize).response();
    }

    public SearchExecution searchWithDiagnostics(
            String query,
            List<String> programs,
            String geography,
            ResearchObjectType contentType,
            Integer vintageYear,
            int page,
            int pageSize) {
        if (!isEnabled()) {
            throw new IllegalStateException("OpenSearch comparison is disabled.");
        }

        int safePage = Math.max(0, page);
        int safePageSize = Math.max(1, Math.min(pageSize, 100));
        Map<String, Object> requestBody = searchRequest(
                query, programs, geography, contentType, vintageYear, safePage, safePageSize);

        try {
            HttpRequest request = HttpRequest.newBuilder(indexUri("/_search"))
                    .timeout(REQUEST_TIMEOUT)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(requestBody)))
                    .build();
            HttpResponse<String> response = send(request);
            if (response.statusCode() >= 300) {
                throw new IllegalStateException("OpenSearch search failed with HTTP " + response.statusCode());
            }
            String responseBody = response.body();
            return new SearchExecution(
                    toSearchResponse(
                            query,
                            programs,
                            geography,
                            contentType,
                            vintageYear,
                            safePage,
                            safePageSize,
                            responseBody),
                    engineReportedMillis(responseBody));
        } catch (IOException exception) {
            throw new IllegalStateException("OpenSearch search request failed.", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("OpenSearch search request was interrupted.", exception);
        }
    }

    private Map<String, Object> searchRequest(
            String query,
            List<String> programs,
            String geography,
            ResearchObjectType contentType,
            Integer vintageYear,
            int page,
            int pageSize) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("from", page * pageSize);
        body.put("size", pageSize);
        body.put("track_total_hits", true);
        body.put("query", queryClause(query));

        List<Map<String, Object>> allFilters = filterClauses(programs, geography, contentType, vintageYear, null);
        if (!allFilters.isEmpty()) {
            body.put("post_filter", Map.of("bool", Map.of("filter", allFilters)));
        }

        Map<String, Object> aggregations = new LinkedHashMap<>();
        aggregations.put(
                "program_scope",
                scopedTermsAggregation(
                        "programName",
                        filterClauses(programs, geography, contentType, vintageYear, "programName"),
                        100));
        aggregations.put(
                "geography_scope",
                scopedTermsAggregation(
                        "geography",
                        filterClauses(programs, geography, contentType, vintageYear, "geography"),
                        100));
        aggregations.put(
                "contentType_scope",
                scopedTermsAggregation(
                        "contentType",
                        filterClauses(programs, geography, contentType, vintageYear, "contentType"),
                        25));
        aggregations.put(
                "vintageYear_scope",
                scopedTermsAggregation(
                        "vintageYear",
                        filterClauses(programs, geography, contentType, vintageYear, "vintageYear"),
                        50));
        body.put("aggs", aggregations);
        return body;
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

    private List<Map<String, Object>> filterClauses(
            List<String> programs,
            String geography,
            ResearchObjectType contentType,
            Integer vintageYear,
            String excludedField) {
        List<Map<String, Object>> filters = new ArrayList<>();

        if (!"programName".equals(excludedField) && programs != null && !programs.isEmpty()) {
            List<String> selectedPrograms = programs.stream()
                    .filter((program) -> program != null && !program.isBlank())
                    .map(String::trim)
                    .toList();
            if (!selectedPrograms.isEmpty()) {
                filters.add(Map.of("terms", Map.of("programName", selectedPrograms)));
            }
        }
        if (!"geography".equals(excludedField) && !normalize(geography).isBlank()) {
            filters.add(Map.of("term", Map.of("geography.keyword", geography)));
        }
        if (!"contentType".equals(excludedField) && contentType != null) {
            filters.add(Map.of("term", Map.of("contentType", contentType.getValue())));
        }
        if (!"vintageYear".equals(excludedField) && vintageYear != null) {
            filters.add(Map.of("term", Map.of("vintageYear", vintageYear)));
        }

        return filters;
    }

    private Map<String, Object> scopedTermsAggregation(
            String field, List<Map<String, Object>> filters, int size) {
        Map<String, Object> scope = filters.isEmpty()
                ? Map.of("match_all", Map.of())
                : Map.of("bool", Map.of("filter", filters));
        Map<String, Object> terms = new LinkedHashMap<>();
        terms.put("field", "geography".equals(field) ? "geography.keyword" : field);
        terms.put("size", size);
        if ("vintageYear".equals(field)) {
            terms.put("order", Map.of("_key", "desc"));
        }
        return Map.of(
                "filter", scope,
                "aggs", Map.of("values", Map.of("terms", terms)));
    }

    private SearchResponse toSearchResponse(
            String query,
            List<String> selectedPrograms,
            String selectedGeography,
            ResearchObjectType selectedContentType,
            Integer selectedVintageYear,
            int page,
            int pageSize,
            String responseBody)
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
        Set<String> programs = selectedPrograms == null
                ? Set.of()
                : selectedPrograms.stream().map(this::normalize).collect(Collectors.toSet());

        return new SearchResponse(
                RepositorySource.FIXTURE,
                query == null ? "" : query,
                page,
                pageSize,
                totalResults,
                results,
                List.of(
                        facetGroup(
                                "program",
                                "Program",
                                root.path("aggregations").path("program_scope").path("values").path("buckets"),
                                programs),
                        facetGroup(
                                "geography",
                                "Geography",
                                root.path("aggregations").path("geography_scope").path("values").path("buckets"),
                                normalize(selectedGeography).isBlank()
                                        ? Set.of()
                                        : Set.of(normalize(selectedGeography))),
                        facetGroup(
                                "type",
                                "Type",
                                root.path("aggregations")
                                        .path("contentType_scope")
                                        .path("values")
                                        .path("buckets"),
                                selectedContentType == null
                                        ? Set.of()
                                        : Set.of(normalize(selectedContentType.getValue()))),
                        facetGroup(
                                "vintageYear",
                                "Year",
                                root.path("aggregations").path("vintageYear_scope").path("values").path("buckets"),
                                selectedVintageYear == null
                                        ? Set.of()
                                        : Set.of(normalize(String.valueOf(selectedVintageYear))))));
    }

    private Long engineReportedMillis(String responseBody) throws IOException {
        JsonNode took = objectMapper.readTree(responseBody).path("took");
        return took.isNumber() ? Math.max(0L, took.asLong()) : null;
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

    private void deleteIndexIfPresent() throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(indexUri(""))
                .timeout(REQUEST_TIMEOUT)
                .DELETE()
                .build();
        HttpResponse<String> response = send(request);
        if (response.statusCode() != 404 && response.statusCode() >= 300) {
            throw new IllegalStateException("OpenSearch index deletion failed with HTTP " + response.statusCode());
        }
    }

    private void createIndex() throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(indexUri(""))
                .timeout(REQUEST_TIMEOUT)
                .header("Content-Type", "application/json")
                .PUT(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(indexDefinition())))
                .build();
        HttpResponse<String> response = send(request);
        if (response.statusCode() >= 300) {
            throw new IllegalStateException("OpenSearch index creation failed with HTTP " + response.statusCode());
        }
    }

    private void refreshIndex() throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(indexUri("/_refresh"))
                .timeout(REQUEST_TIMEOUT)
                .POST(HttpRequest.BodyPublishers.noBody())
                .build();
        HttpResponse<String> response = send(request);
        if (response.statusCode() >= 300) {
            throw new IllegalStateException("OpenSearch index refresh failed with HTTP " + response.statusCode());
        }
    }

    private void bulkIndex(List<DiscoveryDocument> objects) throws IOException, InterruptedException {
        StringBuilder payload = new StringBuilder();
        for (DiscoveryDocument object : objects) {
            payload.append(objectMapper.writeValueAsString(Map.of("index", Map.of("_id", object.result().getId()))))
                    .append('\n');
            payload.append(objectMapper.writeValueAsString(toOpenSearchDocument(object))).append('\n');
        }

        HttpRequest request = HttpRequest.newBuilder(indexUri("/_bulk?refresh=false"))
                .timeout(REQUEST_TIMEOUT)
                .header("Content-Type", "application/x-ndjson")
                .POST(HttpRequest.BodyPublishers.ofString(payload.toString()))
                .build();
        HttpResponse<String> response = send(request);
        if (response.statusCode() >= 300) {
            throw new IllegalStateException("OpenSearch bulk index failed with HTTP " + response.statusCode());
        }

        JsonNode root = objectMapper.readTree(response.body());
        if (root.path("errors").asBoolean(false)) {
            throw new IllegalStateException("OpenSearch bulk index reported item failures.");
        }
    }

    Map<String, Object> toOpenSearchDocument(DiscoveryDocument object) {
        SearchResult result = object.result();
        Map<String, Object> document = new LinkedHashMap<>();
        document.put("id", result.getId());
        document.put("title", result.getTitle());
        document.put("contentType", result.getContentType().getValue());
        document.put("program", result.getProgram().getValue());
        document.put("programName", object.programName());
        document.put("publisher", result.getPublisher());
        document.put("summary", result.getSummary());
        putIfPresent(document, "geography", result.getGeography());
        if (result.getVintageYear() != null) {
            document.put("vintageYear", result.getVintageYear());
        }
        document.put(
                "accessLevel",
                (result.getAccessLevel() == null ? AccessLevel.PUBLIC : result.getAccessLevel()).getValue());
        document.put("sourceUrl", result.getSourceUrl().toString());
        document.put("origin", result.getOrigin().getValue());
        document.put("sourceSystem", result.getSourceSystem().getValue());
        if (!object.subjects().isEmpty()) {
            document.put("subjects", object.subjects());
        }
        if (!object.authors().isEmpty()) {
            document.put("authors", object.authors());
        }
        putIfPresent(document, "citation", object.citation());
        putIfPresent(document, "doi", object.doi());
        return document;
    }

    private Map<String, Object> indexDefinition() {
        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("id", keyword());
        properties.put("title", textWithKeyword());
        properties.put("contentType", keyword());
        properties.put("program", keyword());
        properties.put("programName", keyword());
        properties.put("publisher", textWithKeyword());
        properties.put("summary", Map.of("type", "text"));
        properties.put("geography", textWithKeyword());
        properties.put("vintageYear", Map.of("type", "integer"));
        properties.put("accessLevel", keyword());
        properties.put("sourceUrl", keyword());
        properties.put("origin", keyword());
        properties.put("sourceSystem", keyword());
        properties.put("subjects", Map.of("type", "text"));
        properties.put("authors", Map.of("type", "text"));
        properties.put("citation", Map.of("type", "text"));
        properties.put("doi", keyword());

        return Map.of(
                "settings", Map.of("number_of_shards", 1, "number_of_replicas", 0),
                "mappings", Map.of("dynamic", "strict", "properties", properties));
    }

    private Map<String, Object> keyword() {
        return Map.of("type", "keyword", "ignore_above", 2048);
    }

    private Map<String, Object> textWithKeyword() {
        return Map.of(
                "type", "text",
                "fields", Map.of("keyword", Map.of("type", "keyword", "ignore_above", 512)));
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

    private void putIfPresent(Map<String, Object> document, String field, String value) {
        if (value != null && !value.isBlank()) {
            document.put(field, value);
        }
    }

    private HttpResponse<String> send(HttpRequest request) throws IOException, InterruptedException {
        return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private URI indexUri(String suffix) {
        return URI.create(baseUrl + "/" + index + suffix);
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
}
