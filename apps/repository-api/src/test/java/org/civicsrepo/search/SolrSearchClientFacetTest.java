package org.civicsrepo.search;

import static org.assertj.core.api.Assertions.assertThat;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.civicsrepo.generated.dto.SourceSystem;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SolrSearchClientFacetTest {
    private final AtomicReference<String> requestQuery = new AtomicReference<>();
    private HttpServer server;
    private SolrSearchClient client;

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/solr/discovery/select", this::handleSearch);
        server.start();
        client = new SolrSearchClient(
                "http://127.0.0.1:" + server.getAddress().getPort() + "/solr", "discovery");
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    @Test
    void returnsPublisherAndSourceSystemFacetsFromIndexedFields() {
        SearchExecution execution = client.searchWithDiagnostics(new SearchComparisonCriteria(
                "",
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

        assertThat(execution.engineReportedMs()).isEqualTo(7L);
        assertThat(execution.response().getFacets())
                .filteredOn((facet) -> facet.getField().equals("publisher"))
                .singleElement()
                .satisfies((facet) -> assertThat(facet.getValues())
                        .singleElement()
                        .satisfies((value) -> {
                            assertThat(value.getValue()).isEqualTo("Office of Science");
                            assertThat(value.getCount()).isEqualTo(2);
                            assertThat(value.getSelected()).isTrue();
                        }));
        assertThat(execution.response().getFacets())
                .filteredOn((facet) -> facet.getField().equals("sourceSystem"))
                .singleElement()
                .satisfies((facet) -> assertThat(facet.getValues())
                        .singleElement()
                        .satisfies((value) -> {
                            assertThat(value.getValue()).isEqualTo("DOE_OSTI");
                            assertThat(value.getSelected()).isTrue();
                        }));

        String decodedQuery = URLDecoder.decode(requestQuery.get(), StandardCharsets.UTF_8);
        assertThat(decodedQuery)
                .contains(
                        "facet.field={!ex=publisherFilter}publisher_s",
                        "facet.field={!ex=sourceSystemFilter}sourceSystem_s",
                        "fq={!tag=publisherFilter}publisher_s:\"Office of Science\"",
                        "fq={!tag=sourceSystemFilter}sourceSystem_s:\"DOE_OSTI\"",
                        "fq=id:\"DOE_OSTI:12345\"",
                        "fq=doi_s:\"10.11578/12345\"");
    }

    private void handleSearch(HttpExchange exchange) throws IOException {
        requestQuery.set(exchange.getRequestURI().getRawQuery());
        byte[] response = """
                {
                  "responseHeader": {"QTime": 7},
                  "response": {"numFound": 0, "docs": []},
                  "facet_counts": {
                    "facet_fields": {
                      "programName_s": [],
                      "publisher_s": ["Office of Science", 2],
                      "sourceSystem_s": ["DOE_OSTI", 2],
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
