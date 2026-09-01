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
import java.util.concurrent.atomic.AtomicReference;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.generated.dto.SourceSystem;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class OpenSearchProjectionClientSearchTest {
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AtomicReference<String> requestBody = new AtomicReference<>();
    private HttpServer server;
    private OpenSearchProjectionClient client;

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/discovery-comparison/_search", this::handleSearch);
        server.start();
        client = new OpenSearchProjectionClient(
                "http://127.0.0.1:" + server.getAddress().getPort(), "discovery-comparison");
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    @Test
    void searchUsesDataDrivenProgramAndComparableSelfExcludingAggregations() throws Exception {
        SearchExecution execution = client.searchWithDiagnostics(new SearchComparisonCriteria(
                "reactor materials",
                List.of("Office of Science"),
                "Office of Science",
                SourceSystem.DOE_OSTI,
                "DOE_OSTI:12345",
                "10.11578/12345",
                null,
                ResearchObjectType.PUBLICATION,
                null,
                0,
                10));

        assertThat(execution.engineReportedMs()).isEqualTo(11L);

        JsonNode request = objectMapper.readTree(requestBody.get());
        JsonNode aggregations = request.path("aggs");

        assertThat(aggregations
                        .path("program_scope")
                        .path("aggs")
                        .path("values")
                        .path("terms")
                        .path("field")
                        .asText())
                .isEqualTo("programName");
        assertThat(aggregations
                        .path("publisher_scope")
                        .path("aggs")
                        .path("values")
                        .path("terms")
                        .path("field")
                        .asText())
                .isEqualTo("publisher.keyword");
        assertThat(aggregations
                        .path("sourceSystem_scope")
                        .path("aggs")
                        .path("values")
                        .path("terms")
                        .path("field")
                        .asText())
                .isEqualTo("sourceSystem");

        String programScope = aggregations.path("program_scope").path("filter").toString();
        assertThat(programScope)
                .doesNotContain("programName")
                .contains("publisher.keyword", "sourceSystem", "id", "doi", "contentType");

        String publisherScope = aggregations.path("publisher_scope").path("filter").toString();
        assertThat(publisherScope)
                .doesNotContain("publisher.keyword")
                .contains("sourceSystem", "id", "doi", "contentType");

        String sourceSystemScope = aggregations.path("sourceSystem_scope").path("filter").toString();
        assertThat(sourceSystemScope)
                .doesNotContain("sourceSystem")
                .contains("publisher.keyword", "id", "doi", "contentType");

        String postFilter = request.path("post_filter").toString();
        assertThat(postFilter)
                .contains(
                        "programName",
                        "Office of Science",
                        "publisher.keyword",
                        "sourceSystem",
                        "DOE_OSTI",
                        "id",
                        "DOE_OSTI:12345",
                        "doi",
                        "10.11578/12345",
                        "contentType",
                        "PUBLICATION");

        String query = request.path("query").toString();
        assertThat(query).contains("programName^3");

        assertThat(execution.response().getFacets())
                .filteredOn((facet) -> facet.getField().equals("publisher"))
                .singleElement()
                .satisfies((facet) -> assertThat(facet.getValues())
                        .singleElement()
                        .satisfies((value) -> {
                            assertThat(value.getValue()).isEqualTo("Office of Science");
                            assertThat(value.getSelected()).isTrue();
                        }));
        assertThat(execution.response().getFacets())
                .filteredOn((facet) -> facet.getField().equals("sourceSystem"))
                .singleElement()
                .satisfies((facet) -> assertThat(facet.getValues())
                        .singleElement()
                        .satisfies((value) -> {
                            assertThat(value.getValue()).isEqualTo("DOE_OSTI");
                            assertThat(value.getCount()).isEqualTo(2);
                            assertThat(value.getSelected()).isTrue();
                        }));
    }

    private void handleSearch(HttpExchange exchange) throws IOException {
        requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
        byte[] response = """
                {
                  "took": 11,
                  "hits": {"total": {"value": 0}, "hits": []},
                  "aggregations": {
                    "program_scope": {"values": {"buckets": []}},
                    "publisher_scope": {"values": {"buckets": [{"key": "Office of Science", "doc_count": 2}]}},
                    "sourceSystem_scope": {"values": {"buckets": [{"key": "DOE_OSTI", "doc_count": 2}]}},
                    "geography_scope": {"values": {"buckets": []}},
                    "contentType_scope": {"values": {"buckets": []}},
                    "vintageYear_scope": {"values": {"buckets": []}}
                  }
                }
                """.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(200, response.length);
        exchange.getResponseBody().write(response);
        exchange.close();
    }
}
