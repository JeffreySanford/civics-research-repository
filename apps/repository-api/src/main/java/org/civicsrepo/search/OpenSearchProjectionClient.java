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
import java.util.UUID;
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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Rebuildable OpenSearch copy of the public discovery projection. */
@Component
public class OpenSearchProjectionClient implements DiscoveryProjectionTarget {
    private static final Logger LOGGER = LoggerFactory.getLogger(OpenSearchProjectionClient.class);
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(10);

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String baseUrl;
    /** Stable read alias. The physical index changes only after a staged projection is complete. */
    private final String index;
    private String stagingIndex;

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
            HttpResponse<String> response = send(HttpRequest.newBuilder(indexUri(index, "/_count"))
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
        if (stagingIndex != null) {
            throw new IllegalStateException("OpenSearch projection is already in progress.");
        }

        String candidate = projectionIndexName();
        try {
            createIndex(candidate);
            stagingIndex = candidate;
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
        String projectionIndex = requireStagingIndex();
        try {
            bulkIndex(projectionIndex, objects);
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
        String projectionIndex = requireStagingIndex();
        try {
            refreshIndex(projectionIndex);
            List<String> previousIndices = activateProjectionIndex(projectionIndex);
            stagingIndex = null;
            cleanupPreviousProjectionIndices(previousIndices, projectionIndex);
        } catch (IOException exception) {
            throw new IllegalStateException("OpenSearch projection activation failed.", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("OpenSearch projection activation was interrupted.", exception);
        }
    }

    @Override
    public void abortProjection() {
        if (!isEnabled() || stagingIndex == null) {
            return;
        }
        String partialIndex = stagingIndex;
        stagingIndex = null;
        try {
            deleteIndexIfPresent(partialIndex);
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
        return searchWithDiagnostics(new SearchComparisonCriteria(
                query,
                programs,
                null,
                null,
                null,
                null,
                geography,
                contentType,
                vintageYear,
                page,
                pageSize));
    }

    public SearchExecution searchWithDiagnostics(SearchComparisonCriteria criteria) {
        if (!isEnabled()) {
            throw new IllegalStateException("OpenSearch comparison is disabled.");
        }

        Map<String, Object> requestBody = searchRequest(criteria);

        try {
            HttpRequest request = HttpRequest.newBuilder(indexUri(index, "/_search"))
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
                            criteria,
                            responseBody),
                    engineReportedMillis(responseBody));
        } catch (IOException exception) {
            throw new IllegalStateException("OpenSearch search request failed.", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("OpenSearch search request was interrupted.", exception);
        }
    }

    private Map<String, Object> searchRequest(SearchComparisonCriteria criteria) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("from", criteria.page() * criteria.pageSize());
        body.put("size", criteria.pageSize());
        body.put("track_total_hits", true);
        body.put("query", queryClause(criteria.query()));

        List<Map<String, Object>> allFilters = filterClauses(criteria, null);
        if (!allFilters.isEmpty()) {
            body.put("post_filter", Map.of("bool", Map.of("filter", allFilters)));
        }

        Map<String, Object> aggregations = new LinkedHashMap<>();
        aggregations.put(
                "program_scope",
                scopedTermsAggregation(
                        "programName",
                        filterClauses(criteria, "programName"),
                        100));
        aggregations.put(
                "publisher_scope",
                scopedTermsAggregation(
                        "publisher",
                        filterClauses(criteria, "publisher"),
                        100));
        aggregations.put(
                "sourceSystem_scope",
                scopedTermsAggregation(
                        "sourceSystem",
                        filterClauses(criteria, "sourceSystem"),
                        25));
        aggregations.put(
                "geography_scope",
                scopedTermsAggregation(
                        "geography",
                        filterClauses(criteria, "geography"),
                        100));
        aggregations.put(
                "contentType_scope",
                scopedTermsAggregation(
                        "contentType",
                        filterClauses(criteria, "contentType"),
                        25));
        aggregations.put(
                "vintageYear_scope",
                scopedTermsAggregation(
                        "vintageYear",
                        filterClauses(criteria, "vintageYear"),
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
            SearchComparisonCriteria criteria, String excludedField) {
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

        return filters;
    }

    private Map<String, Object> scopedTermsAggregation(
            String field, List<Map<String, Object>> filters, int size) {
        Map<String, Object> scope = filters.isEmpty()
                ? Map.of("match_all", Map.of())
                : Map.of("bool", Map.of("filter", filters));
        Map<String, Object> terms = new LinkedHashMap<>();
        String aggregationField = switch (field) {
            case "geography", "publisher" -> field + ".keyword";
            default -> field;
        };
        terms.put("field", aggregationField);
        terms.put("size", size);
        if ("vintageYear".equals(field)) {
            terms.put("order", Map.of("_key", "desc"));
        }
        return Map.of(
                "filter", scope,
                "aggs", Map.of("values", Map.of("terms", terms)));
    }

    private SearchResponse toSearchResponse(
            SearchComparisonCriteria criteria,
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
        Set<String> programs = criteria.programs().stream().map(this::normalize).collect(Collectors.toSet());

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
                                root.path("aggregations").path("program_scope").path("values").path("buckets"),
                                programs),
                        facetGroup(
                                "publisher",
                                "Publisher",
                                root.path("aggregations").path("publisher_scope").path("values").path("buckets"),
                                criteria.publisher() == null
                                        ? Set.of()
                                        : Set.of(normalize(criteria.publisher()))),
                        facetGroup(
                                "sourceSystem",
                                "Source",
                                root.path("aggregations")
                                        .path("sourceSystem_scope")
                                        .path("values")
                                        .path("buckets"),
                                criteria.sourceSystem() == null
                                        ? Set.of()
                                        : Set.of(normalize(criteria.sourceSystem().getValue()))),
                        facetGroup(
                                "geography",
                                "Geography",
                                root.path("aggregations").path("geography_scope").path("values").path("buckets"),
                                criteria.geography() == null
                                        ? Set.of()
                                        : Set.of(normalize(criteria.geography()))),
                        facetGroup(
                                "type",
                                "Type",
                                root.path("aggregations")
                                        .path("contentType_scope")
                                        .path("values")
                                        .path("buckets"),
                                criteria.contentType() == null
                                        ? Set.of()
                                        : Set.of(normalize(criteria.contentType().getValue()))),
                        facetGroup(
                                "vintageYear",
                                "Year",
                                root.path("aggregations").path("vintageYear_scope").path("values").path("buckets"),
                                criteria.vintageYear() == null
                                        ? Set.of()
                                        : Set.of(normalize(String.valueOf(criteria.vintageYear()))))));
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

    private String requireStagingIndex() {
        if (stagingIndex == null || stagingIndex.isBlank()) {
            throw new IllegalStateException("OpenSearch projection has not been started.");
        }
        return stagingIndex;
    }

    private String projectionIndexName() {
        return validateIndex(index + "-projection-" + UUID.randomUUID().toString().replace("-", ""));
    }

    private void deleteIndexIfPresent(String indexName) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(indexUri(indexName, ""))
                .timeout(REQUEST_TIMEOUT)
                .DELETE()
                .build();
        HttpResponse<String> response = send(request);
        if (response.statusCode() != 404 && response.statusCode() >= 300) {
            throw new IllegalStateException("OpenSearch index deletion failed with HTTP " + response.statusCode());
        }
    }

    private void createIndex(String indexName) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(indexUri(indexName, ""))
                .timeout(REQUEST_TIMEOUT)
                .header("Content-Type", "application/json")
                .PUT(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(indexDefinition())))
                .build();
        HttpResponse<String> response = send(request);
        if (response.statusCode() >= 300) {
            throw new IllegalStateException("OpenSearch index creation failed with HTTP " + response.statusCode());
        }
    }

    private void refreshIndex(String indexName) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(indexUri(indexName, "/_refresh"))
                .timeout(REQUEST_TIMEOUT)
                .POST(HttpRequest.BodyPublishers.noBody())
                .build();
        HttpResponse<String> response = send(request);
        if (response.statusCode() >= 300) {
            throw new IllegalStateException("OpenSearch index refresh failed with HTTP " + response.statusCode());
        }
    }

    private List<String> activateProjectionIndex(String projectionIndex) throws IOException, InterruptedException {
        List<String> previousIndices = aliasTargets();
        List<Map<String, Object>> actions = new ArrayList<>();
        if (!previousIndices.isEmpty()) {
            for (String previous : previousIndices) {
                actions.add(Map.of("remove", Map.of("index", previous, "alias", index)));
            }
        } else if (resourceExists(index)) {
            // First migration from the legacy concrete index to a stable alias. remove_index + add
            // happen in one aliases request so readers never observe a half-built replacement.
            actions.add(Map.of("remove_index", Map.of("index", index)));
        }
        actions.add(Map.of("add", Map.of("index", projectionIndex, "alias", index)));

        HttpRequest request = HttpRequest.newBuilder(URI.create(baseUrl + "/_aliases"))
                .timeout(REQUEST_TIMEOUT)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(
                        objectMapper.writeValueAsString(Map.of("actions", actions))))
                .build();
        HttpResponse<String> response = send(request);
        if (response.statusCode() >= 300) {
            throw new IllegalStateException("OpenSearch alias activation failed with HTTP " + response.statusCode());
        }
        return previousIndices;
    }

    private List<String> aliasTargets() throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(URI.create(baseUrl + "/_alias/" + index))
                .timeout(REQUEST_TIMEOUT)
                .GET()
                .build();
        HttpResponse<String> response = send(request);
        if (response.statusCode() == 404) {
            return List.of();
        }
        if (response.statusCode() >= 300) {
            throw new IllegalStateException("OpenSearch alias lookup failed with HTTP " + response.statusCode());
        }
        JsonNode root = objectMapper.readTree(response.body());
        List<String> targets = new ArrayList<>();
        root.fieldNames().forEachRemaining(targets::add);
        return List.copyOf(targets);
    }

    private boolean resourceExists(String name) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(indexUri(name, ""))
                .timeout(REQUEST_TIMEOUT)
                .method("HEAD", HttpRequest.BodyPublishers.noBody())
                .build();
        HttpResponse<String> response = send(request);
        if (response.statusCode() == 404) {
            return false;
        }
        if (response.statusCode() >= 300) {
            throw new IllegalStateException("OpenSearch resource lookup failed with HTTP " + response.statusCode());
        }
        return true;
    }

    private void cleanupPreviousProjectionIndices(List<String> previousIndices, String activeIndex) {
        for (String previous : previousIndices) {
            if (previous.equals(activeIndex)) {
                continue;
            }
            try {
                deleteIndexIfPresent(previous);
            } catch (IOException exception) {
                LOGGER.warn("Unable to remove old OpenSearch projection index {}: {}", previous, exception.getMessage());
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                LOGGER.warn("Interrupted while removing old OpenSearch projection index {}", previous);
                return;
            } catch (RuntimeException exception) {
                LOGGER.warn("Unable to remove old OpenSearch projection index {}: {}", previous, exception.getMessage());
            }
        }
    }

    private void bulkIndex(String indexName, List<DiscoveryDocument> objects) throws IOException, InterruptedException {
        StringBuilder payload = new StringBuilder();
        for (DiscoveryDocument object : objects) {
            payload.append(objectMapper.writeValueAsString(Map.of("index", Map.of("_id", object.result().getId()))))
                    .append('\n');
            payload.append(objectMapper.writeValueAsString(toOpenSearchDocument(object))).append('\n');
        }

        HttpRequest request = HttpRequest.newBuilder(indexUri(indexName, "/_bulk?refresh=false"))
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

    private URI indexUri(String indexName, String suffix) {
        return URI.create(baseUrl + "/" + indexName + suffix);
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
