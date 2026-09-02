package org.civicsrepo.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class OpenSearchProjectionClientCursorTest {
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final List<String> requestBodies = new ArrayList<>();
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
    void continuesWithLastSortTupleWithoutUsingDeepOffset() throws Exception {
        SearchContinuationExecution first = client.searchWithContinuation(criteria(0), null);

        assertThat(first.response().getResults())
                .extracting((result) -> result.getId())
                .containsExactly("DATA_GOV:a", "DATA_GOV:b");
        assertThat(first.nextPosition()).isEqualTo("[4.0,\"DATA_GOV:b\"]");
        assertThat(first.engineReportedMs()).isEqualTo(9L);

        JsonNode firstRequest = objectMapper.readTree(requestBodies.get(0));
        assertThat(firstRequest.has("from")).isFalse();
        assertThat(firstRequest.has("search_after")).isFalse();
        assertThat(firstRequest.path("sort").toString())
                .isEqualTo("[{\"_score\":\"desc\"},{\"id\":\"asc\"}]");

        SearchContinuationExecution second =
                client.searchWithContinuation(criteria(1), first.nextPosition());

        assertThat(second.response().getResults())
                .extracting((result) -> result.getId())
                .containsExactly("DATA_GOV:c");
        assertThat(second.nextPosition()).isNull();

        JsonNode secondRequest = objectMapper.readTree(requestBodies.get(1));
        assertThat(secondRequest.has("from")).isFalse();
        assertThat(secondRequest.path("search_after").toString())
                .isEqualTo("[4.0,\"DATA_GOV:b\"]");
    }

    @Test
    void rejectsNonArraySearchAfterStateBeforeCallingOpenSearch() {
        assertThatThrownBy(() -> client.searchWithContinuation(criteria(1), "{}"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("JSON array");
        assertThat(requestBodies).isEmpty();
    }

    private SearchComparisonCriteria criteria(int page) {
        return new SearchComparisonCriteria(
                "climate",
                List.of(),
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                page,
                2);
    }

    private void handleSearch(HttpExchange exchange) throws IOException {
        String requestBody = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        requestBodies.add(requestBody);
        JsonNode request = objectMapper.readTree(requestBody);
        boolean continuing = request.has("search_after");

        String hits = continuing
                ? """
                  {
                    "took": 7,
                    "hits": {
                      "total": {"value": 3},
                      "hits": [
                        {
                          "_score": 3.0,
                          "sort": [3.0, "DATA_GOV:c"],
                          "_source": %s
                        }
                      ]
                    },
                    %s
                  }
                  """.formatted(document("DATA_GOV:c", "C"), aggregations())
                : """
                  {
                    "took": 9,
                    "hits": {
                      "total": {"value": 3},
                      "hits": [
                        {
                          "_score": 5.0,
                          "sort": [5.0, "DATA_GOV:a"],
                          "_source": %s
                        },
                        {
                          "_score": 4.0,
                          "sort": [4.0, "DATA_GOV:b"],
                          "_source": %s
                        }
                      ]
                    },
                    %s
                  }
                  """.formatted(document("DATA_GOV:a", "A"), document("DATA_GOV:b", "B"), aggregations());

        byte[] response = hits.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(200, response.length);
        exchange.getResponseBody().write(response);
        exchange.close();
    }

    private String document(String id, String suffix) {
        return """
               {
                 "id": "%s",
                 "title": "Climate record %s",
                 "contentType": "DATASET",
                 "program": "OTHER",
                 "programName": "Climate",
                 "publisher": "Data.gov",
                 "summary": "Fixture %s",
                 "sourceUrl": "https://example.test/%s",
                 "origin": "FEDERATED",
                 "sourceSystem": "DATA_GOV",
                 "accessLevel": "PUBLIC"
               }
               """.formatted(id, suffix, suffix, suffix.toLowerCase());
    }

    private String aggregations() {
        return """
               "aggregations": {
                 "program_scope": {"values": {"buckets": []}},
                 "publisher_scope": {"values": {"buckets": []}},
                 "sourceSystem_scope": {"values": {"buckets": []}},
                 "geography_scope": {"values": {"buckets": []}},
                 "contentType_scope": {"values": {"buckets": []}},
                 "vintageYear_scope": {"values": {"buckets": []}}
               }
               """;
    }
}
