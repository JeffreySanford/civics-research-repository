package org.civicsrepo.search;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class OpenSearchC21OptimizedClientTest {
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AtomicReference<String> requestBody = new AtomicReference<>();
    private HttpServer server;
    private OpenSearchC21OptimizedClient client;

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/discovery-comparison/_search", this::handleSearch);
        server.start();
        client = new OpenSearchC21OptimizedClient(
                "http://127.0.0.1:" + server.getAddress().getPort(), "discovery-comparison");
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    @Test
    void unfilteredTreatmentUsesDirectTermsWithoutMatchAllFacetWrappers() {
        Map<String, Object> request = client.requestForTest(criteria(List.of()));
        JsonNode aggregations = objectMapper.valueToTree(request.get("aggs"));

        assertThat(aggregations.size()).isEqualTo(6);
        assertThat(aggregations.path("program_scope").path("terms").path("field").asText())
                .isEqualTo("programName");
        assertThat(aggregations.path("publisher_scope").path("terms").path("field").asText())
                .isEqualTo("publisher.keyword");
        assertThat(aggregations.toString()).doesNotContain("match_all", "c2_1_shared_scope");
    }

    @Test
    void programFilterKeepsProgramFacetSelfExcludingAndSharesTheOtherFiveScopes() {
        Map<String, Object> request = client.requestForTest(criteria(List.of("Office of Science")));
        JsonNode root = objectMapper.valueToTree(request);
        JsonNode aggregations = root.path("aggs");

        assertThat(aggregations.path("program_scope").path("terms").path("field").asText())
                .isEqualTo("programName");
        assertThat(aggregations.path("program_scope").has("filter")).isFalse();

        JsonNode shared = aggregations.path("c2_1_shared_scope_01");
        assertThat(shared.path("filter").toString()).contains("programName", "Office of Science");
        assertThat(shared.path("aggs").size()).isEqualTo(5);
        assertThat(shared.path("aggs").path("publisher_scope").path("terms").path("field").asText())
                .isEqualTo("publisher.keyword");
        assertThat(shared.path("aggs").path("sourceSystem_scope").path("terms").path("field").asText())
                .isEqualTo("sourceSystem");
        assertThat(root.path("post_filter").toString()).contains("programName", "Office of Science");
    }

    @Test
    void optimizedResponseParsesDirectAndSharedFacetBucketsIntoTheNormalApiShape() {
        SearchExecution execution = client.searchWithDiagnostics(criteria(List.of("Office of Science")));

        assertThat(execution.engineReportedMs()).isEqualTo(7L);
        assertThat(execution.response().getTotalResults()).isEqualTo(2);
        assertThat(execution.response().getFacets())
                .filteredOn((facet) -> facet.getField().equals("program"))
                .singleElement()
                .satisfies((facet) -> assertThat(facet.getValues())
                        .singleElement()
                        .satisfies((value) -> {
                            assertThat(value.getValue()).isEqualTo("Office of Science");
                            assertThat(value.getCount()).isEqualTo(12);
                            assertThat(value.getSelected()).isTrue();
                        }));
        assertThat(execution.response().getFacets())
                .filteredOn((facet) -> facet.getField().equals("publisher"))
                .singleElement()
                .satisfies((facet) -> assertThat(facet.getValues())
                        .singleElement()
                        .satisfies((value) -> {
                            assertThat(value.getValue()).isEqualTo("Department of Energy");
                            assertThat(value.getCount()).isEqualTo(2);
                            assertThat(value.getSelected()).isFalse();
                        }));

        JsonNode request;
        try {
            request = objectMapper.readTree(requestBody.get());
        } catch (IOException exception) {
            throw new AssertionError(exception);
        }
        assertThat(request.path("aggs").toString()).contains("c2_1_shared_scope_01");
    }

    private SearchComparisonCriteria criteria(List<String> programs) {
        return new SearchComparisonCriteria(
                "North Dakota workforce",
                programs,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                0,
                10);
    }

    private void handleSearch(HttpExchange exchange) throws IOException {
        requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
        byte[] response = """
                {
                  "took": 7,
                  "hits": {"total": {"value": 2}, "hits": []},
                  "aggregations": {
                    "program_scope": {
                      "buckets": [{"key": "Office of Science", "doc_count": 12}]
                    },
                    "c2_1_shared_scope_01": {
                      "doc_count": 2,
                      "publisher_scope": {
                        "buckets": [{"key": "Department of Energy", "doc_count": 2}]
                      },
                      "sourceSystem_scope": {"buckets": []},
                      "geography_scope": {"buckets": []},
                      "contentType_scope": {"buckets": []},
                      "vintageYear_scope": {"buckets": []}
                    }
                  }
                }
                """.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(200, response.length);
        exchange.getResponseBody().write(response);
        exchange.close();
    }
}
