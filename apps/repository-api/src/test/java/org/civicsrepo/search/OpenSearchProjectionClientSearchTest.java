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
        SearchExecution execution = client.searchWithDiagnostics(
                "reactor materials",
                List.of("Office of Science"),
                null,
                ResearchObjectType.PUBLICATION,
                null,
                0,
                10);

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

        String programScope = aggregations.path("program_scope").path("filter").toString();
        assertThat(programScope).doesNotContain("programName").contains("contentType");

        String postFilter = request.path("post_filter").toString();
        assertThat(postFilter).contains("programName", "Office of Science", "contentType", "PUBLICATION");

        String query = request.path("query").toString();
        assertThat(query).contains("programName^3");
    }

    private void handleSearch(HttpExchange exchange) throws IOException {
        requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
        byte[] response = """
                {
                  "took": 11,
                  "hits": {"total": {"value": 0}, "hits": []},
                  "aggregations": {
                    "program_scope": {"values": {"buckets": []}},
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
