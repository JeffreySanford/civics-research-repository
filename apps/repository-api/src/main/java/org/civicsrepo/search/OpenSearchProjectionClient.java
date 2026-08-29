package org.civicsrepo.search;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.civicsrepo.generated.dto.AccessLevel;
import org.civicsrepo.generated.dto.SearchResult;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Rebuildable OpenSearch copy of the public discovery projection.
 *
 * <p>This client deliberately implements only {@link DiscoveryProjectionTarget}. Solr remains the
 * browser-facing {@link DiscoveryIndex} while the comparison work measures equivalent query
 * behavior. Both engines receive the same normalized {@link DiscoveryDocument} list from
 * DiscoveryProjectionService; neither becomes a source of truth.
 */
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
    public void indexResearchObjects(List<DiscoveryDocument> objects) {
        if (!isEnabled()) {
            return;
        }

        try {
            deleteIndexIfPresent();
            createIndex();
            if (!objects.isEmpty()) {
                bulkIndex(objects);
            }
        } catch (IOException exception) {
            throw new IllegalStateException("OpenSearch projection request failed.", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("OpenSearch projection request was interrupted.", exception);
        }
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

    private void bulkIndex(List<DiscoveryDocument> objects) throws IOException, InterruptedException {
        StringBuilder payload = new StringBuilder();
        for (DiscoveryDocument object : objects) {
            payload.append(objectMapper.writeValueAsString(Map.of("index", Map.of("_id", object.result().getId()))))
                    .append('\n');
            payload.append(objectMapper.writeValueAsString(toOpenSearchDocument(object))).append('\n');
        }

        HttpRequest request = HttpRequest.newBuilder(indexUri("/_bulk?refresh=true"))
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
        properties.put("publisher", textWithKeyword());
        properties.put("summary", Map.of("type", "text"));
        properties.put("geography", textWithKeyword());
        properties.put("vintageYear", Map.of("type", "integer"));
        properties.put("accessLevel", keyword());
        properties.put("sourceUrl", keyword());
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
