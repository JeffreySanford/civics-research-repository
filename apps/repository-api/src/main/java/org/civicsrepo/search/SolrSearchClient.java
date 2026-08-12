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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.civicsrepo.repository.RepositorySource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class SolrSearchClient {
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

    public boolean isEnabled() {
        return !baseUrl.isBlank() && !core.isBlank();
    }

    public void indexResearchObjects(List<SearchResult> results) {
        if (!isEnabled()) {
            return;
        }

        try {
            List<Map<String, Object>> documents = results.stream().map(this::toSolrDocument).toList();
            sendUpdate(Map.of("delete", Map.of("query", "repositorySeed_b:true")));
            sendUpdate(documents);
        } catch (IOException exception) {
            throw new IllegalStateException("Solr update request failed.", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Solr update request was interrupted.", exception);
        }
    }

    private void sendUpdate(Object payload) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(updateUri())
                .timeout(REQUEST_TIMEOUT)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
                .build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() >= 300) {
            throw new IllegalStateException("Solr update failed with HTTP " + response.statusCode());
        }
    }

    public SearchResponse search(
            String query,
            List<ResearchProgram> programs,
            String geography,
            Integer vintageYear,
            int page,
            int pageSize) {
        try {
            HttpRequest request = HttpRequest.newBuilder(selectUri(query, programs, geography, vintageYear, page, pageSize))
                    .timeout(REQUEST_TIMEOUT)
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 300) {
                throw new IllegalStateException("Solr search failed with HTTP " + response.statusCode());
            }

            return toSearchResponse(query, page, pageSize, programs, geography, response.body());
        } catch (IOException exception) {
            throw new IllegalStateException("Solr search request failed.", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Solr search request was interrupted.", exception);
        }
    }

    private Map<String, Object> toSolrDocument(SearchResult result) {
        Map<String, Object> document = new LinkedHashMap<>();
        document.put("id", result.id());
        document.put("title_txt", result.title());
        document.put("title_s", result.title());
        document.put("contentType_s", result.contentType().name());
        document.put("program_s", result.program().name());
        document.put("publisher_txt", result.publisher());
        document.put("publisher_s", result.publisher());
        document.put("summary_txt", result.summary());
        document.put("geography_txt", result.geography());
        document.put("geography_s", result.geography());
        document.put("vintageYear_i", result.vintageYear());
        document.put("sourceUrl_s", result.sourceUrl());
        document.put("repositorySeed_b", true);
        return document;
    }

    private SearchResponse toSearchResponse(
            String query,
            int page,
            int pageSize,
            List<ResearchProgram> selectedPrograms,
            String selectedGeography,
            String responseBody) {
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode response = root.path("response");
            List<SearchResult> results = new ArrayList<>();

            for (JsonNode document : response.path("docs")) {
                results.add(new SearchResult(
                        text(document, "id"),
                        text(document, "title_s"),
                        ResearchObjectType.valueOf(text(document, "contentType_s")),
                        ResearchProgram.valueOf(text(document, "program_s")),
                        text(document, "publisher_s"),
                        text(document, "summary_txt"),
                        text(document, "geography_s"),
                        integer(document, "vintageYear_i"),
                        text(document, "sourceUrl_s")));
            }

            // Conservative default. The client cannot know what was projected into the core, so
            // SearchService relabels via withResultSource; FIXTURE is the safe assumption if it does not.
            return new SearchResponse(
                    RepositorySource.FIXTURE,
                    query == null ? "" : query,
                    Math.max(0, page),
                    Math.max(1, Math.min(pageSize, 100)),
                    response.path("numFound").asLong(),
                    results,
                    List.of(
                            facetGroup(
                                    "program",
                                    "Program",
                                    root.path("facet_counts").path("facet_fields").path("program_s"),
                                    selectedPrograms.stream()
                                            .map((program) -> normalize(program.name()))
                                            .collect(Collectors.toSet())),
                            facetGroup(
                                    "geography",
                                    "Geography",
                                    root.path("facet_counts").path("facet_fields").path("geography_s"),
                                    normalize(selectedGeography).isBlank()
                                            ? Set.of()
                                            : Set.of(normalize(selectedGeography)))));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Solr search response could not be parsed.", exception);
        }
    }

    private FacetGroup facetGroup(String field, String label, JsonNode values, Set<String> normalizedSelected) {
        List<FacetValue> facets = new ArrayList<>();

        for (int index = 0; index + 1 < values.size(); index += 2) {
            String value = values.get(index).asText();
            facets.add(new FacetValue(
                    value,
                    value.replace('_', ' '),
                    values.get(index + 1).asLong(),
                    normalizedSelected.contains(normalize(value))));
        }

        return new FacetGroup(field, label, facets);
    }

    private URI updateUri() {
        return URI.create(baseUrl + "/" + encode(core) + "/update?commit=true&overwrite=true");
    }

    private URI selectUri(
            String query,
            List<ResearchProgram> programs,
            String geography,
            Integer vintageYear,
            int page,
            int pageSize) {
        int safePage = Math.max(0, page);
        int safePageSize = Math.max(1, Math.min(pageSize, 100));
        List<String> params = new ArrayList<>();
        params.add("wt=json");
        params.add("defType=edismax");
        params.add("qf=" + encode("title_txt summary_txt publisher_txt program_s geography_txt"));
        params.add("q=" + encode(normalize(query).isBlank() ? "*:*" : query));
        params.add("start=" + encode(Integer.toString(safePage * safePageSize)));
        params.add("rows=" + encode(Integer.toString(safePageSize)));
        params.add("facet=true");
        params.add("facet.mincount=1");
        // Facets exclude their own filter. Solr computes facet counts after filter queries, so a
        // plain facet.field would collapse the program list to whatever is already selected and
        // leave no way to add a fourth program. Tagging each filter and excluding it from the
        // matching facet keeps every option visible with its unfiltered count.
        params.add("facet.field=" + encode("{!ex=programFilter}program_s"));
        params.add("facet.field=" + encode("{!ex=geographyFilter}geography_s"));

        if (!programs.isEmpty()) {
            // One fq with an OR clause, not one fq per program: separate filter queries are ANDed,
            // which would return nothing whenever more than one program is selected.
            params.add("fq="
                    + encode(programs.stream()
                            .map((program) -> "program_s:" + program.name())
                            .collect(Collectors.joining(" OR ", "{!tag=programFilter}(", ")"))));
        }

        if (!normalize(geography).isBlank()) {
            params.add("fq="
                    + encode("{!tag=geographyFilter}geography_s:\"" + escapeQueryValue(geography) + "\""));
        }

        if (vintageYear != null) {
            params.add("fq=" + encode("vintageYear_i:" + vintageYear));
        }

        return URI.create(baseUrl + "/" + encode(core) + "/select?" + String.join("&", params));
    }

    /**
     * Escapes Lucene query syntax in a caller-supplied filter value.
     *
     * <p>{@code geography} arrives straight from a request parameter and is interpolated into an
     * {@code fq} phrase. Without escaping, a quote closes the phrase early and the remainder is
     * parsed as query syntax, which can widen the filter past what the caller asked for or fail the
     * request outright. URL encoding does not help here: Solr decodes the parameter before parsing
     * it.
     *
     * <p>Only the backslash and quote are escaped. The value is always wrapped in quotes, so every
     * other Lucene operator — including the spaces in values such as {@code North Dakota} — is
     * already inert inside the phrase, and escaping them would change what matches.
     */
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
