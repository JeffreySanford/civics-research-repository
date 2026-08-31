package org.civicsrepo.federation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class PubMedHarvesterTest {
    private static final Instant HARVESTED_AT = Instant.parse("2026-08-31T16:50:00Z");

    private final AtomicReference<Integer> responseStatus = new AtomicReference<>(200);
    private final AtomicReference<String> retryAfter = new AtomicReference<>();
    private final List<String> requestQueries = new ArrayList<>();
    private HttpServer server;
    private PubMedHarvester harvester;

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/entrez/eutils/esearch.fcgi", this::handleSearch);
        server.createContext("/entrez/eutils/esummary.fcgi", this::handleSummary);
        server.start();
        harvester = new PubMedHarvester(
                "http://127.0.0.1:" + server.getAddress().getPort() + "/entrez/eutils",
                "ncbi-test-key",
                "researcher@example.org",
                HttpClient.newHttpClient(),
                new ObjectMapper(),
                Clock.fixed(HARVESTED_AT, ZoneOffset.UTC));
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    @Test
    void normalizesBoundedPubMedSampleAndCarriesOffsetCursor() {
        HarvestPage page = harvester.fetch(null, 1_000);

        assertThat(page.complete()).isFalse();
        assertThat(page.nextCursor()).isEqualTo("2");
        assertThat(page.records()).hasSize(2);
        assertThat(page.rejections()).isEmpty();
        assertThat(requestQueries).hasSize(2);
        assertThat(requestQueries.get(0))
                .contains("db=pubmed", "retmode=json", "retstart=0", "retmax=500", "api_key=ncbi-test-key")
                .contains("email=researcher%40example.org");
        assertThat(requestQueries.get(1)).contains("id=12345%2C12346");

        FederatedResearchRecord article = page.records().getFirst();
        assertThat(article.sourceSystem()).isEqualTo(FederatedSourceSystem.PUBMED);
        assertThat(article.id()).isEqualTo("PUBMED:12345");
        assertThat(article.title()).isEqualTo("Open science in biomedical workforce research");
        assertThat(article.publisher()).isEqualTo("Journal of Biomedical Open Science");
        assertThat(article.program()).isEqualTo("Biomedical Literature");
        assertThat(article.contentType()).isEqualTo(ResearchObjectType.PUBLICATION);
        assertThat(article.sourceUrl().toString()).isEqualTo("https://pubmed.ncbi.nlm.nih.gov/12345/");
        assertThat(article.authors()).containsExactly("Researcher A", "Scientist G");
        assertThat(article.sourceMetadata())
                .containsEntry("doi", "10.1234/pubmed")
                .containsEntry("pmc", "PMC12345")
                .containsEntry("journal", "Journal of Biomedical Open Science");
    }

    @Test
    void supportsAnonymousLowRateSampling() {
        harvester = new PubMedHarvester(
                "http://127.0.0.1:" + server.getAddress().getPort() + "/entrez/eutils",
                "",
                "",
                HttpClient.newHttpClient(),
                new ObjectMapper(),
                Clock.fixed(HARVESTED_AT, ZoneOffset.UTC));

        harvester.fetch("50", 25);

        assertThat(requestQueries.getFirst())
                .contains("retstart=50", "retmax=25", "tool=civics-research-repository")
                .doesNotContain("api_key=", "email=");
    }

    @Test
    void refusesToPretendTheLiveSamplerCanCrossThePubMedBulkBoundary() {
        assertThatThrownBy(() -> harvester.fetch("10000", 100))
                .isInstanceOfSatisfying(FederatedHarvestException.class, exception -> {
                    assertThat(exception.retryable()).isFalse();
                    assertThat(exception.getMessage()).contains("10,000-record ESearch boundary");
                });
    }

    @Test
    void quarantinesMalformedSummaryWithoutDroppingOtherRecords() {
        HarvestPage page = harvester.fetch(null, 100);

        assertThat(page.records()).hasSize(2);
        assertThat(page.rejections()).isEmpty();
    }

    @Test
    void turnsNcbIRateLimitIntoRetryableFailure() {
        responseStatus.set(429);
        retryAfter.set("5");

        assertThatThrownBy(() -> harvester.fetch(null, 100))
                .isInstanceOfSatisfying(FederatedHarvestException.class, exception -> {
                    assertThat(exception.retryable()).isTrue();
                    assertThat(exception.retryAfter()).isEqualTo(Duration.ofSeconds(5));
                });
    }

    private void handleSearch(HttpExchange exchange) throws IOException {
        requestQueries.add(exchange.getRequestURI().getRawQuery());
        if (responseStatus.get() != 200) {
            respond(exchange, "{\"error\":\"rate limit\"}");
            return;
        }
        respond(exchange, """
                {
                  "esearchresult": {
                    "count": "40000000",
                    "retmax": "2",
                    "retstart": "0",
                    "idlist": ["12345", "12346"]
                  }
                }
                """);
    }

    private void handleSummary(HttpExchange exchange) throws IOException {
        requestQueries.add(exchange.getRequestURI().getRawQuery());
        respond(exchange, """
                {
                  "result": {
                    "uids": ["12345", "12346"],
                    "12345": {
                      "uid": "12345",
                      "title": "Open science in biomedical workforce research",
                      "pubdate": "2026 Aug 20",
                      "fulljournalname": "Journal of Biomedical Open Science",
                      "volume": "42",
                      "issue": "8",
                      "pages": "1-10",
                      "authors": [
                        {"name": "Researcher A"},
                        {"name": "Scientist G"}
                      ],
                      "articleids": [
                        {"idtype": "doi", "value": "10.1234/pubmed"},
                        {"idtype": "pmc", "value": "PMC12345"}
                      ],
                      "pubtype": ["Journal Article"]
                    },
                    "12346": {
                      "uid": "12346",
                      "title": "Second biomedical article",
                      "source": "Bio Journal",
                      "pubdate": "2025",
                      "authors": [],
                      "articleids": [],
                      "pubtype": ["Review"]
                    }
                  }
                }
                """);
    }

    private void respond(HttpExchange exchange, String body) throws IOException {
        if (retryAfter.get() != null) {
            exchange.getResponseHeaders().set("Retry-After", retryAfter.get());
        }
        byte[] response = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(responseStatus.get(), response.length);
        exchange.getResponseBody().write(response);
        exchange.close();
    }
}
