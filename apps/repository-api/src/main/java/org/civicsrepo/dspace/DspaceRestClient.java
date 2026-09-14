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
 * Single owner of DSpace REST transport: discovery search, version history, authentication, and item PATCH.
 *
 * <p>The read (diff) and write (apply) paths both depend on identical URI construction, response
 * parsing, and item-resolution rules, so they share this client rather than each carrying a copy.
 */
@Component
public class DspaceRestClient {
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(5);
    private static final int VERSION_PAGE_SIZE = 100;

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

    /** Non-withdrawn item count from the discovery index, when reads are enabled. */
    public Optional<Integer> countDiscoverableItems() {
        if (!isReadEnabled()) {
            return Optional.empty();
        }

        try {
            HttpResponse<String> response = send(HttpRequest.newBuilder(allItemsUri(0, 1))
                    .timeout(REQUEST_TIMEOUT)
                    .GET());
            if (response.statusCode() >= 300) {
                return Optional.empty();
            }
            return Optional.of(parseDiscoveryTotalElements(response.body()));
        } catch (DspaceUnavailableException exception) {
            return Optional.empty();
        }
    }

    /**
     * Counts and measures the bitstreams the assetstore actually holds.
     *
     * Asked of DSpace rather than of the mirror manifest on purpose: the manifest records what the
     * seed intended to stage, and for a long while that differed from what was imported. Only
     * DSpace knows what is in the assetstore, so only DSpace is allowed to report it.
     *
     * Discovery embeds the bundles, so this is one request per hundred items rather than one per
     * item. ORIGINAL only — the license and text-extraction bundles are DSpace's own bookkeeping,
     * not subscribed source bytes.
     */
    public Optional<StoredBitstreams> summarizeStoredBitstreams() {
        if (!isReadEnabled()) {
            return Optional.empty();
        }

        try {
            int fileCount = 0;
            long totalBytes = 0;
            int pageSize = 100;

            for (int page = 0; ; page++) {
                URI uri = URI.create(allItemsUri(page, pageSize) + "&embed=bundles/bitstreams");
                HttpResponse<String> response =
                        send(HttpRequest.newBuilder(uri).timeout(REQUEST_TIMEOUT).GET());
                if (response.statusCode() >= 300) {
                    return Optional.empty();
                }

                List<JsonNode> pageItems = toDiscoverableItems(response.body());
                for (JsonNode item : pageItems) {
                    for (JsonNode bundle :
                            item.path("_embedded").path("bundles").path("_embedded").path("bundles")) {
                        if (!"ORIGINAL".equals(bundle.path("name").asText(""))) {
                            continue;
                        }
                        for (JsonNode bitstream : bundle.path("_embedded")
                                .path("bitstreams")
                                .path("_embedded")
                                .path("bitstreams")) {
                            fileCount++;
                            totalBytes += Math.max(0L, bitstream.path("sizeBytes").asLong(0L));
                        }
                    }
                }

                if (pageItems.size() < pageSize) {
                    break;
                }
            }

            return Optional.of(new StoredBitstreams(fileCount, totalBytes));
        } catch (DspaceUnavailableException exception) {
            return Optional.empty();
        }
    }

    /** Bitstreams held in ORIGINAL bundles, and their total size as DSpace reports it. */
    public record StoredBitstreams(int fileCount, long totalBytes) {}

    /** Top-level communities from the core API, when reads are enabled. */
    public List<ContainerSummary> listCommunities() {
        return listContainers("/api/core/communities", "communities");
    }

    /** Collections from the core API, when reads are enabled. */
    public List<ContainerSummary> listCollections() {
        return listContainers("/api/core/collections", "collections");
    }

    private List<ContainerSummary> listContainers(String path, String embeddedKey) {
        if (!isReadEnabled()) {
            return List.of();
        }

        try {
            HttpResponse<String> response = send(HttpRequest.newBuilder(URI.create(baseUrl + path + "?size=50"))
                    .timeout(REQUEST_TIMEOUT)
                    .GET());
            if (response.statusCode() >= 300) {
                return List.of();
            }
            return parseContainerSummaries(response.body(), embeddedKey);
        } catch (DspaceUnavailableException exception) {
            return List.of();
        }
    }

    private int parseDiscoveryTotalElements(String responseBody) {
        try {
            JsonNode page = objectMapper
                    .readTree(responseBody)
                    .path("_embedded")
                    .path("searchResult")
                    .path("page");
            return Math.max(0, page.path("totalElements").asInt(0));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("DSpace discovery response could not be parsed.", exception);
        }
    }

    private List<ContainerSummary> parseContainerSummaries(String responseBody, String embeddedKey) {
        try {
            JsonNode containers = objectMapper.readTree(responseBody).path("_embedded").path(embeddedKey);
            List<ContainerSummary> summaries = new ArrayList<>();
            for (JsonNode container : containers) {
                summaries.add(new ContainerSummary(
                        container.path("uuid").asText(null),
                        container.path("name").asText("")));
            }
            return List.copyOf(summaries);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("DSpace container response could not be parsed.", exception);
        }
    }

    public record ContainerSummary(String uuid, String name) {}

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

    /**
     * Every non-withdrawn item in the repository, paged through discovery.
     *
     * <p>This is the read side of "DSpace is the system of record": the discovery projection and
     * dataset detail are both built from it, rather than from generated fixtures.
     */
    public List<JsonNode> listAllItems(int maxItems) {
        if (!isReadEnabled()) {
            return List.of();
        }

        List<JsonNode> items = new ArrayList<>();
        int pageSize = Math.min(Math.max(maxItems, 1), 100);

        for (int page = 0; items.size() < maxItems; page++) {
            HttpResponse<String> response = send(HttpRequest.newBuilder(allItemsUri(page, pageSize))
                    .timeout(REQUEST_TIMEOUT)
                    .GET());
            if (response.statusCode() >= 300) {
                throw new DspaceUnavailableException(baseUrl, response.statusCode());
            }

            List<JsonNode> pageItems = toDiscoverableItems(response.body());
            if (pageItems.isEmpty()) {
                break;
            }

            items.addAll(pageItems);
            if (pageItems.size() < pageSize) {
                break;
            }
        }

        return items.size() > maxItems ? List.copyOf(items.subList(0, maxItems)) : List.copyOf(items);
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

    /**
     * Reads DSpace's first-class item version history. No chronology is inferred when an item has no
     * accessible version relation; callers retain their current-record fallback in that case.
     *
     * <p>When administrative credentials are configured, history reads use them so metadata on
     * withdrawn archived versions remains visible. Credentials are never required for repositories
     * whose version history is public; failed optional authentication falls back to anonymous reads.
     */
    public List<DspaceVersionRecord> listItemVersions(String itemUuid) {
        if (!isReadEnabled() || normalize(itemUuid).isBlank()) {
            return List.of();
        }

        Optional<AuthSession> readSession = optionalReadSession();
        HttpResponse<String> itemVersionResponse = get(itemVersionUri(itemUuid), readSession);
        if (itemVersionResponse.statusCode() == 204 || itemVersionResponse.statusCode() == 404) {
            return List.of();
        }
        if (itemVersionResponse.statusCode() >= 300) {
            return List.of();
        }

        JsonNode itemVersion = readTree(
                itemVersionResponse.body(), "DSpace item-version response could not be parsed.");
        String historyHref = itemVersion.path("_links").path("versionhistory").path("href").asText("").trim();
        if (historyHref.isEmpty()) {
            return List.of();
        }

        HttpResponse<String> historyResponse = get(URI.create(historyHref), readSession);
        if (historyResponse.statusCode() >= 300) {
            return List.of();
        }

        JsonNode history = readTree(historyResponse.body(), "DSpace version-history response could not be parsed.");
        boolean draftVersion = history.path("draftVersion").asBoolean(false);
        String versionsHref = history.path("_links").path("versions").path("href").asText("").trim();
        if (versionsHref.isEmpty()) {
            return List.of();
        }

        List<DspaceVersionRecord> versions = new ArrayList<>();
        for (int page = 0; ; page++) {
            HttpResponse<String> response = get(pageUri(versionsHref, page, VERSION_PAGE_SIZE), readSession);
            if (response.statusCode() >= 300) {
                return List.of();
            }

            // DSpace orders the collection by version number descending. The first archived version
            // is current only when the authoritative history says there is no newer draft version.
            List<DspaceVersionRecord> pageVersions =
                    toVersionRecords(response.body(), page == 0 && !draftVersion);
            for (DspaceVersionRecord version : pageVersions) {
                versions.add(version.withItem(fetchVersionItem(version.id(), readSession)));
            }
            if (pageVersions.size() < VERSION_PAGE_SIZE) {
                break;
            }
        }
        return List.copyOf(versions);
    }

    /** Parses one version-history collection page in the DSpace-defined descending version order. */
    List<DspaceVersionRecord> toVersionRecords(String responseBody, boolean markFirstCurrent) {
        JsonNode nodes = readTree(responseBody, "DSpace version-list response could not be parsed.")
                .path("_embedded")
                .path("versions");
        List<DspaceVersionRecord> versions = new ArrayList<>();
        for (JsonNode node : nodes) {
            String id = node.path("id").asText("").trim();
            String version = node.path("version").asText("").trim();
            if (id.isEmpty() || version.isEmpty()) {
                continue;
            }
            boolean current = markFirstCurrent && versions.isEmpty();
            versions.add(new DspaceVersionRecord(
                    id,
                    version,
                    node.path("created").asText("").trim(),
                    blankToNull(node.path("summary").asText(null)),
                    current,
                    null));
        }
        return List.copyOf(versions);
    }

    private JsonNode fetchVersionItem(String versionId, Optional<AuthSession> readSession) {
        HttpResponse<String> response = get(versionItemUri(versionId), readSession);
        if (response.statusCode() >= 300) {
            return null;
        }
        return readTree(response.body(), "DSpace version-item response could not be parsed.");
    }

    private HttpResponse<String> get(URI uri, Optional<AuthSession> readSession) {
        HttpRequest.Builder request = HttpRequest.newBuilder(uri).timeout(REQUEST_TIMEOUT);
        readSession.ifPresent(session -> request
                .header("Authorization", session.authorization())
                .header("X-XSRF-TOKEN", session.xsrfToken())
                .header("Cookie", session.cookie()));
        return send(request.GET());
    }

    private Optional<AuthSession> optionalReadSession() {
        if (!isWriteEnabled()) {
            return Optional.empty();
        }
        try {
            return Optional.of(authenticate());
        } catch (RuntimeException exception) {
            // Authentication is an enrichment for version-history reads, not a requirement for
            // repositories configured to expose history publicly.
            return Optional.empty();
        }
    }

    private JsonNode readTree(String responseBody, String message) {
        try {
            return objectMapper.readTree(responseBody);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException(message, exception);
        }
    }

    /** One DSpace-native version plus the archived item it identifies when that item is readable. */
    public record DspaceVersionRecord(
            String id,
            String version,
            String created,
            String summary,
            boolean current,
            JsonNode item) {
        DspaceVersionRecord withItem(JsonNode linkedItem) {
            return new DspaceVersionRecord(id, version, created, summary, current, linkedItem);
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

    private URI allItemsUri(int page, int pageSize) {
        return URI.create(
                baseUrl + "/api/discover/search/objects?dsoType=item&page=" + page + "&size=" + pageSize);
    }

    private URI itemUri(String itemUuid) {
        return URI.create(baseUrl + "/api/core/items/" + encode(itemUuid));
    }

    private URI itemVersionUri(String itemUuid) {
        return URI.create(baseUrl + "/api/core/items/" + encode(itemUuid) + "/version");
    }

    private URI versionItemUri(String versionId) {
        return URI.create(baseUrl + "/api/versioning/versions/" + encode(versionId) + "/item");
    }

    private URI pageUri(String href, int page, int size) {
        return URI.create(href + (href.contains("?") ? "&" : "?") + "page=" + page + "&size=" + size);
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

    private String blankToNull(String value) {
        String normalized = normalize(value);
        return normalized.isEmpty() ? null : normalized;
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
