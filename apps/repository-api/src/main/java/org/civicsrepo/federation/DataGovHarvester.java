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
import java.time.LocalDate;
import java.time.LocalDateTime;
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
 * Bounded Data.gov metadata harvester backed by the Data.gov Catalog API v4.
 *
 * <p>Data.gov is a metadata catalog, not a binary repository. The normalized record therefore
 * retains the Data.gov catalog page as provenance while the original dataset remains owned by its
 * publishing organization. The v4 API's {@code after} token is exposed only as the shared
 * harvester's opaque cursor; callers never depend on the source-specific cursor representation.
 */
@Component
public class DataGovHarvester implements FederatedSourceHarvester {
    static final int MAX_SOURCE_PAGE_SIZE = 1_000;
    static final int MAX_RESOURCE_LINKS_PER_RECORD = 100;
    static final String ADAPTER_VERSION = "data-gov-catalog-v4-v2";
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(20);
    private static final Duration DEFAULT_RATE_LIMIT_DEFER = Duration.ofHours(1);
    private static final String DEFAULT_CATALOG_BASE = "https://catalog.data.gov";

    private final String searchUrl;
    private final String apiKey;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    @Autowired
    public DataGovHarvester(
            @Value("${civics.federation.data-gov.search-url:https://api.gsa.gov/technology/datagov/v4/search}")
                    String searchUrl,
            @Value("${civics.federation.data-gov.api-key:DEMO_KEY}") String apiKey) {
        this(
                searchUrl,
                apiKey,
                HttpClient.newBuilder().connectTimeout(REQUEST_TIMEOUT).build(),
                new ObjectMapper(),
                Clock.systemUTC());
    }

    DataGovHarvester(String searchUrl, String apiKey, HttpClient httpClient, ObjectMapper objectMapper, Clock clock) {
        this.searchUrl = stripTrailingQuestionMark(requireText(searchUrl, "searchUrl"));
        this.apiKey = requireText(apiKey, "apiKey");
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    @Override
    public FederatedSourceSystem sourceSystem() {
        return FederatedSourceSystem.DATA_GOV;
    }

    @Override
    public String adapterVersion() {
        return ADAPTER_VERSION;
    }

    @Override
    public HarvestPage fetch(String cursor, int pageSize) {
        int perPage = Math.max(1, Math.min(pageSize, MAX_SOURCE_PAGE_SIZE));
        HttpRequest request = HttpRequest.newBuilder(searchUri(cursor, perPage))
                .timeout(REQUEST_TIMEOUT)
                .header("Accept", "application/json")
                .header("X-Api-Key", apiKey)
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
        if (status == 429) {
            Duration retryAfter = retryAfter(response);
            throw FederatedHarvestException.retryable(
                    "Data.gov Catalog API returned HTTP 429.",
                    retryAfter == null ? DEFAULT_RATE_LIMIT_DEFER : retryAfter);
        }
        if (status == 408 || status >= 500) {
            throw FederatedHarvestException.retryable(
                    "Data.gov Catalog API returned HTTP " + status + ".",
                    retryAfter(response));
        }
        if (status >= 300) {
            throw FederatedHarvestException.permanent("Data.gov Catalog API returned HTTP " + status + ".");
        }

        return parsePage(response.body());
    }

    private HarvestPage parsePage(String body) {
        final JsonNode root;
        try {
            root = objectMapper.readTree(body);
        } catch (JsonProcessingException exception) {
            throw FederatedHarvestException.permanent("Data.gov Catalog API returned invalid JSON.", exception);
        }

        JsonNode results = root.path("results");
        if (!root.isObject() || !results.isArray()) {
            throw FederatedHarvestException.permanent("Data.gov Catalog API response is missing results.");
        }

        List<FederatedResearchRecord> records = new ArrayList<>();
        List<HarvestRejection> rejections = new ArrayList<>();
        for (JsonNode dataset : results) {
            try {
                records.add(normalize(dataset));
            } catch (FederatedHarvestException exception) {
                if (exception.retryable()) {
                    throw exception;
                }
                rejections.add(new HarvestRejection(
                        optionalIdentifier(dataset),
                        exception.getMessage(),
                        dataset.toString()));
            }
        }

        String nextCursor = optionalText(root, "after");
        if (results.isEmpty() && nextCursor != null) {
            throw FederatedHarvestException.permanent(
                    "Data.gov returned an empty page with a continuation cursor.");
        }

        boolean complete = nextCursor == null;
        return new HarvestPage(records, rejections, nextCursor, complete);
    }

    private FederatedResearchRecord normalize(JsonNode dataset) {
        JsonNode dcat = dataset.path("dcat");
        String id = requiredFirst("identifier", optionalText(dataset, "identifier"), optionalText(dcat, "identifier"));
        String slug = optionalText(dataset, "slug");
        String title = requiredFirst("title", optionalText(dataset, "title"), optionalText(dcat, "title"));
        String summary = firstNonBlank(optionalText(dataset, "description"), optionalText(dcat, "description"));
        String publisher = firstNonBlank(
                optionalText(dataset, "publisher"),
                optionalText(dcat.path("publisher"), "name"),
                optionalText(dataset.path("organization"), "name"),
                "Data.gov");
        String bureauCode = firstArrayText(dcat, "bureauCode");
        String programCode = firstArrayText(dcat, "programCode");
        String program = firstNonBlank(programCode, bureauCode, publisher);
        String sourceModified = optionalText(dcat, "modified");
        OffsetDateTime sourceUpdatedAt = parseTimestamp(sourceModified);
        List<Map<String, String>> resourceLinks = resources(dcat);
        int resourceCount = dcat.path("distribution").isArray() ? dcat.path("distribution").size() : 0;

        Map<String, Object> sourceMetadata = new LinkedHashMap<>();
        putIfPresent(sourceMetadata, "slug", slug);
        putIfPresent(sourceMetadata, "accessLevel", optionalText(dcat, "accessLevel"));
        putIfPresent(sourceMetadata, "bureauCode", bureauCode);
        putIfPresent(sourceMetadata, "programCode", programCode);
        putIfPresent(sourceMetadata, "identifier", id);
        putIfPresent(sourceMetadata, "modified", sourceModified);
        putIfPresent(sourceMetadata, "landingPage", optionalText(dcat, "landingPage"));
        putIfPresent(sourceMetadata, "license", optionalText(dcat, "license"));
        putIfPresent(sourceMetadata, "doi", optionalText(dcat, "doi"));
        putIfPresent(sourceMetadata, "issued", optionalText(dcat, "issued"));
        putIfPresent(sourceMetadata, "lastHarvestedDate", optionalText(dataset, "last_harvested_date"));
        putIfPresent(sourceMetadata, "harvestRecord", optionalText(dataset, "harvest_record"));
        putIfPresent(sourceMetadata, "harvestRecordRaw", optionalText(dataset, "harvest_record_raw"));
        putIfPresent(sourceMetadata, "organizationSlug", optionalText(dataset.path("organization"), "slug"));
        putIfPresent(sourceMetadata, "organizationType", optionalText(dataset.path("organization"), "organization_type"));
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
                summary,
                publisher,
                program,
                ResearchObjectType.DATASET,
                catalogUri(slug, id),
                sourceUpdatedAt,
                OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC),
                ADAPTER_VERSION,
                List.of(),
                subjects(dataset, dcat),
                sourceMetadata);
    }

    private URI searchUri(String cursor, int perPage) {
        String delimiter = searchUrl.contains("?") ? "&" : "?";
        StringBuilder query = new StringBuilder("per_page=")
                .append(perPage)
                .append("&sort=last_harvested_date");
        if (cursor != null && !cursor.isBlank()) {
            query.append("&after=").append(encode(cursor.trim()));
        }
        return URI.create(searchUrl + delimiter + query);
    }

    private URI catalogUri(String slug, String id) {
        if (slug != null && !slug.isBlank()) {
            return URI.create(DEFAULT_CATALOG_BASE + "/dataset/" + encodePathSegment(slug));
        }
        return URI.create(DEFAULT_CATALOG_BASE + "/dataset/?id=" + encode(id));
    }

    private List<String> subjects(JsonNode dataset, JsonNode dcat) {
        Set<String> values = new LinkedHashSet<>();
        addTextArray(values, dataset.path("keyword"));
        addTextArray(values, dataset.path("theme"));
        addTextArray(values, dcat.path("keyword"));
        addTextArray(values, dcat.path("theme"));
        return List.copyOf(values);
    }

    private void addTextArray(Set<String> values, JsonNode node) {
        if (!node.isArray()) {
            return;
        }
        for (JsonNode item : node) {
            if (item.isTextual() && !item.asText().isBlank()) {
                values.add(item.asText().trim());
            }
        }
    }

    private List<Map<String, String>> resources(JsonNode dcat) {
        if (!dcat.path("distribution").isArray()) {
            return List.of();
        }
        List<Map<String, String>> resources = new ArrayList<>();
        for (JsonNode resource : dcat.path("distribution")) {
            if (resources.size() >= MAX_RESOURCE_LINKS_PER_RECORD) {
                break;
            }
            if (!resource.isObject()) {
                continue;
            }
            String url = firstNonBlank(optionalText(resource, "downloadURL"), optionalText(resource, "accessURL"));
            if (url.isBlank()) {
                continue;
            }
            Map<String, String> normalized = new LinkedHashMap<>();
            putIfPresent(normalized, "id", optionalText(resource, "identifier"));
            putIfPresent(normalized, "name", firstNonBlank(optionalText(resource, "title"), optionalText(resource, "description")));
            putIfPresent(normalized, "format", firstNonBlank(optionalText(resource, "format"), optionalText(resource, "mediaType")));
            normalized.put("url", url);
            resources.add(Map.copyOf(normalized));
        }
        return List.copyOf(resources);
    }

    private String firstArrayText(JsonNode node, String field) {
        JsonNode values = node.path(field);
        if (values.isArray()) {
            for (JsonNode value : values) {
                if (value.isTextual() && !value.asText().isBlank()) {
                    return value.asText().trim();
                }
            }
            return "";
        }
        return optionalText(node, field);
    }

    private String optionalIdentifier(JsonNode dataset) {
        return firstNonBlank(optionalText(dataset, "identifier"), optionalText(dataset.path("dcat"), "identifier"));
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
            } catch (DateTimeParseException ignoredLocalDateTime) {
                try {
                    return LocalDate.parse(value).atStartOfDay().atOffset(ZoneOffset.UTC);
                } catch (DateTimeParseException invalid) {
                    throw FederatedHarvestException.permanent("Data.gov modified timestamp is not valid: " + value);
                }
            }
        }
    }

    private String requiredFirst(String field, String... values) {
        String value = firstNonBlank(values);
        if (value.isBlank()) {
            throw FederatedHarvestException.permanent("Data.gov dataset is missing required field '" + field + "'.");
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
        return value.trim();
    }
}
