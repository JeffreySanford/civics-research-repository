package org.civicsrepo.federation;

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
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * NASA Earthdata CMR collection harvester for bounded public-metadata sampling.
 *
 * <p>The initial federation sample intentionally uses collection-level research objects, not the
 * billions of file/granule records behind them. CMR Search-After is used as the durable cursor. A
 * future high-scale granule stream should be modeled explicitly rather than silently changing this
 * collection adapter's semantics.
 */
@Component
public class NasaCmrHarvester implements FederatedSourceHarvester {
    static final int MAX_SOURCE_PAGE_SIZE = 2_000;
    static final String ADAPTER_VERSION = "nasa-cmr-collections-v2";
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(20);
    private static final String DEFAULT_COLLECTIONS_URL = "https://cmr.earthdata.nasa.gov/search/collections.json";

    private final String collectionsUrl;
    private final String clientId;
    private final String bearerToken;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    @Autowired
    public NasaCmrHarvester(
            @Value("${civics.federation.nasa-cmr.collections-url:https://cmr.earthdata.nasa.gov/search/collections.json}")
                    String collectionsUrl,
            @Value("${civics.federation.nasa-cmr.client-id:civics-research-repository}") String clientId,
            @Value("${civics.federation.nasa-cmr.bearer-token:}") String bearerToken) {
        this(
                collectionsUrl,
                clientId,
                bearerToken,
                HttpClient.newBuilder().connectTimeout(REQUEST_TIMEOUT).build(),
                new ObjectMapper(),
                Clock.systemUTC());
    }

    NasaCmrHarvester(
            String collectionsUrl,
            String clientId,
            String bearerToken,
            HttpClient httpClient,
            ObjectMapper objectMapper,
            Clock clock) {
        this.collectionsUrl = stripTrailingQuestionMark(requireText(collectionsUrl, "collectionsUrl"));
        this.clientId = requireText(clientId, "clientId");
        this.bearerToken = bearerToken == null ? "" : bearerToken.trim();
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    @Override
    public FederatedSourceSystem sourceSystem() {
        return FederatedSourceSystem.NASA_CMR;
    }

    @Override
    public String adapterVersion() {
        return ADAPTER_VERSION;
    }

    @Override
    public HarvestPage fetch(String cursor, int pageSize) {
        int safePageSize = Math.max(1, Math.min(pageSize, MAX_SOURCE_PAGE_SIZE));
        HttpRequest.Builder request = HttpRequest.newBuilder(searchUri(safePageSize))
                .timeout(REQUEST_TIMEOUT)
                .header("Accept", "application/json")
                .header("Client-Id", clientId)
                .GET();
        if (cursor != null && !cursor.isBlank()) {
            request.header("CMR-Search-After", cursor.trim());
        }
        if (!bearerToken.isBlank()) {
            request.header("Authorization", "Bearer " + bearerToken);
        }

        HttpResponse<String> response;
        try {
            response = httpClient.send(request.build(), HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw FederatedHarvestException.permanent("NASA CMR harvest request was interrupted.", exception);
        } catch (IOException exception) {
            throw FederatedHarvestException.retryable("NASA CMR harvest request failed.", exception, null);
        }

        int status = response.statusCode();
        if (status == 429 || status == 408 || status >= 500) {
            throw FederatedHarvestException.retryable(
                    "NASA CMR API returned HTTP " + status + ".",
                    retryAfter(response));
        }
        if (status >= 300) {
            throw FederatedHarvestException.permanent("NASA CMR API returned HTTP " + status + ".");
        }

        return parsePage(response.body(), response.headers().firstValue("CMR-Search-After").orElse(null));
    }

    private HarvestPage parsePage(String body, String nextCursor) {
        final JsonNode root;
        try {
            root = objectMapper.readTree(body);
        } catch (JsonProcessingException exception) {
            throw FederatedHarvestException.permanent("NASA CMR API returned invalid JSON.", exception);
        }
        JsonNode entries = root.path("feed").path("entry");
        if (!entries.isArray()) {
            throw FederatedHarvestException.permanent("NASA CMR collection response is missing feed.entry.");
        }

        List<FederatedResearchRecord> records = new ArrayList<>();
        List<HarvestRejection> rejections = new ArrayList<>();
        for (JsonNode entry : entries) {
            try {
                records.add(normalize(entry));
            } catch (RuntimeException exception) {
                rejections.add(new HarvestRejection(
                        optionalText(entry, "concept-id"),
                        message(exception),
                        entry.toString()));
            }
        }

        String normalizedCursor = entries.isEmpty() ? null : blankToNull(nextCursor);
        return new HarvestPage(records, rejections, normalizedCursor, normalizedCursor == null);
    }

    private FederatedResearchRecord normalize(JsonNode entry) {
        String conceptId = requireField(entry, "concept-id");
        String title = firstNonBlank(
                optionalText(entry, "entry-title"),
                optionalText(entry, "dataset-id"),
                optionalText(entry, "title"));
        if (title.isBlank()) {
            throw new IllegalArgumentException("NASA CMR collection is missing an entry title.");
        }
        String shortName = optionalText(entry, "short-name");
        String provider = firstNonBlank(optionalText(entry, "data-center"), firstOrganization(entry), "NASA Earthdata");
        String program = firstNonBlank(shortName, provider);
        String updated = optionalText(entry, "updated");

        Map<String, Object> metadata = new LinkedHashMap<>();
        putIfPresent(metadata, "nativeId", optionalText(entry, "native-id"));
        putIfPresent(metadata, "shortName", shortName);
        putIfPresent(metadata, "versionId", optionalText(entry, "version-id"));
        putIfPresent(metadata, "datasetId", optionalText(entry, "dataset-id"));
        putIfPresent(metadata, "collectionDataType", optionalText(entry, "collection-data-type"));
        putIfPresent(metadata, "updated", updated);
        List<Map<String, String>> links = links(entry.path("links"));
        if (!links.isEmpty()) {
            metadata.put("links", links);
        }

        return new FederatedResearchRecord(
                FederatedSourceSystem.NASA_CMR,
                conceptId,
                title,
                firstNonBlank(optionalText(entry, "summary"), optionalText(entry, "subtitle")),
                provider,
                program,
                ResearchObjectType.DATASET,
                sourceUri(conceptId, links),
                parseTimestamp(updated),
                OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC),
                ADAPTER_VERSION,
                List.of(),
                subjects(entry),
                metadata);
    }

    private String firstOrganization(JsonNode entry) {
        JsonNode organizations = entry.path("organizations");
        if (!organizations.isArray()) {
            return null;
        }
        for (JsonNode organization : organizations) {
            if (organization.isTextual() && !organization.asText().isBlank()) {
                return organization.asText().trim();
            }
        }
        return null;
    }

    private List<String> subjects(JsonNode entry) {
        Set<String> subjects = new LinkedHashSet<>();
        addTextArray(subjects, entry.path("keywords"));
        addTextArray(subjects, entry.path("platforms"));
        return List.copyOf(subjects);
    }

    private void addTextArray(Set<String> values, JsonNode node) {
        if (!node.isArray()) {
            return;
        }
        for (JsonNode value : node) {
            if (value.isTextual() && !value.asText().isBlank()) {
                values.add(value.asText().trim());
            }
        }
    }

    private URI sourceUri(String conceptId, List<Map<String, String>> links) {
        for (Map<String, String> link : links) {
            String rel = link.get("rel");
            String href = link.get("href");
            if (href != null && rel != null && rel.toLowerCase().contains("metadata")) {
                return URI.create(href);
            }
        }
        return URI.create("https://cmr.earthdata.nasa.gov/search/concepts/" + encodePathSegment(conceptId));
    }

    private List<Map<String, String>> links(JsonNode node) {
        if (!node.isArray()) {
            return List.of();
        }
        List<Map<String, String>> links = new ArrayList<>();
        for (JsonNode item : node) {
            String href = optionalText(item, "href");
            if (href == null) {
                continue;
            }
            Map<String, String> link = new LinkedHashMap<>();
            putIfPresent(link, "rel", optionalText(item, "rel"));
            putIfPresent(link, "title", optionalText(item, "title"));
            link.put("href", href);
            links.add(Map.copyOf(link));
        }
        return List.copyOf(links);
    }

    private URI searchUri(int pageSize) {
        String delimiter = collectionsUrl.contains("?") ? "&" : "?";
        // CMR Search-After carries the server's ordering state. NASA's collection-harvesting
        // guidance uses page_size plus the returned CMR-Search-After header, without inventing a
        // concept-id sort. concept_id is a search parameter, not a valid collection sort key.
        return URI.create(collectionsUrl + delimiter + "page_size=" + pageSize);
    }

    private Duration retryAfter(HttpResponse<?> response) {
        String value = response.headers().firstValue("Retry-After").orElse("").trim();
        if (value.isEmpty()) {
            return null;
        }
        try {
            return Duration.ofSeconds(Math.max(0L, Long.parseLong(value)));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private OffsetDateTime parseTimestamp(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return OffsetDateTime.parse(value);
        } catch (DateTimeParseException invalid) {
            return null;
        }
    }

    private String requireField(JsonNode node, String field) {
        String value = optionalText(node, field);
        if (value == null) {
            throw new IllegalArgumentException("NASA CMR collection is missing required field '" + field + "'.");
        }
        return value;
    }

    private String optionalText(JsonNode node, String field) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        JsonNode value = node.path(field);
        if (value.isMissingNode() || value.isNull()) {
            return null;
        }
        String text = value.asText("").trim();
        return text.isBlank() ? null : text;
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return "";
    }

    private void putIfPresent(Map<String, ? super String> metadata, String key, String value) {
        if (value != null && !value.isBlank()) {
            metadata.put(key, value.trim());
        }
    }

    private String message(RuntimeException exception) {
        String message = exception.getMessage();
        return message == null || message.isBlank() ? exception.getClass().getSimpleName() : message;
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String encodePathSegment(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private String stripTrailingQuestionMark(String value) {
        String trimmed = value.trim();
        while (trimmed.endsWith("?")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }

    private static String requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        return value.trim();
    }
}
