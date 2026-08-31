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
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class OstiGovHarvesterTest {
    private static final Instant HARVESTED_AT = Instant.parse("2026-08-31T16:15:00Z");

    private final AtomicReference<String> responseBody = new AtomicReference<>();
    private final AtomicReference<Integer> responseStatus = new AtomicReference<>(200);
    private final AtomicReference<String> linkHeader = new AtomicReference<>();
    private final AtomicReference<String> retryAfter = new AtomicReference<>();
    private final AtomicReference<String> requestQuery = new AtomicReference<>();
    private HttpServer server;
    private OstiGovHarvester harvester;

    @BeforeEach
    void startServer() throws IOException {
        responseBody.set("""
                [
                  {
                    "osti_id": "12345",
                    "title": "DOE-funded workforce modeling study",
                    "description": "A reproducible research result.",
                    "publisher": "Office of Scientific and Technical Information",
                    "research_org": "Oak Ridge National Laboratory",
                    "sponsor_org": "USDOE Office of Science",
                    "entry_date": "2026-08-20",
                    "publication_date": "2026-08-01",
                    "product_type": "Journal Article",
                    "doi": "10.1234/example",
                    "authors": ["Researcher, Ada", "Scientist, Grace"],
                    "subjects": ["WORKFORCE", "MODELING"],
                    "links": [
                      {"rel": "citation", "href": "https://www.osti.gov/biblio/12345"},
                      {"rel": "fulltext", "href": "https://www.osti.gov/servlets/purl/12345"}
                    ]
                  },
                  {
                    "osti_id": "12346",
                    "title": "Simulation package",
                    "research_org": "Argonne National Laboratory",
                    "product_type": "Software"
                  }
                ]
                """);
        linkHeader.set("<https://www.osti.gov/api/v1/records?rows=1000&page=2>; rel=\"next\"");
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/v1/records", this::handleRecords);
        server.start();
        harvester = new OstiGovHarvester(
                "http://127.0.0.1:" + server.getAddress().getPort() + "/api/v1/records",
                HttpClient.newHttpClient(),
                new ObjectMapper(),
                Clock.fixed(HARVESTED_AT, ZoneOffset.UTC));
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    @Test
    void normalizesOstiRecordsAndUsesStableAscendingPageOrder() {
        HarvestPage page = harvester.fetch(null, 5_000);

        assertThat(page.complete()).isFalse();
        assertThat(page.nextCursor()).isEqualTo("2");
        assertThat(page.records()).hasSize(2);
        assertThat(page.rejections()).isEmpty();
        assertThat(requestQuery.get()).contains("rows=1000", "page=1", "sort=osti_id", "order=asc");

        FederatedResearchRecord publication = page.records().getFirst();
        assertThat(publication.sourceSystem()).isEqualTo(FederatedSourceSystem.DOE_OSTI);
        assertThat(publication.id()).isEqualTo("DOE_OSTI:12345");
        assertThat(publication.title()).isEqualTo("DOE-funded workforce modeling study");
        assertThat(publication.publisher()).isEqualTo("Office of Scientific and Technical Information");
        assertThat(publication.program()).isEqualTo("USDOE Office of Science");
        assertThat(publication.contentType()).isEqualTo(ResearchObjectType.PUBLICATION);
        assertThat(publication.sourceUrl().toString()).isEqualTo("https://www.osti.gov/biblio/12345");
        assertThat(publication.sourceUpdatedAt().toInstant()).isEqualTo(Instant.parse("2026-08-20T00:00:00Z"));
        assertThat(publication.harvestedAt().toInstant()).isEqualTo(HARVESTED_AT);
        assertThat(publication.adapterVersion()).isEqualTo(OstiGovHarvester.ADAPTER_VERSION);
        assertThat(publication.authors()).containsExactly("Researcher, Ada", "Scientist, Grace");
        assertThat(publication.subjects()).containsExactly("WORKFORCE", "MODELING");
        assertThat(publication.sourceMetadata())
                .containsEntry("doi", "10.1234/example")
                .containsEntry("productType", "Journal Article")
                .containsEntry("researchOrg", "Oak Ridge National Laboratory")
                .containsEntry("sponsorOrg", "USDOE Office of Science");

        @SuppressWarnings("unchecked")
        List<Map<String, String>> links = (List<Map<String, String>>) publication.sourceMetadata().get("links");
        assertThat(links).hasSize(2);
        assertThat(links.get(1)).containsEntry("rel", "fulltext");

        FederatedResearchRecord software = page.records().get(1);
        assertThat(software.contentType()).isEqualTo(ResearchObjectType.CODE);
        assertThat(software.publisher()).isEqualTo("Argonne National Laboratory");
        assertThat(software.sourceUrl().toString()).isEqualTo("https://www.osti.gov/biblio/12346");
    }

    @Test
    void resumesFromDurablePageCursorAndCompletesWithoutNextLink() {
        linkHeader.set(null);

        HarvestPage page = harvester.fetch("7", 50);

        assertThat(requestQuery.get()).contains("rows=50", "page=7");
        assertThat(page.complete()).isTrue();
        assertThat(page.nextCursor()).isNull();
    }

    @Test
    void quarantinesMalformedRecordWithoutLosingContinuation() {
        responseBody.set("""
                [
                  {"title": "Missing OSTI identifier"}
                ]
                """);

        HarvestPage page = harvester.fetch(null, 100);

        assertThat(page.records()).isEmpty();
        assertThat(page.rejections()).hasSize(1);
        assertThat(page.rejections().getFirst().message()).contains("missing required field 'osti_id'");
        assertThat(page.nextCursor()).isEqualTo("2");
    }

    @Test
    void turnsRetryablePublisherStatusIntoDurablePauseSignal() {
        responseStatus.set(429);
        retryAfter.set("12");
        responseBody.set("[]");

        assertThatThrownBy(() -> harvester.fetch(null, 100))
                .isInstanceOfSatisfying(FederatedHarvestException.class, exception -> {
                    assertThat(exception.retryable()).isTrue();
                    assertThat(exception.retryAfter()).isEqualTo(Duration.ofSeconds(12));
                });
    }

    @Test
    void rejectsInvalidDurableCursorBeforeCallingPublisher() {
        assertThatThrownBy(() -> harvester.fetch("not-a-page", 100))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("positive page number");
    }

    private void handleRecords(HttpExchange exchange) throws IOException {
        requestQuery.set(exchange.getRequestURI().getRawQuery());
        if (linkHeader.get() != null) {
            exchange.getResponseHeaders().set("Link", linkHeader.get());
        }
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
