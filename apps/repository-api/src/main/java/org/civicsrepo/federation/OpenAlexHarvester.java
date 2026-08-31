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
import java.time.LocalDate;
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
 * Small-batch OpenAlex Works API harvester for source sampling and bounded research slices.
 *
 * <p>OpenAlex explicitly recommends its free public snapshot instead of API cursor crawling for
 * complete/bulk downloads. This adapter therefore exists to exercise the shared federation model and
 * retain bounded live samples. Future 10M/100M work should ingest a pinned OpenAlex snapshot manifest
 * instead of driving hundreds of thousands of REST calls.
 */
@Component
public class OpenAlexHarvester implements FederatedSourceHarvester {
    static final int MAX_SOURCE_PAGE_SIZE = 100;
    static final String ADAPTER_VERSION = "openalex-works-api-v1";
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(20);
    private static final String DEFAULT_WORKS_URL = "https://api.openalex.org/works";

    private final String worksUrl;
    private final String apiKey;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    @Autowired
    public OpenAlexHarvester(
            @Value("${civics.federation.openalex.works-url:https://api.openalex.org/works}") String worksUrl,
            @Value("${civics.federation.openalex.api-key:}") String apiKey) {
        this(
                worksUrl,
                apiKey,
                HttpClient.newBuilder().connectTimeout(REQUEST_TIMEOUT).build(),
                new ObjectMapper(),
                Clock.systemUTC());
    }

    OpenAlexHarvester(
            String worksUrl,
            String apiKey,
            HttpClient httpClient,
            ObjectMapper objectMapper,
            Clock clock) {
        this.worksUrl = stripTrailingQuestionMark(requireText(worksUrl, "worksUrl"));
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    @Override
    public FederatedSourceSystem sourceSystem() {
        return FederatedSourceSystem.OPENALEX;
    }

    @Override
    public String adapterVersion() {
        return ADAPTER_VERSION;
    }

    @Override
    public HarvestPage fetch(String cursor, int pageSize) {
        int perPage = Math.max(1, Math.min(pageSize, MAX_SOURCE_PAGE_SIZE));
        String effectiveCursor = cursor == null || cursor.isBlank() ? "*" : cursor.trim();
        HttpRequest request = HttpRequest.newBuilder(searchUri(effectiveCursor, perPage))
                .timeout(REQUEST_TIMEOUT)
                .header("Accept", "application/json")
                .GET()
                .build();

        HttpResponse<String> response;
        try {
            response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw FederatedHarvestException.permanent("OpenAlex harvest request was interrupted.", exception);
        } catch (IOException exception) {
            throw FederatedHarvestException.retryable("OpenAlex harvest request failed.", exception, null);
        }

        int status = response.statusCode();
        if (status == 429 || status == 408 || status >= 500) {
            throw FederatedHarvestException.retryable(
                    "OpenAlex API returned HTTP " + status + ".",
                    retryAfter(response));
        }
        if (status >= 300) {
            throw FederatedHarvestException.permanent("OpenAlex API returned HTTP " + status + ".");
        }

        return parsePage(response.body());
    }

    private HarvestPage parsePage(String body) {
        final JsonNode root;
        try {
            root = objectMapper.readTree(body);
        } catch (JsonProcessingException exception) {
            throw FederatedHarvestException.permanent("OpenAlex API returned invalid JSON.", exception);
        }
        JsonNode results = root.path("results");
        if (!root.isObject() || !results.isArray()) {
            throw FederatedHarvestException.permanent("OpenAlex API response is missing results.");
        }

        List<FederatedResearchRecord> records = new ArrayList<>();
        List<HarvestRejection> rejections = new ArrayList<>();
        for (JsonNode work : results) {
            try {
                records.add(normalize(work));
            } catch (RuntimeException exception) {
                rejections.add(new HarvestRejection(
                        shortOpenAlexId(optionalText(work, "id")),
                        message(exception),
                        work.toString()));
            }
        }

        String nextCursor = optionalText(root.path("meta"), "next_cursor");
        if (results.isEmpty()) {
            nextCursor = null;
        }
        return new HarvestPage(records, rejections, nextCursor, nextCursor == null);
    }

    private FederatedResearchRecord normalize(JsonNode work) {
        String id = shortOpenAlexId(requireField(work, "id"));
        String title = firstNonBlank(optionalText(work, "title"), optionalText(work, "display_name"));
        if (title.isBlank()) {
            throw new IllegalArgumentException("OpenAlex work is missing title/display_name.");
        }
        String type = optionalText(work, "type");
        JsonNode primaryLocation = work.path("primary_location");
        String sourceName = optionalText(primaryLocation.path("source"), "display_name");
        String publisher = firstNonBlank(sourceName, "OpenAlex");
        String topic = optionalText(work.path("primary_topic"), "display_name");
        String program = firstNonBlank(topic, sourceName, publisher);
        String publicationDate = optionalText(work, "publication_date");
        String updatedDate = optionalText(work, "updated_date");
        String doi = optionalText(work, "doi");

        Map<String, Object> metadata = new LinkedHashMap<>();
        putIfPresent(metadata, "doi", doi);
        putIfPresent(metadata, "type", type);
        putIfPresent(metadata, "publicationDate", publicationDate);
        putIfPresent(metadata, "updatedDate", updatedDate);
        putIfPresent(metadata, "primarySource", sourceName);
        putIfPresent(metadata, "primaryTopic", topic);
        metadata.put("citedByCount", work.path("cited_by_count").asLong(0));
        if (!work.path("open_access").isMissingNode() && !work.path("open_access").isNull()) {
            metadata.put("openAccess", objectMapper.convertValue(work.path("open_access"), Map.class));
        }

        return new FederatedResearchRecord(
                FederatedSourceSystem.OPENALEX,
                id,
                title,
                abstractText(work.path("abstract_inverted_index")),
                publisher,
                program,
                contentType(type),
                sourceUri(work, id),
                parseTimestamp(firstNonBlank(updatedDate, publicationDate)),
                OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC),
                ADAPTER_VERSION,
                authors(work.path("authorships")),
                subjects(work.path("topics")),
                metadata);
    }

    private ResearchObjectType contentType(String type) {
        String normalized = type == null ? "" : type.toLowerCase();
        if (normalized.contains("dataset")) {
            return ResearchObjectType.DATASET;
        }
        if (normalized.contains("software")) {
            return ResearchObjectType.CODE;
        }
        return ResearchObjectType.PUBLICATION;
    }

    private URI sourceUri(JsonNode work, String id) {
        String landing = optionalText(work.path("primary_location"), "landing_page_url");
        if (landing != null) {
            return URI.create(landing);
        }
        return URI.create("https://openalex.org/" + encodePathSegment(id));
    }

    private List<String> authors(JsonNode authorships) {
        if (!authorships.isArray()) {
            return List.of();
        }
        List<String> authors = new ArrayList<>();
        for (JsonNode authorship : authorships) {
            String name = optionalText(authorship.path("author"), "display_name");
            if (name != null) {
                authors.add(name);
            }
        }
        return List.copyOf(authors);
    }

    private List<String> subjects(JsonNode topics) {
        if (!topics.isArray()) {
            return List.of();
        }
        Set<String> subjects = new LinkedHashSet<>();
        for (JsonNode topic : topics) {
            String name = optionalText(topic, "display_name");
            if (name != null) {
                subjects.add(name);
            }
        }
        return List.copyOf(subjects);
    }

    private String abstractText(JsonNode invertedIndex) {
        if (!invertedIndex.isObject()) {
            return "";
        }
        Map<Integer, String> words = new java.util.TreeMap<>();
        invertedIndex.fields().forEachRemaining(entry -> {
            if (!entry.getValue().isArray()) {
                return;
            }
            for (JsonNode position : entry.getValue()) {
                if (position.canConvertToInt()) {
                    words.put(position.asInt(), entry.getKey());
                }
            }
        });
        return String.join(" ", words.values());
    }

    private URI searchUri(String cursor, int perPage) {
        String delimiter = worksUrl.contains("?") ? "&" : "?";
        StringBuilder query = new StringBuilder("per_page=")
                .append(perPage)
                .append("&cursor=")
                .append(encode(cursor))
                .append("&select=id,title,display_name,doi,type,publication_date,updated_date,primary_location,primary_topic,authorships,topics,open_access,cited_by_count,abstract_inverted_index");
        if (!apiKey.isBlank()) {
            query.append("&api_key=").append(encode(apiKey));
        }
        return URI.create(worksUrl + delimiter + query);
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
        } catch (DateTimeParseException ignored) {
            try {
                return LocalDate.parse(value).atStartOfDay().atOffset(ZoneOffset.UTC);
            } catch (DateTimeParseException invalid) {
                return null;
            }
        }
    }

    private String requireField(JsonNode node, String field) {
        String value = optionalText(node, field);
        if (value == null) {
            throw new IllegalArgumentException("OpenAlex work is missing required field '" + field + "'.");
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

    private String shortOpenAlexId(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        int slash = value.lastIndexOf('/');
        return slash >= 0 ? value.substring(slash + 1) : value;
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
