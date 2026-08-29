package org.civicsrepo.federation;

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
import java.util.OptionalLong;
import org.civicsrepo.search.OpenSearchProjectionClient;
import org.civicsrepo.search.SolrSearchClient;
import org.springframework.stereotype.Component;

/**
 * Reads engine-owned index storage statistics without confusing them with publisher source bytes.
 *
 * <p>These are operational measurements of the application-owned search projections. They are
 * deliberately separate from SourceInventory, which measures the remote files referenced by
 * research metadata.
 */
@Component
public class SearchIndexStorageProbe {
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(5);

    private final SolrSearchClient solr;
    private final OpenSearchProjectionClient openSearch;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public SearchIndexStorageProbe(SolrSearchClient solr, OpenSearchProjectionClient openSearch) {
        this(solr, openSearch, HttpClient.newBuilder().connectTimeout(REQUEST_TIMEOUT).build(), new ObjectMapper());
    }

    SearchIndexStorageProbe(
            SolrSearchClient solr,
            OpenSearchProjectionClient openSearch,
            HttpClient httpClient,
            ObjectMapper objectMapper) {
        this.solr = solr;
        this.openSearch = openSearch;
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
    }

    public OptionalLong solrIndexBytes() {
        if (!solr.isEnabled()) {
            return OptionalLong.empty();
        }
        String uri = stripTrailingSlash(solr.baseUrl())
                + "/admin/cores?action=STATUS&core="
                + encode(solr.indexName())
                + "&indexInfo=true&wt=json";
        return readLong(URI.create(uri), (root) -> root.path("status")
                .path(solr.indexName())
                .path("index")
                .path("sizeInBytes"));
    }

    public OptionalLong openSearchIndexBytes() {
        if (!openSearch.isEnabled()) {
            return OptionalLong.empty();
        }
        String uri = stripTrailingSlash(openSearch.baseUrl())
                + "/"
                + encode(openSearch.indexName())
                + "/_stats/store";
        return readLong(URI.create(uri),
                (root) -> root.path("_all").path("total").path("store").path("size_in_bytes"));
    }

    private OptionalLong readLong(URI uri, JsonSelector selector) {
        try {
            HttpRequest request = HttpRequest.newBuilder(uri).timeout(REQUEST_TIMEOUT).GET().build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 300) {
                return OptionalLong.empty();
            }
            JsonNode value = selector.select(objectMapper.readTree(response.body()));
            if (!value.isNumber()) {
                return OptionalLong.empty();
            }
            long bytes = value.asLong(-1L);
            return bytes < 0 ? OptionalLong.empty() : OptionalLong.of(bytes);
        } catch (IOException | InterruptedException | RuntimeException exception) {
            if (exception instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            return OptionalLong.empty();
        }
    }

    private String stripTrailingSlash(String value) {
        return value == null ? "" : value.replaceAll("/+$", "");
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    @FunctionalInterface
    private interface JsonSelector {
        JsonNode select(JsonNode root);
    }
}
