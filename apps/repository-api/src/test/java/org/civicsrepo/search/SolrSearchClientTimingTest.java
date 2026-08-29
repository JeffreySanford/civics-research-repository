package org.civicsrepo.search;

import static org.assertj.core.api.Assertions.assertThat;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SolrSearchClientTimingTest {
    private HttpServer server;
    private SolrSearchClient client;

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/solr/discovery/select", this::handleSearch);
        server.start();
        client = new SolrSearchClient("http://127.0.0.1:" + server.getAddress().getPort() + "/solr", "discovery");
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    @Test
    void capturesQTimeFromTheSameResponseAsTheSearchResults() {
        SearchExecution execution = client.searchWithDiagnostics("", List.of(), null, null, null, 0, 10);

        assertThat(execution.engineReportedMs()).isEqualTo(7L);
        assertThat(execution.response().getTotalResults()).isZero();
    }

    private void handleSearch(HttpExchange exchange) throws IOException {
        byte[] response = """
                {
                  "responseHeader": {"status": 0, "QTime": 7},
                  "response": {"numFound": 0, "docs": []},
                  "facet_counts": {
                    "facet_fields": {
                      "program_s": [],
                      "geography_s": [],
                      "contentType_s": [],
                      "vintageYear_i": []
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
