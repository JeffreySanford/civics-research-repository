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
    public boolean ensureSourceIdentifier(String sourceIdentifier, String itemTitle) {
        if (!isEnabled()) {
            return false;
        }

        try {
            Optional<JsonNode> item = findItem(sourceIdentifier);
            if (item.isEmpty()) {
                item = findItem(itemTitle);
            }
            if (item.isEmpty()) {
                throw new IllegalStateException("DSpace item was not found for " + sourceIdentifier + ".");
            }

            JsonNode itemNode = item.orElseThrow();
            if (hasMetadataValue(itemNode, SOURCE_IDENTIFIER_FIELD, sourceIdentifier)) {
                return false;
            }

            AuthSession authSession = authenticate();
            patchItemMetadata(itemNode.path("uuid").asText(), authSession, sourceIdentifier);
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

    private void patchItemMetadata(String itemUuid, AuthSession authSession, String sourceIdentifier)
            throws IOException, InterruptedException {
        Map<String, Object> metadataValue = new LinkedHashMap<>();
        metadataValue.put("value", sourceIdentifier);
        metadataValue.put("language", "en_US");
        metadataValue.put("authority", null);
        metadataValue.put("confidence", -1);

        Map<String, Object> patchOperation = new LinkedHashMap<>();
        patchOperation.put("op", "add");
        patchOperation.put("path", "/metadata/" + SOURCE_IDENTIFIER_FIELD + "/-");
        patchOperation.put("value", metadataValue);

        HttpRequest request = HttpRequest.newBuilder(itemUri(itemUuid))
                .timeout(REQUEST_TIMEOUT)
                .header("Authorization", authSession.authorization())
                .header("X-XSRF-TOKEN", authSession.xsrfToken())
                .header("Cookie", authSession.cookie())
                .header("Content-Type", "application/json-patch+json")
                .method("PATCH", HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(List.of(patchOperation))))
                .build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 300) {
            throw new IllegalStateException("DSpace item metadata patch failed with HTTP " + response.statusCode() + ".");
        }
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
        return response.headers().firstValue("Set-Cookie").map((value) -> value.split(";", 2)[0]);
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
