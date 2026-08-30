package org.civicsrepo.search;

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
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.civicsrepo.generated.dto.AccessLevel;
import org.civicsrepo.generated.dto.FacetGroup;
import org.civicsrepo.generated.dto.FacetValue;
import org.civicsrepo.generated.dto.RepositorySource;
import org.civicsrepo.generated.dto.ResearchObjectOrigin;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.generated.dto.ResearchProgram;
import org.civicsrepo.generated.dto.SearchResponse;
import org.civicsrepo.generated.dto.SearchResult;
import org.civicsrepo.generated.dto.SourceSystem;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class SolrSearchClient implements DiscoveryIndex {
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(5);
    private static final String PHRASE_SYNTAX_CHARACTERS = "\\\"";

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String baseUrl;
    private final String core;

    public SolrSearchClient(
            @Value("${civics.solr.base-url:}") String baseUrl,
            @Value("${civics.solr.core:discovery}") String core) {
        this.objectMapper = new ObjectMapper();
        this.httpClient = HttpClient.newBuilder().connectTimeout(REQUEST_TIMEOUT).build();
        this.baseUrl = stripTrailingSlash(baseUrl);
        this.core = core;
    }

    @Override
    public boolean isEnabled() {
        return !baseUrl.isBlank() && !core.isBlank();
    }

    @Override
    public String baseUrl() {
        return baseUrl;
    }

    @Override
    public String indexName() {
        return core;
    }

    @Override
    public boolean isReachable() {
        return documentCount().isPresent();
    }

    @Override
    public Optional<Integer> documentCount() {
        if (!isEnabled()) {
            return Optional.empty();
        }

        try {
            HttpRequest request = HttpRequest.newBuilder(countUri())
                    .timeout(REQUEST_TIMEOUT)
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 300) {
                return Optional.empty();
            }
            JsonNode root = objectMapper.readTree(response.body());
            return Optional.of(Math.max(0, root.path("response").path("numFound").asInt(0)));
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            return Optional.empty();
        }
    }

    /** Legacy curated program counts used by the repository/admin overview. */
    @Override
    public Map<ResearchProgram, Integer> programFacetCounts() {
        if (!isEnabled()) {
            return Map.of();
        }

        try {
            String uri = baseUrl + "/" + encode(core)
                    + "/select?q=*:*&rows=0&wt=json&facet=true&facet.mincount=1&facet.field="
                    + encode("program_s");
            HttpRequest request = HttpRequest.newBuilder(URI.create(uri))
                    .timeout(REQUEST_TIMEOUT)
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 300) {
                return Map.of();
            }
            JsonNode values = objectMapper
                    .readTree(response.body())
                    .path("facet_counts")
                    .path("facet_fields")
                    .path("program_s");
            Map<ResearchProgram, Integer> counts = new LinkedHashMap<>();
            for (int index = 0; index + 1 < values.size(); index += 2) {
                String programValue = values.get(index).asText();
                int count = values.get(index + 1).asInt();
                try {
                    counts.put(ResearchProgram.fromValue(programValue), count);
                } catch (IllegalArgumentException exception) {
                    counts.put(ResearchProgram.OTHER, counts.getOrDefault(ResearchProgram.OTHER, 0) + count);
                }
            }
            return counts;
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            return Map.of();
        }
    }

    @Override
    public void beginProjection() {
        if (!isEnabled()) {
            return;
        }
        sendProjectionUpdate(Map.of("delete", Map.of("query", "repositorySeed_b:true")));
    }

    @Override
    public void indexBatch(List<DiscoveryDocument> objects) {
        if (!isEnabled() || objects == null || objects.isEmpty()) {
            return;
        }
        List<Map<String, Object>> documents = objects.stream().map(this::toSolrDocument).toList();
        sendProjectionUpdate(documents);
    }

    @Override
    public void completeProjection() {
        if (!isEnabled()) {
            return;
        }
        sendProjectionUpdate(Map.of("commit", Map.of()));
    }

    @Override
    public void abortProjection() {
        if (!isEnabled()) {
            return;
        }
        sendProjectionUpdate(Map.of("rollback", Map.of()));
    }

    private void sendProjectionUpdate(Object payload) {
        try {
            HttpRequest request = HttpRequest.newBuilder(updateUri())
                    .timeout(REQUEST_TIMEOUT)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 300) {
                throw new IllegalStateException("Solr update failed with HTTP " + response.statusCode());
            }
        } catch (IOException exception) {
            throw new IllegalStateException("Solr update request failed.", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Solr update request was interrupted.", exception);
        }
    }

    @Override
    public SearchResponse search(
            String query,
            List<String> programs,
            String geography,
            ResearchObjectType contentType,
            Integer vintageYear,
            int page,
            int pageSize) {
        return searchWithDiagnostics(query, programs, geography, contentType, vintageYear, page, pageSize).response();
    }

    @Override
    public SearchExecution searchWithDiagnostics(
            String query,
            List<String> programs,
            String geography,
            ResearchObjectType contentType,
            Integer vintageYear,
            int page,
            int pageSize) {
        try {
            HttpRequest request = HttpRequest.newBuilder(
                            selectUri(query, programs, geography, contentType, vintageYear, page, pageSize))
                    .timeout(REQUEST_TIMEOUT)
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 300) {
                throw new IllegalStateException("Solr search failed with HTTP " + response.statusCode());
            }

            String responseBody = response.body();
            return new SearchExecution(
                    toSearchResponse(query, page, pageSize, programs, geography, contentType, vintageYear, responseBody),
                    engineReportedMillis(responseBody));
        } catch (IOException exception) {
            throw new IllegalStateException("Solr search request failed.", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Solr search request was interrupted.", exception);
        }
    }

    private Map<String, Object> toSolrDocument(DiscoveryDocument object) {
        SearchResult result = object.result();
        Map<String, Object> document = new LinkedHashMap<>();
        document.put("id", result.getId());
        document.put("title_txt", result.getTitle());
        document.put("title_s", result.getTitle());
        document.put("contentType_s", result.getContentType().getValue());
        document.put("program_s", result.getProgram().getValue());
        document.put("programName_s", object.programName());
        document.put("publisher_txt", result.getPublisher());
        document.put("publisher_s", result.getPublisher());
        document.put("summary_txt", result.getSummary());
        document.put("geography_txt", result.getGeography());
        document.put("geography_s", result.getGeography());
        document.put("vintageYear_i", result.getVintageYear());
        document.put(
                "accessLevel_s",
                (result.getAccessLevel() == null ? AccessLevel.PUBLIC : result.getAccessLevel()).getValue());
        document.put("sourceUrl_s", result.getSourceUrl());
        document.put("origin_s", result.getOrigin().getValue());
        document.put("sourceSystem_s", result.getSourceSystem().getValue());
        document.put("repositorySeed_b", true);

        if (!object.subjects().isEmpty()) {
            document.put("subjects_txt", object.subjects());
        }
        if (!object.authors().isEmpty()) {
            document.put("authors_txt", object.authors());
        }
        if (object.citation() != null && !object.citation().isBlank()) {
            document.put("citation_txt", object.citation());
        }
        if (object.doi() != null && !object.doi().isBlank()) {
            document.put("doi_s", object.doi());
        }

        return document;
    }

    private SearchResponse toSearchResponse(
            String query,
            int page,
            int pageSize,
            List<String> selectedPrograms,
            String selectedGeography,
            ResearchObjectType selectedContentType,
            Integer selectedVintageYear,
            String responseBody) {
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode response = root.path("response");
            List<SearchResult> results = new ArrayList<>();

            for (JsonNode document : response.path("docs")) {
                results.add(new SearchResult(
                                text(document, "id"),
                                text(document, "title_s"),
                                ResearchObjectType.fromValue(text(document, "contentType_s")),
                                ResearchProgram.fromValue(text(document, "program_s")),
                                text(document, "publisher_s"),
                                text(document, "summary_txt"),
                                URI.create(text(document, "sourceUrl_s")),
                                ResearchObjectOrigin.fromValue(text(document, "origin_s")),
                                SourceSystem.fromValue(text(document, "sourceSystem_s")))
                        .programName(text(document, "programName_s"))
                        .geography(text(document, "geography_s"))
                        .vintageYear(integer(document, "vintageYear_i"))
                        .accessLevel(accessLevel(document)));
            }

            return new SearchResponse(
                    RepositorySource.FIXTURE,
                    query == null ? "" : query,
                    Math.max(0, page),
                    Math.max(1, Math.min(pageSize, 100)),
                    Math.toIntExact(response.path("numFound").asLong()),
                    results,
                    List.of(
                            facetGroup(
                                    "program",
                                    "Program",
                                    root.path("facet_counts").path("facet_fields").path("programName_s"),
                                    selectedPrograms.stream()
                                            .map(this::normalize)
                                            .collect(Collectors.toSet())),
                            facetGroup(
                                    "geography",
                                    "Geography",
                                    root.path("facet_counts").path("facet_fields").path("geography_s"),
                                    normalize(selectedGeography).isBlank()
                                            ? Set.of()
                                            : Set.of(normalize(selectedGeography))),
                            facetGroup(
                                    "type",
                                    "Type",
                                    root.path("facet_counts").path("facet_fields").path("contentType_s"),
                                    selectedContentType == null
                                            ? Set.of()
                                            : Set.of(normalize(selectedContentType.getValue()))),
                            descending(facetGroup(
                                    "vintageYear",
                                    "Year",
                                    root.path("facet_counts").path("facet_fields").path("vintageYear_i"),
                                    selectedVintageYear == null
                                            ? Set.of()
                                            : Set.of(normalize(String.valueOf(selectedVintageYear)))))));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Solr search response could not be parsed.", exception);
        }
    }

    private Long engineReportedMillis(String responseBody) {
        try {
            JsonNode qTime = objectMapper.readTree(responseBody).path("responseHeader").path("QTime");
            return qTime.isNumber() ? Math.max(0L, qTime.asLong()) : null;
        } catch (JsonProcessingException exception) {
            return null;
        }
    }

    private AccessLevel accessLevel(JsonNode document) {
        String value = text(document, "accessLevel_s");
        if (value == null || value.isBlank()) {
            return AccessLevel.PUBLIC;
        }
        try {
            return AccessLevel.fromValue(value);
        } catch (IllegalArgumentException exception) {
            return AccessLevel.RESTRICTED;
        }
    }

    private FacetGroup descending(FacetGroup group) {
        List<FacetValue> reversed = new ArrayList<>(group.getValues());
        Collections.reverse(reversed);
        return new FacetGroup(group.getField(), group.getLabel(), reversed);
    }

    private FacetGroup facetGroup(String field, String label, JsonNode values, Set<String> normalizedSelected) {
        List<FacetValue> facets = new ArrayList<>();

        for (int index = 0; index + 1 < values.size(); index += 2) {
            String value = values.get(index).asText();
            facets.add(new FacetValue(
                    value,
                    value.replace('_', ' '),
                    values.get(index + 1).asInt(),
                    normalizedSelected.contains(normalize(value))));
        }

        return new FacetGroup(field, label, facets);
    }

    private URI updateUri() {
        return URI.create(baseUrl + "/" + encode(core) + "/update?commit=false&overwrite=true");
    }

    private URI countUri() {
        return URI.create(baseUrl + "/" + encode(core) + "/select?q=*:*&rows=0&wt=json");
    }

    private URI selectUri(
            String query,
            List<String> programs,
            String geography,
            ResearchObjectType contentType,
            Integer vintageYear,
            int page,
            int pageSize) {
        int safePage = Math.max(0, page);
        int safePageSize = Math.max(1, Math.min(pageSize, 100));
        List<String> params = new ArrayList<>();
        params.add("wt=json");
        params.add("defType=edismax");
        params.add("qf="
                + encode("title_txt^5 geography_txt^4 subjects_txt^3 programName_s^3 "
                        + "authors_txt^3 summary_txt^2 citation_txt^1 publisher_txt^0.5"));
        params.add("pf=" + encode("title_txt^8 geography_txt^6 summary_txt^2"));
        params.add("pf2=" + encode("title_txt^4 geography_txt^4"));
        params.add("mm=" + encode("2<67%"));
        params.add("q=" + encode(normalize(query).isBlank() ? "*:*" : query));
        params.add("start=" + encode(Integer.toString(safePage * safePageSize)));
        params.add("rows=" + encode(Integer.toString(safePageSize)));
        params.add("facet=true");
        params.add("facet.mincount=1");
        params.add("facet.field=" + encode("{!ex=programFilter}programName_s"));
        params.add("facet.field=" + encode("{!ex=geographyFilter}geography_s"));
        params.add("facet.field=" + encode("{!ex=typeFilter}contentType_s"));
        params.add("facet.field=" + encode("{!ex=vintageFilter}vintageYear_i"));
        params.add("f.vintageYear_i.facet.sort=" + encode("index"));

        if (programs != null && !programs.isEmpty()) {
            params.add("fq="
                    + encode(programs.stream()
                            .filter((program) -> program != null && !program.isBlank())
                            .map((program) -> "programName_s:\"" + escapeQueryValue(program.trim()) + "\"")
                            .collect(Collectors.joining(" OR ", "{!tag=programFilter}(", ")"))));
        }

        if (!normalize(geography).isBlank()) {
            params.add("fq="
                    + encode("{!tag=geographyFilter}geography_s:\"" + escapeQueryValue(geography) + "\""));
        }

        if (vintageYear != null) {
            params.add("fq=" + encode("{!tag=vintageFilter}vintageYear_i:" + vintageYear));
        }

        if (contentType != null) {
            params.add("fq="
                    + encode("{!tag=typeFilter}contentType_s:\"" + escapeQueryValue(contentType.getValue()) + "\""));
        }

        return URI.create(baseUrl + "/" + encode(core) + "/select?" + String.join("&", params));
    }

    static String escapeQueryValue(String value) {
        if (value == null) {
            return "";
        }

        StringBuilder escaped = new StringBuilder(value.length() + 8);
        for (char character : value.toCharArray()) {
            if (PHRASE_SYNTAX_CHARACTERS.indexOf(character) >= 0) {
                escaped.append('\\');
            }
            escaped.append(character);
        }
        return escaped.toString();
    }

    private String text(JsonNode document, String field) {
        JsonNode value = document.path(field);
        if (value.isArray() && !value.isEmpty()) {
            return value.get(0).asText();
        }
        return value.asText();
    }

    private Integer integer(JsonNode document, String field) {
        JsonNode value = document.path(field);
        if (value.isArray() && !value.isEmpty()) {
            return value.get(0).asInt();
        }
        return value.isMissingNode() || value.isNull() ? null : value.asInt();
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase();
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
}
