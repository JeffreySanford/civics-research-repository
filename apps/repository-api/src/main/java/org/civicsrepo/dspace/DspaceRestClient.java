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
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Single owner of DSpace REST transport: discovery search, authentication, and item PATCH.
 *
 * <p>The read (diff) and write (apply) paths both depend on identical URI construction, response
 * parsing, and item-resolution rules, so they share this client rather than each carrying a copy.
 */
@Component
public class DspaceRestClient {
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(5);

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String baseUrl;
    private final String adminEmail;
    private final String adminPassword;

    public DspaceRestClient(
            @Value("${civics.dspace.base-url:}") String baseUrl,
            @Value("${civics.dspace.admin-email:}") String adminEmail,
            @Value("${civics.dspace.admin-password:}") String adminPassword) {
        this.objectMapper = new ObjectMapper();
        this.httpClient = HttpClient.newBuilder().connectTimeout(REQUEST_TIMEOUT).build();
        this.baseUrl = stripTrailingSlash(baseUrl);
        this.adminEmail = normalize(adminEmail);
        this.adminPassword = normalize(adminPassword);
    }

    /** Discovery reads only need a base URL. */
    public boolean isReadEnabled() {
        return !baseUrl.isBlank();
    }

    /** Writes additionally need credentials; blank credentials disable reconciliation rather than failing it. */
    public boolean isWriteEnabled() {
        return isReadEnabled() && !adminEmail.isBlank() && !adminPassword.isBlank();
    }

    /** Cheap liveness probe used to decide whether repository work can run at all. */
    public boolean isReachable() {
        if (!isReadEnabled()) {
            return false;
        }

        try {
            HttpResponse<String> response = send(HttpRequest.newBuilder(URI.create(baseUrl + "/api"))
                    .timeout(REQUEST_TIMEOUT)
                    .GET());
            return response.statusCode() < 300;
        } catch (DspaceUnavailableException exception) {
            return false;
        }
    }

    /** The configured DSpace endpoint, for log and error messages. */
    public String baseUrl() {
        return baseUrl;
    }

    /**
     * Resolves the one item a source identifier refers to, searching by identifier first and
     * falling back to the normalized title for items that have not been stamped yet.
     */
    public Optional<JsonNode> findItem(String sourceIdentifier, String expectedTitle) {
        Optional<JsonNode> byIdentifier =
                DspaceItemMatcher.selectTargetItem(searchItems(sourceIdentifier), sourceIdentifier, expectedTitle);
        if (byIdentifier.isPresent()) {
            return byIdentifier;
        }
        return DspaceItemMatcher.selectTargetItem(searchItems(expectedTitle), sourceIdentifier, expectedTitle);
    }

    /** Returns every non-withdrawn item in a discovery response, newest DSpace ranking order preserved. */
    public List<JsonNode> searchItems(String query) {
        if (!isReadEnabled() || normalize(query).isBlank()) {
            return List.of();
        }

        HttpResponse<String> response =
                send(HttpRequest.newBuilder(discoveryUri(query)).timeout(REQUEST_TIMEOUT).GET());
        if (response.statusCode() >= 300) {
            throw new DspaceUnavailableException(baseUrl, response.statusCode());
        }
        return toDiscoverableItems(response.body());
    }

    public List<JsonNode> toDiscoverableItems(String responseBody) {
        try {
            JsonNode objects = objectMapper
                    .readTree(responseBody)
                    .path("_embedded")
                    .path("searchResult")
                    .path("_embedded")
                    .path("objects");

            List<JsonNode> items = new ArrayList<>();
            for (JsonNode object : objects) {
                JsonNode item = object.path("_embedded").path("indexableObject");
                if ("item".equals(item.path("type").asText()) && !item.path("withdrawn").asBoolean(false)) {
                    items.add(item);
                }
            }
            return List.copyOf(items);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("DSpace discovery response could not be parsed.", exception);
        }
    }

    public void patchItemMetadata(String itemUuid, List<Map<String, Object>> patchOperations) {
        AuthSession authSession = authenticate();
        HttpResponse<String> response = send(HttpRequest.newBuilder(itemUri(itemUuid))
                .timeout(REQUEST_TIMEOUT)
                .header("Authorization", authSession.authorization())
                .header("X-XSRF-TOKEN", authSession.xsrfToken())
                .header("Cookie", authSession.cookie())
                .header("Content-Type", "application/json-patch+json")
                .method("PATCH", HttpRequest.BodyPublishers.ofString(writeJson(patchOperations))));
        if (response.statusCode() >= 300) {
            throw new IllegalStateException(
                    "DSpace item metadata patch failed with HTTP " + response.statusCode() + ": " + response.body());
        }
    }

    /**
     * Single exit point for HTTP. Transport failures become {@link DspaceUnavailableException} so
     * that callers never have to decide whether an {@link IOException} meant "absent" or "down".
     */
    private HttpResponse<String> send(HttpRequest.Builder request) {
        try {
            return httpClient.send(request.build(), HttpResponse.BodyHandlers.ofString());
        } catch (IOException exception) {
            throw new DspaceUnavailableException(baseUrl, exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new DspaceUnavailableException(baseUrl, exception);
        }
    }

    private AuthSession authenticate() {
        HttpResponse<String> csrfResponse = login(Optional.empty(), Optional.empty());
        Optional<String> csrfToken = header(csrfResponse, "DSPACE-XSRF-TOKEN");
        Optional<String> cookie = cookie(csrfResponse);
        HttpResponse<String> loginResponse = login(csrfToken, cookie);

        if (loginResponse.statusCode() >= 300) {
            throw new IllegalStateException("DSpace login failed with HTTP " + loginResponse.statusCode()
                    + " for " + adminEmail + ". Check CIVICS_DSPACE_ADMIN_EMAIL and"
                    + " CIVICS_DSPACE_ADMIN_PASSWORD in .env, and that the DSpace seed has run.");
        }

        String authorization = header(loginResponse, "Authorization")
                .orElseThrow(() -> new IllegalStateException("DSpace login did not return an authorization token."));
        String xsrfToken = header(loginResponse, "DSPACE-XSRF-TOKEN")
                .or(() -> csrfToken)
                .orElseThrow(() -> new IllegalStateException("DSpace login did not return a CSRF token."));
        String sessionCookie = cookie(loginResponse).or(() -> cookie).orElse("");
        return new AuthSession(authorization, xsrfToken, sessionCookie);
    }

    private HttpResponse<String> login(Optional<String> csrfToken, Optional<String> cookie) {
        HttpRequest.Builder request = HttpRequest.newBuilder(loginUri())
                .timeout(REQUEST_TIMEOUT)
                .header("Content-Type", "application/x-www-form-urlencoded");
        csrfToken.ifPresent((token) -> request.header("X-XSRF-TOKEN", token));
        cookie.ifPresent((value) -> request.header("Cookie", value));

        return send(request.POST(HttpRequest.BodyPublishers.ofString(
                "user=" + encode(adminEmail) + "&password=" + encode(adminPassword))));
    }

    private String writeJson(Object payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("DSpace request payload could not be serialized.", exception);
        }
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
