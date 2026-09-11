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
import org.civicsrepo.generated.dto.SearchMatchField;
import org.civicsrepo.generated.dto.SearchRelevanceBand;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SolrSearchClientCursorTest {
    private final AtomicReference<String> requestQuery = new AtomicReference<>();
    private final AtomicReference<String> responseBody = new AtomicReference<>();
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
    void firstCursorPageUsesUniqueIdTieBreakerAndReturnsNextMark() {
        responseBody.set(response("mark-2", document("alpha", 10.0), document("bravo", 7.0)));

        SearchContinuationExecution execution =
                client.searchWithContinuation(criteria("climate", 0, 2), null);

        assertThat(execution.response().getResults())
                .extracting((result) -> result.getId())
                .containsExactly("alpha", "bravo");
        assertThat(execution.response().getPage()).isZero();
        assertThat(execution.nextPosition()).isEqualTo("mark-2");
        assertThat(execution.hasMore()).isTrue();
        assertThat(execution.response().getRelevanceModel()).isNotNull();
        assertThat(execution.response().getRelevanceModel().getCalibrated()).isFalse();
        assertThat(execution.response().getResults().get(0).getRelevance().getBand())
                .isEqualTo(SearchRelevanceBand.STRONG);
        assertThat(execution.response().getResults().get(1).getRelevance().getBand())
                .isEqualTo(SearchRelevanceBand.GOOD);
        assertThat(execution.response().getResults().get(0).getMatchEvidence()).hasSize(2);
        assertThat(execution.response().getResults().get(0).getMatchEvidence().get(0).getField())
                .isEqualTo(SearchMatchField.TITLE);
        assertThat(execution.response().getResults().get(0).getMatchEvidence().get(0).getMatchedTerms())
                .containsExactly("climate");
        assertThat(execution.response().getResults().get(0).getMatchEvidence().get(1).getField())
                .isEqualTo(SearchMatchField.SUMMARY);

        String decodedQuery = URLDecoder.decode(requestQuery.get(), StandardCharsets.UTF_8);
        assertThat(decodedQuery)
                .contains(
                        "cursorMark=*",
                        "sort=score desc,id asc",
                        "rows=2",
                        "fl=*,score",
                        "hl=true",
                        "hl.method=unified",
                        "hl.fl=title_txt,geography_txt,subjects_txt,programName_s,authors_txt,summary_txt,citation_txt,publisher_txt")
                .doesNotContain("start=");
    }

    @Test
    void continuationUsesProvidedMarkAndStopsOnPartialFinalPage() {
        responseBody.set(response("mark-3", document("charlie", 5.0)));

        SearchContinuationExecution execution =
                client.searchWithContinuation(criteria("climate", 1, 2), "mark-2");

        assertThat(execution.response().getResults())
                .extracting((result) -> result.getId())
                .containsExactly("charlie");
        assertThat(execution.response().getPage()).isEqualTo(1);
        assertThat(execution.nextPosition()).isNull();
        assertThat(execution.hasMore()).isFalse();
        assertThat(execution.response().getResults().get(0).getRelevance().getBand())
                .isEqualTo(SearchRelevanceBand.MODERATE);

        String decodedQuery = URLDecoder.decode(requestQuery.get(), StandardCharsets.UTF_8);
        assertThat(decodedQuery)
                .contains("cursorMark=mark-2", "sort=score desc,id asc", "rows=2", "fl=*,score")
                .doesNotContain("start=");
    }

    @Test
    void repeatedSolrMarkIsTreatedAsExhaustedEvenWhenPageIsFull() {
        responseBody.set(response("mark-2", document("delta", 3.0), document("echo", 1.0)));

        SearchContinuationExecution execution =
                client.searchWithContinuation(criteria("climate", 2, 2), "mark-2");

        assertThat(execution.nextPosition()).isNull();
        assertThat(execution.hasMore()).isFalse();
        assertThat(execution.response().getResults().get(0).getRelevance().getBand())
                .isEqualTo(SearchRelevanceBand.WEAK);
        assertThat(execution.response().getResults().get(1).getRelevance().getBand())
                .isEqualTo(SearchRelevanceBand.LOW);
    }

    @Test
    void emptyDiscoveryBrowseDoesNotClaimRelevance() {
        responseBody.set(response("mark-2", document("alpha", 10.0)));

        SearchContinuationExecution execution =
                client.searchWithContinuation(criteria("", 0, 2), null);

        assertThat(execution.response().getRelevanceModel()).isNull();
        assertThat(execution.response().getResults().get(0).getRelevance()).isNull();
        assertThat(execution.response().getResults().get(0).getMatchEvidence()).isNullOrEmpty();

        String decodedQuery = URLDecoder.decode(requestQuery.get(), StandardCharsets.UTF_8);
        assertThat(decodedQuery).doesNotContain("fl=*,score", "hl=true");
    }

    private SearchComparisonCriteria criteria(String query, int page, int pageSize) {
        return new SearchComparisonCriteria(
                query,
                List.of(),
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                page,
                pageSize);
    }

    private String response(String nextCursorMark, String... documents) {
        return """
                {
                  "responseHeader": {"QTime": 4},
                  "nextCursorMark": "%s",
                  "response": {"numFound": 5, "maxScore": 10.0, "docs": [%s]},
                  "facet_counts": {
                    "facet_fields": {
                      "programName_s": [],
                      "publisher_s": [],
                      "sourceSystem_s": [],
                      "geography_s": [],
                      "contentType_s": [],
                      "vintageYear_i": []
                    }
                  },
                  "highlighting": {
                    "alpha": {
                      "title_txt": ["Alpha [[[climate]]] title"],
                      "summary_txt": ["[[[climate]]] summary"]
                    },
                    "bravo": {"title_txt": ["Bravo [[[climate]]] title"]},
                    "charlie": {"title_txt": ["Charlie [[[climate]]] title"]},
                    "delta": {"title_txt": ["Delta [[[climate]]] title"]},
                    "echo": {"title_txt": ["Echo [[[climate]]] title"]}
                  }
                }
                """.formatted(nextCursorMark, String.join(",", documents));
    }

    private String document(String id, double score) {
        return """
                {
                  "id": "%s",
                  "score": %s,
                  "title_s": "%s title",
                  "contentType_s": "DATASET",
                  "program_s": "TIGER_LINE",
                  "programName_s": "TIGER/Line",
                  "publisher_s": "U.S. Census Bureau",
                  "summary_txt": "Summary",
                  "sourceUrl_s": "https://example.test/%s",
                  "origin_s": "REPOSITORY",
                  "sourceSystem_s": "CENSUS",
                  "geography_s": "North Dakota",
                  "vintageYear_i": 2025,
                  "accessLevel_s": "PUBLIC"
                }
                """.formatted(id, score, id, id);
    }

    private void handleSearch(HttpExchange exchange) throws IOException {
        requestQuery.set(exchange.getRequestURI().getRawQuery());
        byte[] response = responseBody.get().getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(200, response.length);
        exchange.getResponseBody().write(response);
        exchange.close();
    }
}
