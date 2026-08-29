package org.civicsrepo.federation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import org.civicsrepo.search.OpenSearchProjectionClient;
import org.civicsrepo.search.SolrSearchClient;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SearchIndexStorageProbeTest {
    private HttpServer server;
    private SearchIndexStorageProbe probe;

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/solr/admin/cores", this::handleSolrStatus);
        server.createContext("/discovery-comparison/_stats/store", this::handleOpenSearchStats);
        server.start();
        String baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
        probe = new SearchIndexStorageProbe(
                new SolrSearchClient(baseUrl + "/solr", "discovery"),
                new OpenSearchProjectionClient(baseUrl, "discovery-comparison"));
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    @Test
    void readsSolrCoreIndexBytesFromCoreAdminStatus() {
        assertEquals(123_456L, probe.solrIndexBytes().orElseThrow());
    }

    @Test
    void readsOpenSearchStoreBytesFromIndexStats() {
        assertEquals(987_654L, probe.openSearchIndexBytes().orElseThrow());
    }

    @Test
    void disabledTargetsReportUnknownRatherThanZero() {
        SearchIndexStorageProbe disabled = new SearchIndexStorageProbe(
                new SolrSearchClient("", "discovery"), new OpenSearchProjectionClient("", "discovery-comparison"));
        assertTrue(disabled.solrIndexBytes().isEmpty());
        assertTrue(disabled.openSearchIndexBytes().isEmpty());
    }

    private void handleSolrStatus(HttpExchange exchange) throws IOException {
        byte[] response = """
                {
                  "status": {
                    "discovery": {
                      "index": {"sizeInBytes": 123456}
                    }
                  }
                }
                """.getBytes(StandardCharsets.UTF_8);
        respond(exchange, response);
    }

    private void handleOpenSearchStats(HttpExchange exchange) throws IOException {
        byte[] response = """
                {
                  "_all": {
                    "total": {
                      "store": {"size_in_bytes": 987654}
                    }
                  }
                }
                """.getBytes(StandardCharsets.UTF_8);
        respond(exchange, response);
    }

    private void respond(HttpExchange exchange, byte[] response) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(200, response.length);
        exchange.getResponseBody().write(response);
        exchange.close();
    }
}
