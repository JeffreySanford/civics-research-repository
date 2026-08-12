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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class DspaceRestItemWriteGateway implements DspaceItemWriteGateway {
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(5);
    private static final String SOURCE_IDENTIFIER_FIELD = "dc.identifier.other";
    private static final List<String> WRITABLE_METADATA_FIELDS = List.of(
            "dc.title",
            "dc.contributor.author",
            "dc.publisher",
            "dc.description.abstract",
            "dc.date.issued",
            "dc.identifier.uri",
            "dc.relation.uri",
            "dc.identifier.citation",
            "dc.subject",
            "dc.coverage.spatial",
            SOURCE_IDENTIFIER_FIELD);

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String baseUrl;
    private final String adminEmail;
    private final String adminPassword;

    public DspaceRestItemWriteGateway(
            @Value("${civics.dspace.base-url:}") String baseUrl,
            @Value("${civics.dspace.admin-email:admin@civics.local}") String adminEmail,
            @Value("${civics.dspace.admin-password:civics-admin}") String adminPassword) {
        this.objectMapper = new ObjectMapper();
        this.httpClient = HttpClient.newBuilder().connectTimeout(REQUEST_TIMEOUT).build();
        this.baseUrl = stripTrailingSlash(baseUrl);
        this.adminEmail = adminEmail;
        this.adminPassword = adminPassword;
    }

    @Override
    public boolean ensureItemMetadata(String sourceIdentifier, DspaceItemPayload sourcePayload) {
        if (!isEnabled()) {
            return false;
        }

        try {
            Optional<JsonNode> item = findItem(sourceIdentifier);
            if (item.isEmpty()) {
                item = findItem(sourcePayload.name());
            }
            if (item.isEmpty()) {
                throw new IllegalStateException("DSpace item was not found for " + sourceIdentifier + ".");
            }

            JsonNode itemNode = item.orElseThrow();
            List<Map<String, Object>> patchOperations = metadataPatchOperations(itemNode, sourceIdentifier, sourcePayload);
            if (patchOperations.isEmpty()) {
                return false;
            }

            AuthSession authSession = authenticate();
            patchItemMetadata(itemNode.path("uuid").asText(), authSession, patchOperations);
            return true;
        } catch (IOException exception) {
            throw new IllegalStateException("DSpace item write request failed.", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("DSpace item write request was interrupted.", exception);
        }
    }

    Optional<JsonNode> toFirstDiscoverableItem(String responseBody) {
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
                    return Optional.of(item);
                }
            }

            return Optional.empty();
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("DSpace discovery response could not be parsed.", exception);
        }
    }

    boolean hasMetadataValue(JsonNode item, String field, String value) {
        for (JsonNode metadataValue : item.path("metadata").path(field)) {
            if (value.equals(metadataValue.path("value").asText())) {
                return true;
            }
        }
        return false;
    }

    List<Map<String, Object>> metadataPatchOperations(
            JsonNode item, String sourceIdentifier, DspaceItemPayload sourcePayload) {
        Map<String, List<DspaceMetadataValue>> sourceMetadata = new LinkedHashMap<>(sourcePayload.metadata());
        sourceMetadata.put(
                SOURCE_IDENTIFIER_FIELD,
                List.of(new DspaceMetadataValue(sourceIdentifier, "en_US", null, -1)));

        List<Map<String, Object>> operations = new ArrayList<>();
        for (String field : WRITABLE_METADATA_FIELDS) {
            List<DspaceMetadataValue> sourceValues = sourceMetadata.getOrDefault(field, List.of());
            if (sourceValues.isEmpty() || hasExactMetadataValues(item, field, sourceValues)) {
                continue;
            }

            Map<String, Object> operation = new LinkedHashMap<>();
            operation.put("op", item.path("metadata").has(field) ? "replace" : "add");
            operation.put("path", "/metadata/" + field);
            operation.put("value", metadataValues(sourceValues));
            operations.add(operation);
        }
        return List.copyOf(operations);
    }

    private boolean hasExactMetadataValues(JsonNode item, String field, List<DspaceMetadataValue> sourceValues) {
        JsonNode existingValues = item.path("metadata").path(field);
        if (!existingValues.isArray() || existingValues.size() != sourceValues.size()) {
            return false;
        }

        for (int index = 0; index < sourceValues.size(); index++) {
            DspaceMetadataValue sourceValue = sourceValues.get(index);
            JsonNode existingValue = existingValues.get(index);
            if (!sourceValue.value().equals(existingValue.path("value").asText())
                    || !normalize(sourceValue.language()).equals(normalize(existingValue.path("language").asText(null)))) {
                return false;
            }
        }
        return true;
    }

    private Optional<JsonNode> findItem(String query) throws IOException, InterruptedException {
        if (normalize(query).isBlank()) {
            return Optional.empty();
        }

        HttpRequest request = HttpRequest.newBuilder(discoveryUri(query))
                .timeout(REQUEST_TIMEOUT)
                .GET()
                .build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 300) {
            throw new IllegalStateException("DSpace discovery failed with HTTP " + response.statusCode() + ".");
        }
        return toFirstDiscoverableItem(response.body());
    }

    private AuthSession authenticate() throws IOException, InterruptedException {
        HttpResponse<String> csrfResponse = login(Optional.empty(), Optional.empty());
        Optional<String> csrfToken = header(csrfResponse, "DSPACE-XSRF-TOKEN");
        Optional<String> cookie = cookie(csrfResponse);
        HttpResponse<String> loginResponse = login(csrfToken, cookie);

        if (loginResponse.statusCode() >= 300) {
            throw new IllegalStateException("DSpace login failed with HTTP " + loginResponse.statusCode() + ".");
        }

        String authorization = header(loginResponse, "Authorization")
                .orElseThrow(() -> new IllegalStateException("DSpace login did not return an authorization token."));
        String xsrfToken = header(loginResponse, "DSPACE-XSRF-TOKEN")
                .or(() -> csrfToken)
                .orElseThrow(() -> new IllegalStateException("DSpace login did not return a CSRF token."));
        String sessionCookie = cookie(loginResponse).or(() -> cookie).orElse("");
        return new AuthSession(authorization, xsrfToken, sessionCookie);
    }

    private HttpResponse<String> login(Optional<String> csrfToken, Optional<String> cookie)
            throws IOException, InterruptedException {
        HttpRequest.Builder request = HttpRequest.newBuilder(loginUri())
                .timeout(REQUEST_TIMEOUT)
                .header("Content-Type", "application/x-www-form-urlencoded");
        csrfToken.ifPresent((token) -> request.header("X-XSRF-TOKEN", token));
        cookie.ifPresent((value) -> request.header("Cookie", value));

        return httpClient.send(
                request.POST(HttpRequest.BodyPublishers.ofString(
                                "user=" + encode(adminEmail) + "&password=" + encode(adminPassword)))
                        .build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private void patchItemMetadata(String itemUuid, AuthSession authSession, List<Map<String, Object>> patchOperations)
            throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(itemUri(itemUuid))
                .timeout(REQUEST_TIMEOUT)
                .header("Authorization", authSession.authorization())
                .header("X-XSRF-TOKEN", authSession.xsrfToken())
                .header("Cookie", authSession.cookie())
                .header("Content-Type", "application/json-patch+json")
                .method("PATCH", HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(patchOperations)))
                .build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 300) {
            throw new IllegalStateException(
                    "DSpace item metadata patch failed with HTTP " + response.statusCode() + ": " + response.body());
        }
    }

    private List<Map<String, Object>> metadataValues(List<DspaceMetadataValue> values) {
        return values.stream().map(this::metadataValue).toList();
    }

    private Map<String, Object> metadataValue(DspaceMetadataValue value) {
        Map<String, Object> metadataValue = new LinkedHashMap<>();
        metadataValue.put("value", value.value());
        metadataValue.put("language", value.language());
        metadataValue.put("authority", value.authority());
        metadataValue.put("confidence", value.confidence());
        return metadataValue;
    }

    private boolean isEnabled() {
        return !baseUrl.isBlank() && !adminEmail.isBlank() && !adminPassword.isBlank();
    }

    private URI discoveryUri(String query) {
        return URI.create(baseUrl + "/api/discover/search/objects?query=" + encode(query));
    }

    private URI itemUri(String itemUuid) {
        return URI.create(baseUrl + "/api/core/items/" + encode(itemUuid));
    }

    private URI loginUri() {
        return URI.create(baseUrl + "/api/authn/login");
    }

    private Optional<String> header(HttpResponse<?> response, String name) {
        return response.headers().firstValue(name).map(String::trim);
    }

    private Optional<String> cookie(HttpResponse<?> response) {
        return response.headers().allValues("Set-Cookie").stream()
                .map((value) -> value.split(";", 2)[0])
                .filter((value) -> value.startsWith("DSPACE-XSRF-COOKIE="))
                .filter((value) -> value.length() > "DSPACE-XSRF-COOKIE=".length())
                .reduce((first, second) -> second);
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

    private record AuthSession(String authorization, String xsrfToken, String cookie) {}
}
