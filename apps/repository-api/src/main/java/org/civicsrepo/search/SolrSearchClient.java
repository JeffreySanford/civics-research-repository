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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class SolrSearchClient {
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(5);

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
            ResearchProgram program,
            String geography,
            Integer vintageYear,
            int page,
            int pageSize) {
        try {
            HttpRequest request = HttpRequest.newBuilder(selectUri(query, program, geography, vintageYear, page, pageSize))
                    .timeout(REQUEST_TIMEOUT)
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 300) {
                throw new IllegalStateException("Solr search failed with HTTP " + response.statusCode());
            }

            return toSearchResponse(query, page, pageSize, program, geography, response.body());
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
            ResearchProgram selectedProgram,
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

            return new SearchResponse(
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
                                    selectedProgram == null ? "" : selectedProgram.name()),
                            facetGroup(
                                    "geography",
                                    "Geography",
                                    root.path("facet_counts").path("facet_fields").path("geography_s"),
                                    selectedGeography == null ? "" : selectedGeography)));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Solr search response could not be parsed.", exception);
        }
    }

    private FacetGroup facetGroup(String field, String label, JsonNode values, String selectedValue) {
        List<FacetValue> facets = new ArrayList<>();
        String normalizedSelected = normalize(selectedValue);

        for (int index = 0; index + 1 < values.size(); index += 2) {
            String value = values.get(index).asText();
            facets.add(new FacetValue(
                    value,
                    value.replace('_', ' '),
                    values.get(index + 1).asLong(),
                    normalize(value).equals(normalizedSelected)));
        }

        return new FacetGroup(field, label, facets);
    }

    private URI updateUri() {
        return URI.create(baseUrl + "/" + encode(core) + "/update?commit=true&overwrite=true");
    }

    private URI selectUri(
            String query,
            ResearchProgram program,
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
        params.add("facet.field=program_s");
        params.add("facet.field=geography_s");

        if (program != null) {
            params.add("fq=" + encode("program_s:" + program.name()));
        }

        if (!normalize(geography).isBlank()) {
            params.add("fq=" + encode("geography_s:\"" + geography + "\""));
        }

        if (vintageYear != null) {
            params.add("fq=" + encode("vintageYear_i:" + vintageYear));
        }

        return URI.create(baseUrl + "/" + encode(core) + "/select?" + String.join("&", params));
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
