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
import java.util.concurrent.atomic.AtomicReference;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class OpenAlexHarvesterTest {
    private static final Instant HARVESTED_AT = Instant.parse("2026-08-31T16:30:00Z");

    private final AtomicReference<String> responseBody = new AtomicReference<>();
    private final AtomicReference<Integer> responseStatus = new AtomicReference<>(200);
    private final AtomicReference<String> retryAfter = new AtomicReference<>();
    private final AtomicReference<String> requestQuery = new AtomicReference<>();
    private HttpServer server;
    private OpenAlexHarvester harvester;

    @BeforeEach
    void startServer() throws IOException {
        responseBody.set("""
                {
                  "meta": {"count": 2, "next_cursor": "next-openalex-cursor"},
                  "results": [
                    {
                      "id": "https://openalex.org/W123",
                      "title": "Open science workforce study",
                      "doi": "https://doi.org/10.1234/openalex",
                      "type": "article",
                      "publication_date": "2026-08-01",
                      "updated_date": "2026-08-20T12:00:00Z",
                      "cited_by_count": 14,
                      "primary_location": {
                        "landing_page_url": "https://example.org/work/123",
                        "source": {"display_name": "Journal of Open Science"}
                      },
                      "primary_topic": {"display_name": "Scientific Workforce"},
                      "authorships": [
                        {"author": {"display_name": "Ada Researcher"}},
                        {"author": {"display_name": "Grace Scientist"}}
                      ],
                      "topics": [
                        {"display_name": "Scientific Workforce"},
                        {"display_name": "Open Science"}
                      ],
                      "open_access": {"is_oa": true, "oa_status": "gold"},
                      "abstract_inverted_index": {
                        "Open": [0],
                        "science": [1],
                        "matters": [2]
                      }
                    },
                    {
                      "id": "https://openalex.org/W124",
                      "display_name": "Research dataset",
                      "type": "dataset",
                      "primary_location": null,
                      "authorships": [],
                      "topics": []
                    }
                  ]
                }
                """);
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/works", this::handleWorks);
        server.start();
        harvester = new OpenAlexHarvester(
                "http://127.0.0.1:" + server.getAddress().getPort() + "/works",
                "test-key",
                HttpClient.newHttpClient(),
                new ObjectMapper(),
                Clock.fixed(HARVESTED_AT, ZoneOffset.UTC));
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    @Test
    void normalizesBoundedWorksPageAndCarriesCursor() {
        HarvestPage page = harvester.fetch(null, 1_000);

        assertThat(page.complete()).isFalse();
        assertThat(page.nextCursor()).isEqualTo("next-openalex-cursor");
        assertThat(page.records()).hasSize(2);
        assertThat(page.rejections()).isEmpty();
        assertThat(requestQuery.get()).contains("per_page=100", "cursor=*", "api_key=test-key");

        FederatedResearchRecord article = page.records().getFirst();
        assertThat(article.sourceSystem()).isEqualTo(FederatedSourceSystem.OPENALEX);
        assertThat(article.id()).isEqualTo("OPENALEX:W123");
        assertThat(article.title()).isEqualTo("Open science workforce study");
        assertThat(article.publisher()).isEqualTo("Journal of Open Science");
        assertThat(article.program()).isEqualTo("Scientific Workforce");
        assertThat(article.contentType()).isEqualTo(ResearchObjectType.PUBLICATION);
        assertThat(article.sourceUrl().toString()).isEqualTo("https://example.org/work/123");
        assertThat(article.summary()).isEqualTo("Open science matters");
        assertThat(article.authors()).containsExactly("Ada Researcher", "Grace Scientist");
        assertThat(article.subjects()).containsExactly("Scientific Workforce", "Open Science");
        assertThat(article.sourceMetadata()).containsEntry("citedByCount", 14L);

        FederatedResearchRecord dataset = page.records().get(1);
        assertThat(dataset.id()).isEqualTo("OPENALEX:W124");
        assertThat(dataset.contentType()).isEqualTo(ResearchObjectType.DATASET);
        assertThat(dataset.sourceUrl().toString()).isEqualTo("https://openalex.org/W124");
    }

    @Test
    void omitsApiKeyWhenNotConfiguredAndCompletesWhenCursorEnds() {
        responseBody.set("{\"meta\":{\"count\":0,\"next_cursor\":null},\"results\":[]}");
        harvester = new OpenAlexHarvester(
                "http://127.0.0.1:" + server.getAddress().getPort() + "/works",
                "",
                HttpClient.newHttpClient(),
                new ObjectMapper(),
                Clock.fixed(HARVESTED_AT, ZoneOffset.UTC));

        HarvestPage page = harvester.fetch("cursor-2", 25);

        assertThat(page.complete()).isTrue();
        assertThat(page.nextCursor()).isNull();
        assertThat(requestQuery.get()).contains("per_page=25", "cursor=cursor-2").doesNotContain("api_key=");
    }

    @Test
    void quarantinesMalformedWorkAndKeepsContinuation() {
        responseBody.set("""
                {
                  "meta": {"next_cursor": "next"},
                  "results": [{"title": "Missing OpenAlex id"}]
                }
                """);

        HarvestPage page = harvester.fetch(null, 10);

        assertThat(page.records()).isEmpty();
        assertThat(page.rejections()).hasSize(1);
        assertThat(page.rejections().getFirst().message()).contains("required field 'id'");
        assertThat(page.nextCursor()).isEqualTo("next");
    }

    @Test
    void turnsRateLimitIntoRetryableFailure() {
        responseStatus.set(429);
        retryAfter.set("3");
        responseBody.set("{\"error\":\"rate limit\"}");

        assertThatThrownBy(() -> harvester.fetch(null, 100))
                .isInstanceOfSatisfying(FederatedHarvestException.class, exception -> {
                    assertThat(exception.retryable()).isTrue();
                    assertThat(exception.retryAfter()).isEqualTo(Duration.ofSeconds(3));
                });
    }

    private void handleWorks(HttpExchange exchange) throws IOException {
        requestQuery.set(exchange.getRequestURI().getRawQuery());
        if (retryAfter.get() != null) {
            exchange.getResponseHeaders().set("Retry-After", retryAfter.get());
        }
        byte[] response = responseBody.get().getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(responseStatus.get(), response.length);
        exchange.getResponseBody().write(response);
        exchange.close();
    }
}
