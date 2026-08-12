package org.civicsrepo.dspace;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class DspaceDiscoveryItemStateReader implements DspaceItemStateReader {
    private static final Logger LOGGER = LoggerFactory.getLogger(DspaceDiscoveryItemStateReader.class);
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(5);

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String baseUrl;

    public DspaceDiscoveryItemStateReader(@Value("${civics.dspace.base-url:}") String baseUrl) {
        this.objectMapper = new ObjectMapper();
        this.httpClient = HttpClient.newBuilder().connectTimeout(REQUEST_TIMEOUT).build();
        this.baseUrl = stripTrailingSlash(baseUrl);
    }

    @Override
    public Optional<DspaceItemPayload> findBySourceIdentifier(String sourceIdentifier) {
        return findFirstDiscoverableItem(sourceIdentifier);
    }

    @Override
    public Optional<DspaceItemPayload> findMatchingItem(String sourceIdentifier, DspaceItemPayload sourcePayload) {
        Optional<DspaceItemPayload> sourceMatch = findBySourceIdentifier(sourceIdentifier);
        if (sourceMatch.isPresent()) {
            return sourceMatch;
        }
        return findFirstDiscoverableItem(sourcePayload.name());
    }

    Optional<DspaceItemPayload> toFirstItemPayload(String responseBody) {
        try {
            JsonNode objects = objectMapper
                    .readTree(responseBody)
                    .path("_embedded")
                    .path("searchResult")
                    .path("_embedded")
                    .path("objects");

            for (JsonNode object : objects) {
                JsonNode item = object.path("_embedded").path("indexableObject");
                if ("item".equals(item.path("type").asText()) && !item.path("withdrawn").asBoolean(false)) {
                    return Optional.of(toItemPayload(item));
                }
            }

            return Optional.empty();
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("DSpace discovery response could not be parsed.", exception);
        }
    }

    private Optional<DspaceItemPayload> findFirstDiscoverableItem(String query) {
        if (!isEnabled() || normalize(query).isBlank()) {
            return Optional.empty();
        }

        try {
            HttpRequest request = HttpRequest.newBuilder(discoveryUri(query))
                    .timeout(REQUEST_TIMEOUT)
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 300) {
                LOGGER.warn("DSpace discovery returned HTTP {} while reading item state.", response.statusCode());
                return Optional.empty();
            }

            return toFirstItemPayload(response.body());
        } catch (IOException exception) {
            LOGGER.warn("DSpace discovery request failed while reading item state: {}", exception.getMessage());
            return Optional.empty();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            LOGGER.warn("DSpace discovery request was interrupted while reading item state.");
            return Optional.empty();
        }
    }

    private DspaceItemPayload toItemPayload(JsonNode item) {
        return new DspaceItemPayload(
                item.path("name").asText(),
                item.path("type").asText("item"),
                metadata(item.path("metadata")),
                List.of());
    }

    private Map<String, List<DspaceMetadataValue>> metadata(JsonNode metadata) {
        Map<String, List<DspaceMetadataValue>> values = new LinkedHashMap<>();
        for (Map.Entry<String, JsonNode> field : metadata.properties()) {
            List<DspaceMetadataValue> fieldValues = new ArrayList<>();
            for (JsonNode value : field.getValue()) {
                fieldValues.add(new DspaceMetadataValue(
                        value.path("value").asText(),
                        nullableText(value.path("language")),
                        nullableText(value.path("authority")),
                        value.path("confidence").isMissingNode() || value.path("confidence").isNull()
                                ? null
                                : value.path("confidence").asInt()));
            }
            values.put(field.getKey(), List.copyOf(fieldValues));
        }
        return Map.copyOf(values);
    }

    private boolean isEnabled() {
        return !baseUrl.isBlank();
    }

    private URI discoveryUri(String query) {
        return URI.create(baseUrl + "/api/discover/search/objects?query=" + encode(query));
    }

    private String nullableText(JsonNode node) {
        return node.isMissingNode() || node.isNull() ? null : node.asText();
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private String stripTrailingSlash(String value) {
        if (value == null) {
            return "";
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
