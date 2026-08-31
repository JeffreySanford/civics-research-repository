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
import java.util.List;
import java.util.Map;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Bounded DOE OSTI metadata harvester backed by the public OSTI.GOV v1 records API.
 *
 * <p>OSTI remains authoritative for the referenced research output. The local catalog retains
 * normalized metadata, provenance and links only; full text and other binaries stay at OSTI or the
 * publisher. OSTI's API uses page-number pagination rather than an opaque search-after token, so the
 * adapter fixes the source order to ascending {@code osti_id} and records its page number as the
 * durable cursor. Snapshot hashing remains the final reproducibility boundary for retained evidence.
 */
@Component
public class OstiGovHarvester implements FederatedSourceHarvester {
    static final int MAX_SOURCE_PAGE_SIZE = 1_000;
    static final String ADAPTER_VERSION = "osti-gov-api-v1-v1";
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(20);
    private static final String DEFAULT_RECORDS_URL = "https://www.osti.gov/api/v1/records";
    private static final String DEFAULT_BIBLIO_BASE = "https://www.osti.gov/biblio/";

    private final String recordsUrl;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    @Autowired
    public OstiGovHarvester(
            @Value("${civics.federation.osti.records-url:https://www.osti.gov/api/v1/records}")
                    String recordsUrl) {
        this(
                recordsUrl,
                HttpClient.newBuilder().connectTimeout(REQUEST_TIMEOUT).build(),
                new ObjectMapper(),
                Clock.systemUTC());
    }

    OstiGovHarvester(String recordsUrl, HttpClient httpClient, ObjectMapper objectMapper, Clock clock) {
        this.recordsUrl = stripTrailingQuestionMark(requireText(recordsUrl, "recordsUrl"));
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    @Override
    public FederatedSourceSystem sourceSystem() {
        return FederatedSourceSystem.DOE_OSTI;
    }

    @Override
    public String adapterVersion() {
        return ADAPTER_VERSION;
    }

    @Override
    public HarvestPage fetch(String cursor, int pageSize) {
        int rows = Math.max(1, Math.min(pageSize, MAX_SOURCE_PAGE_SIZE));
        int page = parsePageCursor(cursor);
        HttpRequest request = HttpRequest.newBuilder(searchUri(page, rows))
                .timeout(REQUEST_TIMEOUT)
                .header("Accept", "application/json")
                .GET()
                .build();

        HttpResponse<String> response;
        try {
            response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw FederatedHarvestException.permanent("OSTI.GOV harvest request was interrupted.", exception);
        } catch (IOException exception) {
            throw FederatedHarvestException.retryable("OSTI.GOV harvest request failed.", exception, null);
        }

        int status = response.statusCode();
        if (status == 429 || status == 408 || status >= 500) {
            throw FederatedHarvestException.retryable(
                    "OSTI.GOV API returned HTTP " + status + ".",
                    retryAfter(response));
        }
        if (status >= 300) {
            throw FederatedHarvestException.permanent("OSTI.GOV API returned HTTP " + status + ".");
        }

        return parsePage(response.body(), response.headers().firstValue("Link").orElse(null), page);
    }

    private HarvestPage parsePage(String body, String linkHeader, int page) {
        final JsonNode root;
        try {
            root = objectMapper.readTree(body);
        } catch (JsonProcessingException exception) {
            throw FederatedHarvestException.permanent("OSTI.GOV API returned invalid JSON.", exception);
        }
        if (!root.isArray()) {
            throw FederatedHarvestException.permanent("OSTI.GOV API response must be a JSON array.");
        }

        List<FederatedResearchRecord> records = new ArrayList<>();
        List<HarvestRejection> rejections = new ArrayList<>();
        for (JsonNode item : root) {
            try {
                records.add(normalize(item));
            } catch (RuntimeException exception) {
                rejections.add(new HarvestRejection(
                        optionalText(item, "osti_id"),
                        message(exception),
                        item.toString()));
            }
        }

        boolean hasNext = hasNextLink(linkHeader);
        if (root.isEmpty() && hasNext) {
            throw FederatedHarvestException.permanent(
                    "OSTI.GOV returned an empty page while advertising a next page.");
        }
        return new HarvestPage(
                records,
                rejections,
                hasNext ? Integer.toString(page + 1) : null,
                !hasNext);
    }

    private FederatedResearchRecord normalize(JsonNode record) {
        String ostiId = requireField(record, "osti_id");
        String title = requireField(record, "title");
        String productType = optionalText(record, "product_type");
        String researchOrg = optionalText(record, "research_org");
        String sponsorOrg = optionalText(record, "sponsor_org");
        String publisher = firstNonBlank(
                optionalText(record, "publisher"),
                researchOrg,
                "DOE Office of Scientific and Technical Information");
        String program = firstNonBlank(sponsorOrg, researchOrg, publisher);
        String entryDate = optionalText(record, "entry_date");
        String publicationDate = optionalText(record, "publication_date");
        List<Map<String, String>> links = links(record.path("links"));

        Map<String, Object> metadata = new LinkedHashMap<>();
        putIfPresent(metadata, "doi", optionalText(record, "doi"));
        putIfPresent(metadata, "publicationDate", publicationDate);
        putIfPresent(metadata, "entryDate", entryDate);
        putIfPresent(metadata, "productType", productType);
        putIfPresent(metadata, "researchOrg", researchOrg);
        putIfPresent(metadata, "sponsorOrg", sponsorOrg);
        putIfPresent(metadata, "journalName", optionalText(record, "journal_name"));
        putIfPresent(metadata, "journalVolume", optionalText(record, "journal_volume"));
        putIfPresent(metadata, "journalIssue", optionalText(record, "journal_issue"));
        putIfPresent(metadata, "reportNumber", optionalText(record, "report_number"));
        putIfPresent(metadata, "doeContractNumber", optionalText(record, "doe_contract_number"));
        putIfPresent(metadata, "language", optionalText(record, "language"));
        if (!links.isEmpty()) {
            metadata.put("links", links);
        }

        return new FederatedResearchRecord(
                FederatedSourceSystem.DOE_OSTI,
                ostiId,
                title,
                optionalText(record, "description"),
                publisher,
                program,
                contentType(productType),
                citationUri(ostiId, links),
                parseTimestamp(firstNonBlank(entryDate, publicationDate)),
                OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC),
                ADAPTER_VERSION,
                stringList(record.path("authors")),
                stringList(record.path("subjects")),
                metadata);
    }

    private ResearchObjectType contentType(String productType) {
        String normalized = productType == null ? "" : productType.trim().toLowerCase();
        if (normalized.contains("dataset") || normalized.equals("data")) {
            return ResearchObjectType.DATASET;
        }
        if (normalized.contains("software") || normalized.contains("computer program")) {
            return ResearchObjectType.CODE;
        }
        return ResearchObjectType.PUBLICATION;
    }

    private URI citationUri(String ostiId, List<Map<String, String>> links) {
        for (Map<String, String> link : links) {
            if ("citation".equalsIgnoreCase(link.get("rel")) && link.get("href") != null) {
                return URI.create(link.get("href"));
            }
        }
        return URI.create(DEFAULT_BIBLIO_BASE + encodePathSegment(ostiId));
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
            link.put("href", href);
            links.add(Map.copyOf(link));
        }
        return List.copyOf(links);
    }

    private List<String> stringList(JsonNode node) {
        if (!node.isArray()) {
            return List.of();
        }
        List<String> values = new ArrayList<>();
        for (JsonNode item : node) {
            if (item.isTextual() && !item.asText().isBlank()) {
                values.add(item.asText().trim());
            }
        }
        return List.copyOf(values);
    }

    private URI searchUri(int page, int rows) {
        String delimiter = recordsUrl.contains("?") ? "&" : "?";
        return URI.create(recordsUrl + delimiter + "rows=" + rows + "&page=" + page + "&sort=osti_id&order=asc");
    }

    private int parsePageCursor(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return 1;
        }
        try {
            int page = Integer.parseInt(cursor.trim());
            if (page < 1) {
                throw new NumberFormatException("page must be positive");
            }
            return page;
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException("OSTI.GOV cursor must be a positive page number.", exception);
        }
    }

    private boolean hasNextLink(String linkHeader) {
        return linkHeader != null && linkHeader.contains("rel=\"next\"");
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
            } catch (DateTimeParseException ignoredLocal) {
                try {
                    return LocalDate.parse(value).atStartOfDay().atOffset(ZoneOffset.UTC);
                } catch (DateTimeParseException invalidDate) {
                    return null;
                }
            }
        }
    }

    private String requireField(JsonNode node, String field) {
        String value = optionalText(node, field);
        if (value == null) {
            throw new IllegalArgumentException("OSTI.GOV record is missing required field '" + field + "'.");
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
