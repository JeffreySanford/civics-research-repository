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
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Bounded Data.gov metadata harvester backed by CKAN {@code package_search}.
 *
 * <p>Data.gov is a metadata catalog, not a binary repository. The normalized record therefore
 * retains the Data.gov catalog page as provenance while the original dataset remains owned by its
 * publishing organization. CKAN offset pagination is exposed only as the shared harvester's opaque
 * cursor; callers never depend on the source-specific representation.
 */
@Component
public class DataGovHarvester implements FederatedSourceHarvester {
    static final int MAX_SOURCE_PAGE_SIZE = 1_000;
    static final int MAX_RESOURCE_LINKS_PER_RECORD = 100;
    static final String ADAPTER_VERSION = "data-gov-ckan-v1";
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(20);
    private static final String DEFAULT_CATALOG_BASE = "https://catalog.data.gov";

    private final String searchUrl;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public DataGovHarvester(
            @Value("${civics.federation.data-gov.search-url:https://catalog.data.gov/api/3/action/package_search}")
                    String searchUrl) {
        this(
                searchUrl,
                HttpClient.newBuilder().connectTimeout(REQUEST_TIMEOUT).build(),
                new ObjectMapper(),
                Clock.systemUTC());
    }

    DataGovHarvester(String searchUrl, HttpClient httpClient, ObjectMapper objectMapper, Clock clock) {
        this.searchUrl = stripTrailingQuestionMark(requireText(searchUrl, "searchUrl"));
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    @Override
    public FederatedSourceSystem sourceSystem() {
        return FederatedSourceSystem.DATA_GOV;
    }

    @Override
    public HarvestPage fetch(String cursor, int pageSize) {
        int start = parseCursor(cursor);
        int rows = Math.max(1, Math.min(pageSize, MAX_SOURCE_PAGE_SIZE));
        HttpRequest request = HttpRequest.newBuilder(searchUri(start, rows))
                .timeout(REQUEST_TIMEOUT)
                .header("Accept", "application/json")
                .GET()
                .build();

        HttpResponse<String> response;
        try {
            response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw FederatedHarvestException.permanent("Data.gov harvest request was interrupted.", exception);
        } catch (IOException exception) {
            throw FederatedHarvestException.retryable("Data.gov harvest request failed.", exception, null);
        }

        int status = response.statusCode();
        if (status == 429 || status == 408 || status >= 500) {
            throw FederatedHarvestException.retryable(
                    "Data.gov package_search returned HTTP " + status + ".",
                    retryAfter(response));
        }
        if (status >= 300) {
            throw FederatedHarvestException.permanent("Data.gov package_search returned HTTP " + status + ".");
        }

        return parsePage(response.body(), start);
    }

    private HarvestPage parsePage(String body, int start) {
        final JsonNode root;
        try {
            root = objectMapper.readTree(body);
        } catch (JsonProcessingException exception) {
            throw FederatedHarvestException.permanent("Data.gov package_search returned invalid JSON.", exception);
        }

        if (!root.path("success").asBoolean(false)) {
            throw FederatedHarvestException.permanent("Data.gov package_search reported success=false.");
        }

        JsonNode result = root.path("result");
        if (!result.isObject() || !result.path("results").isArray()) {
            throw FederatedHarvestException.permanent("Data.gov package_search response is missing result.results.");
        }

        long total = Math.max(0L, result.path("count").asLong(0L));
        List<FederatedResearchRecord> records = new ArrayList<>();
        for (JsonNode dataset : result.path("results")) {
            records.add(normalize(dataset));
        }

        long nextOffset = (long) start + records.size();
        if (records.isEmpty() && nextOffset < total) {
            throw FederatedHarvestException.permanent(
                    "Data.gov returned an empty page before the reported catalog count was exhausted.");
        }

        boolean complete = nextOffset >= total || records.isEmpty();
        return new HarvestPage(records, complete ? null : Long.toString(nextOffset), complete);
    }

    private FederatedResearchRecord normalize(JsonNode dataset) {
        String id = requiredText(dataset, "id");
        String name = text(dataset, "name");
        String title = requiredText(dataset, "title");
        String publisher = organizationTitle(dataset);
        String program = firstNonBlank(
                extra(dataset, "programCode"),
                extra(dataset, "bureauCode"),
                publisher);
        String author = text(dataset, "author");
        OffsetDateTime sourceUpdatedAt = parseTimestamp(text(dataset, "metadata_modified"));
        List<Map<String, String>> resourceLinks = resources(dataset);
        int resourceCount = dataset.path("resources").isArray() ? dataset.path("resources").size() : 0;

        Map<String, Object> sourceMetadata = new LinkedHashMap<>();
        putIfPresent(sourceMetadata, "name", name);
        putIfPresent(sourceMetadata, "metadataCreated", text(dataset, "metadata_created"));
        putIfPresent(sourceMetadata, "metadataModified", text(dataset, "metadata_modified"));
        putIfPresent(sourceMetadata, "licenseId", text(dataset, "license_id"));
        putIfPresent(sourceMetadata, "licenseTitle", text(dataset, "license_title"));
        putIfPresent(sourceMetadata, "bureauCode", extra(dataset, "bureauCode"));
        putIfPresent(sourceMetadata, "programCode", extra(dataset, "programCode"));
        putIfPresent(sourceMetadata, "identifier", extra(dataset, "identifier"));
        putIfPresent(sourceMetadata, "landingPage", extra(dataset, "landingPage"));
        putIfPresent(sourceMetadata, "doi", extra(dataset, "doi"));
        sourceMetadata.put("resourceCount", resourceCount);
        if (!resourceLinks.isEmpty()) {
            sourceMetadata.put("resources", resourceLinks);
        }
        if (resourceCount > resourceLinks.size()) {
            sourceMetadata.put("resourceLinksTruncated", true);
        }

        return new FederatedResearchRecord(
                FederatedSourceSystem.DATA_GOV,
                id,
                title,
                text(dataset, "notes"),
                publisher,
                program,
                ResearchObjectType.DATASET,
                catalogUri(name, id),
                sourceUpdatedAt,
                OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC),
                ADAPTER_VERSION,
                author.isBlank() ? List.of() : List.of(author),
                tags(dataset),
                sourceMetadata);
    }

    private URI searchUri(int start, int rows) {
        String delimiter = searchUrl.contains("?") ? "&" : "?";
        String query = "rows=" + rows
                + "&start=" + start
                + "&facet=false"
                + "&sort=" + encode("metadata_modified asc,id asc");
        return URI.create(searchUrl + delimiter + query);
    }

    private URI catalogUri(String name, String id) {
        if (name != null && !name.isBlank()) {
            return URI.create(DEFAULT_CATALOG_BASE + "/dataset/" + encodePathSegment(name));
        }
        return URI.create(DEFAULT_CATALOG_BASE + "/dataset/?id=" + encode(id));
    }

    private List<String> tags(JsonNode dataset) {
        if (!dataset.path("tags").isArray()) {
            return List.of();
        }
        List<String> values = new ArrayList<>();
        for (JsonNode tag : dataset.path("tags")) {
            String value = text(tag, "display_name");
            if (value.isBlank()) {
                value = text(tag, "name");
            }
            if (!value.isBlank()) {
                values.add(value);
            }
        }
        return List.copyOf(values);
    }

    private List<Map<String, String>> resources(JsonNode dataset) {
        if (!dataset.path("resources").isArray()) {
            return List.of();
        }
        List<Map<String, String>> resources = new ArrayList<>();
        for (JsonNode resource : dataset.path("resources")) {
            if (resources.size() >= MAX_RESOURCE_LINKS_PER_RECORD) {
                break;
            }
            String url = text(resource, "url");
            if (url.isBlank()) {
                continue;
            }
            Map<String, String> normalized = new LinkedHashMap<>();
            putIfPresent(normalized, "id", text(resource, "id"));
            putIfPresent(normalized, "name", text(resource, "name"));
            putIfPresent(normalized, "format", text(resource, "format"));
            normalized.put("url", url);
            resources.add(Map.copyOf(normalized));
        }
        return List.copyOf(resources);
    }

    private String organizationTitle(JsonNode dataset) {
        String organization = text(dataset.path("organization"), "title");
        return organization.isBlank() ? "Data.gov" : organization;
    }

    private String extra(JsonNode dataset, String key) {
        if (!dataset.path("extras").isArray()) {
            return "";
        }
        for (JsonNode extra : dataset.path("extras")) {
            if (key.equalsIgnoreCase(text(extra, "key"))) {
                return text(extra, "value");
            }
        }
        return "";
    }

    private Duration retryAfter(HttpResponse<?> response) {
        String value = response.headers().firstValue("Retry-After").orElse("").trim();
        if (value.isEmpty()) {
            return null;
        }
        try {
            return Duration.ofSeconds(Math.max(0L, Long.parseLong(value)));
        } catch (NumberFormatException ignored) {
            try {
                Instant retryAt = OffsetDateTime.parse(value, java.time.format.DateTimeFormatter.RFC_1123_DATE_TIME)
                        .toInstant();
                Duration delay = Duration.between(clock.instant(), retryAt);
                return delay.isNegative() ? Duration.ZERO : delay;
            } catch (DateTimeParseException invalidDate) {
                return null;
            }
        }
    }

    private OffsetDateTime parseTimestamp(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return OffsetDateTime.parse(value);
        } catch (DateTimeParseException ignored) {
            try {
                return LocalDateTime.parse(value).atOffset(ZoneOffset.UTC);
            } catch (DateTimeParseException invalid) {
                throw FederatedHarvestException.permanent("Data.gov metadata_modified is not a valid timestamp: " + value);
            }
        }
    }

    private int parseCursor(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return 0;
        }
        try {
            long parsed = Long.parseLong(cursor.trim());
            if (parsed < 0 || parsed > Integer.MAX_VALUE) {
                throw new NumberFormatException("out of range");
            }
            return (int) parsed;
        } catch (NumberFormatException exception) {
            throw FederatedHarvestException.permanent("Data.gov cursor is not a non-negative integer: " + cursor, exception);
        }
    }

    private String requiredText(JsonNode node, String field) {
        String value = text(node, field);
        if (value.isBlank()) {
            throw FederatedHarvestException.permanent("Data.gov dataset is missing required field '" + field + "'.");
        }
        return value;
    }

    private String text(JsonNode node, String field) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return "";
        }
        JsonNode value = node.path(field);
        return value.isMissingNode() || value.isNull() ? "" : value.asText("").trim();
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

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private String encodePathSegment(String value) {
        return encode(value).replace("+", "%20");
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
        return value;
    }
}
