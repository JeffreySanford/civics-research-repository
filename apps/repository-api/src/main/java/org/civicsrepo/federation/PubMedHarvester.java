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
import java.time.Year;
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
 * Bounded PubMed E-utilities sampler.
 *
 * <p>This adapter exists for representative live federation samples, not full PubMed mirroring.
 * PubMed ESearch only exposes the first 10,000 matching IDs through ordinary retrieval; large-scale
 * research tiers should use NCBI's bulk/baseline distribution and update files rather than disguising
 * an API sampling path as a complete source crawl.
 */
@Component
public class PubMedHarvester implements FederatedSourceHarvester {
    static final int MAX_SOURCE_PAGE_SIZE = 500;
    static final int MAX_SAMPLE_OFFSET = 10_000;
    static final String ADAPTER_VERSION = "pubmed-eutils-sample-v1";
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(20);
    private static final String DEFAULT_EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

    private final String eutilsBase;
    private final String apiKey;
    private final String email;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    @Autowired
    public PubMedHarvester(
            @Value("${civics.federation.pubmed.eutils-base:https://eutils.ncbi.nlm.nih.gov/entrez/eutils}")
                    String eutilsBase,
            @Value("${civics.federation.pubmed.api-key:}") String apiKey,
            @Value("${civics.federation.pubmed.email:}") String email) {
        this(
                eutilsBase,
                apiKey,
                email,
                HttpClient.newBuilder().connectTimeout(REQUEST_TIMEOUT).build(),
                new ObjectMapper(),
                Clock.systemUTC());
    }

    PubMedHarvester(
            String eutilsBase,
            String apiKey,
            String email,
            HttpClient httpClient,
            ObjectMapper objectMapper,
            Clock clock) {
        this.eutilsBase = stripTrailingSlash(requireText(eutilsBase, "eutilsBase"));
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.email = email == null ? "" : email.trim();
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    @Override
    public FederatedSourceSystem sourceSystem() {
        return FederatedSourceSystem.PUBMED;
    }

    @Override
    public String adapterVersion() {
        return ADAPTER_VERSION;
    }

    @Override
    public HarvestPage fetch(String cursor, int pageSize) {
        int retstart = parseCursor(cursor);
        if (retstart >= MAX_SAMPLE_OFFSET) {
            throw FederatedHarvestException.permanent(
                    "PubMed live sampling reached the 10,000-record ESearch boundary; use the documented bulk baseline/update ingest path for larger tiers.");
        }
        int retmax = Math.max(1, Math.min(pageSize, MAX_SOURCE_PAGE_SIZE));
        JsonNode search = getJson(searchUri(retstart, retmax), "PubMed ESearch");
        JsonNode result = search.path("esearchresult");
        JsonNode ids = result.path("idlist");
        if (!ids.isArray()) {
            throw FederatedHarvestException.permanent("PubMed ESearch response is missing esearchresult.idlist.");
        }
        long total = parseLong(optionalText(result, "count"));
        if (ids.isEmpty()) {
            return new HarvestPage(List.of(), List.of(), null, true);
        }

        List<String> pmids = new ArrayList<>();
        for (JsonNode id : ids) {
            if (id.isTextual() && !id.asText().isBlank()) {
                pmids.add(id.asText().trim());
            }
        }
        JsonNode summary = getJson(summaryUri(pmids), "PubMed ESummary");
        JsonNode summaries = summary.path("result");
        if (!summaries.isObject()) {
            throw FederatedHarvestException.permanent("PubMed ESummary response is missing result.");
        }

        List<FederatedResearchRecord> records = new ArrayList<>();
        List<HarvestRejection> rejections = new ArrayList<>();
        for (String pmid : pmids) {
            JsonNode item = summaries.path(pmid);
            try {
                records.add(normalize(pmid, item));
            } catch (RuntimeException exception) {
                rejections.add(new HarvestRejection(pmid, message(exception), item.toString()));
            }
        }

        int nextOffset = retstart + pmids.size();
        boolean sourceExhausted = nextOffset >= total || pmids.size() < retmax;
        String nextCursor = sourceExhausted ? null : Integer.toString(nextOffset);
        return new HarvestPage(records, rejections, nextCursor, sourceExhausted);
    }

    private FederatedResearchRecord normalize(String pmid, JsonNode item) {
        if (!item.isObject()) {
            throw new IllegalArgumentException("PubMed ESummary is missing record " + pmid + ".");
        }
        String title = optionalText(item, "title");
        if (title == null) {
            throw new IllegalArgumentException("PubMed record " + pmid + " is missing title.");
        }
        String journal = firstNonBlank(
                optionalText(item, "fulljournalname"),
                optionalText(item, "source"),
                "PubMed");
        String pubDate = optionalText(item, "pubdate");
        String doi = articleIdentifier(item.path("articleids"), "doi");
        String pmc = articleIdentifier(item.path("articleids"), "pmc");

        Map<String, Object> metadata = new LinkedHashMap<>();
        putIfPresent(metadata, "doi", doi);
        putIfPresent(metadata, "pmc", pmc);
        putIfPresent(metadata, "publicationDate", pubDate);
        putIfPresent(metadata, "journal", journal);
        putIfPresent(metadata, "volume", optionalText(item, "volume"));
        putIfPresent(metadata, "issue", optionalText(item, "issue"));
        putIfPresent(metadata, "pages", optionalText(item, "pages"));
        metadata.put("publicationTypes", stringArray(item.path("pubtype")));

        return new FederatedResearchRecord(
                FederatedSourceSystem.PUBMED,
                pmid,
                title,
                "",
                journal,
                "Biomedical Literature",
                ResearchObjectType.PUBLICATION,
                URI.create("https://pubmed.ncbi.nlm.nih.gov/" + encodePathSegment(pmid) + "/"),
                parsePublicationDate(pubDate),
                OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC),
                ADAPTER_VERSION,
                authors(item.path("authors")),
                stringArray(item.path("pubtype")),
                metadata);
    }

    private List<String> authors(JsonNode node) {
        if (!node.isArray()) {
            return List.of();
        }
        List<String> authors = new ArrayList<>();
        for (JsonNode author : node) {
            String name = optionalText(author, "name");
            if (name != null) {
                authors.add(name);
            }
        }
        return List.copyOf(authors);
    }

    private String articleIdentifier(JsonNode node, String type) {
        if (!node.isArray()) {
            return null;
        }
        for (JsonNode identifier : node) {
            if (type.equalsIgnoreCase(firstNonBlank(optionalText(identifier, "idtype")))) {
                return optionalText(identifier, "value");
            }
        }
        return null;
    }

    private List<String> stringArray(JsonNode node) {
        if (!node.isArray()) {
            return List.of();
        }
        Set<String> values = new LinkedHashSet<>();
        for (JsonNode item : node) {
            if (item.isTextual() && !item.asText().isBlank()) {
                values.add(item.asText().trim());
            }
        }
        return List.copyOf(values);
    }

    private JsonNode getJson(URI uri, String source) {
        HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(REQUEST_TIMEOUT)
                .header("Accept", "application/json")
                .GET()
                .build();
        HttpResponse<String> response;
        try {
            response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw FederatedHarvestException.permanent(source + " request was interrupted.", exception);
        } catch (IOException exception) {
            throw FederatedHarvestException.retryable(source + " request failed.", exception, null);
        }

        int status = response.statusCode();
        if (status == 429 || status == 408 || status >= 500) {
            throw FederatedHarvestException.retryable(
                    source + " returned HTTP " + status + ".",
                    retryAfter(response));
        }
        if (status >= 300) {
            throw FederatedHarvestException.permanent(source + " returned HTTP " + status + ".");
        }
        try {
            return objectMapper.readTree(response.body());
        } catch (JsonProcessingException exception) {
            throw FederatedHarvestException.permanent(source + " returned invalid JSON.", exception);
        }
    }

    private URI searchUri(int retstart, int retmax) {
        StringBuilder query = new StringBuilder(eutilsBase)
                .append("/esearch.fcgi?db=pubmed&retmode=json&term=")
                .append(encode("all[sb]"))
                .append("&retstart=")
                .append(retstart)
                .append("&retmax=")
                .append(retmax)
                .append("&tool=civics-research-repository");
        appendIdentity(query);
        return URI.create(query.toString());
    }

    private URI summaryUri(List<String> pmids) {
        StringBuilder query = new StringBuilder(eutilsBase)
                .append("/esummary.fcgi?db=pubmed&retmode=json&id=")
                .append(encode(String.join(",", pmids)))
                .append("&tool=civics-research-repository");
        appendIdentity(query);
        return URI.create(query.toString());
    }

    private void appendIdentity(StringBuilder query) {
        if (!email.isBlank()) {
            query.append("&email=").append(encode(email));
        }
        if (!apiKey.isBlank()) {
            query.append("&api_key=").append(encode(apiKey));
        }
    }

    private int parseCursor(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return 0;
        }
        try {
            int offset = Integer.parseInt(cursor.trim());
            if (offset < 0) {
                throw new NumberFormatException("negative offset");
            }
            return offset;
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException("PubMed cursor must be a non-negative ESearch offset.", exception);
        }
    }

    private long parseLong(String value) {
        if (value == null) {
            return 0L;
        }
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException exception) {
            throw FederatedHarvestException.permanent("PubMed ESearch count is not numeric: " + value);
        }
    }

    private OffsetDateTime parsePublicationDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim();
        try {
            return LocalDate.parse(normalized).atStartOfDay().atOffset(ZoneOffset.UTC);
        } catch (DateTimeParseException ignored) {
            String yearText = normalized.length() >= 4 ? normalized.substring(0, 4) : normalized;
            try {
                return Year.parse(yearText).atDay(1).atStartOfDay().atOffset(ZoneOffset.UTC);
            } catch (DateTimeParseException invalid) {
                return null;
            }
        }
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

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private String encodePathSegment(String value) {
        return encode(value).replace("+", "%20");
    }

    private String stripTrailingSlash(String value) {
        String trimmed = value.trim();
        while (trimmed.endsWith("/")) {
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
