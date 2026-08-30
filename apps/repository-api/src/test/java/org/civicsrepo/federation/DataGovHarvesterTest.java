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

class DataGovHarvesterTest {
    private static final Instant HARVESTED_AT = Instant.parse("2026-08-29T21:45:00Z");

    private final AtomicReference<String> responseBody = new AtomicReference<>();
    private final AtomicReference<Integer> responseStatus = new AtomicReference<>(200);
    private final AtomicReference<String> retryAfter = new AtomicReference<>();
    private final AtomicReference<String> requestQuery = new AtomicReference<>();
    private HttpServer server;
    private DataGovHarvester harvester;

    @BeforeEach
    void startServer() throws IOException {
        responseBody.set(resource("/federation/data-gov-package-search.json"));
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/3/action/package_search", this::handleSearch);
        server.start();
        harvester = new DataGovHarvester(
                "http://127.0.0.1:" + server.getAddress().getPort() + "/api/3/action/package_search",
                HttpClient.newHttpClient(),
                new ObjectMapper(),
                Clock.fixed(HARVESTED_AT, ZoneOffset.UTC));
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    @Test
    void normalizesBoundedPageAndEmitsResumeCursor() {
        HarvestPage page = harvester.fetch(null, 5_000);

        assertThat(page.complete()).isFalse();
        assertThat(page.nextCursor()).isEqualTo("2");
        assertThat(page.records()).hasSize(2);
        assertThat(page.rejections()).isEmpty();
        assertThat(requestQuery.get())
                .contains("rows=1000", "start=0", "facet=false", "sort=metadata_modified+asc%2Cid+asc");

        FederatedResearchRecord workforce = page.records().getFirst();
        assertThat(workforce.sourceSystem()).isEqualTo(FederatedSourceSystem.DATA_GOV);
        assertThat(workforce.id()).isEqualTo("DATA_GOV:11111111-1111-1111-1111-111111111111");
        assertThat(workforce.title()).isEqualTo("North Dakota Workforce Demonstration Dataset");
        assertThat(workforce.publisher()).isEqualTo("Department of Commerce");
        assertThat(workforce.program()).isEqualTo("006:123");
        assertThat(workforce.contentType()).isEqualTo(ResearchObjectType.DATASET);
        assertThat(workforce.sourceUrl().toString())
                .isEqualTo("https://catalog.data.gov/dataset/north-dakota-workforce-demo");
        assertThat(workforce.sourceUpdatedAt().toInstant()).isEqualTo(Instant.parse("2026-08-20T14:30:00Z"));
        assertThat(workforce.harvestedAt().toInstant()).isEqualTo(HARVESTED_AT);
        assertThat(workforce.adapterVersion()).isEqualTo(DataGovHarvester.ADAPTER_VERSION);
        assertThat(workforce.authors()).containsExactly("Office of Workforce Research");
        assertThat(workforce.subjects()).containsExactly("Workforce", "North Dakota");
        assertThat(workforce.sourceMetadata())
                .containsEntry("bureauCode", "006:00")
                .containsEntry("programCode", "006:123")
                .containsEntry("doi", "10.1234/data-gov-demo")
                .containsEntry("resourceCount", 2);

        @SuppressWarnings("unchecked")
        List<Map<String, String>> resources =
                (List<Map<String, String>>) workforce.sourceMetadata().get("resources");
        assertThat(resources).hasSize(2);
        assertThat(resources.getFirst())
                .containsEntry("name", "Workforce CSV")
                .containsEntry("format", "CSV")
                .containsEntry("url", "https://example.gov/workforce/north-dakota.csv");
        assertThat(resources.get(1))
                .containsEntry("name", "Workforce JSON")
                .containsEntry("format", "JSON")
                .containsEntry("url", "https://example.gov/workforce/north-dakota.json");

        // The second fixture is deliberately sparse: no author, program code, bureau code or
        // resources. A useful publisher/program fallback still makes it through normalization.
        FederatedResearchRecord fallbackProgram = page.records().get(1);
        assertThat(fallbackProgram.program()).isEqualTo("Office of Science");
        assertThat(fallbackProgram.authors()).isEmpty();
        assertThat(fallbackProgram.sourceMetadata()).containsEntry("resourceCount", 0);
        assertThat(fallbackProgram.sourceMetadata()).doesNotContainKey("resources");
    }

    @Test
    void marksLastPageCompleteFromReportedCatalogCount() {
        responseBody.set(responseBody.get().replace("\"count\": 3", "\"count\": 2"));

        HarvestPage page = harvester.fetch(null, 100);

        assertThat(page.complete()).isTrue();
        assertThat(page.nextCursor()).isNull();
        assertThat(page.records()).hasSize(2);
    }

    @Test
    void resumesFromOpaqueOffsetCursor() {
        harvester.fetch("27", 25);

        assertThat(requestQuery.get()).contains("rows=25", "start=27");
    }

    @Test
    void turnsRateLimitIntoRetryableFailureWithRetryAfter() {
        responseStatus.set(429);
        retryAfter.set("4");
        responseBody.set("{\"success\":false}");

        assertThatThrownBy(() -> harvester.fetch(null, 100))
                .isInstanceOfSatisfying(FederatedHarvestException.class, exception -> {
                    assertThat(exception.retryable()).isTrue();
                    assertThat(exception.retryAfter()).isEqualTo(Duration.ofSeconds(4));
                });
    }

    @Test
    void quarantinesMalformedDatasetAndAdvancesSourceOffset() {
        responseBody.set(
                """
                {
                  "success": true,
                  "result": {
                    "count": 2,
                    "results": [
                      {
                        "title": "Missing stable identifier",
                        "organization": {"title": "Example Agency"},
                        "metadata_modified": "2026-08-20T00:00:00Z"
                      }
                    ]
                  }
                }
                """);

        HarvestPage page = harvester.fetch(null, 100);

        assertThat(page.records()).isEmpty();
        assertThat(page.rejections()).hasSize(1);
        assertThat(page.rejections().getFirst().sourceIdentifier()).isNull();
        assertThat(page.rejections().getFirst().message()).contains("required field 'id'");
        assertThat(page.rejections().getFirst().rawSnippet()).contains("Missing stable identifier");
        assertThat(page.complete()).isFalse();
        assertThat(page.nextCursor()).isEqualTo("1");
    }

    @Test
    void rejectsInvalidCursorWithoutRetryingPublisher() {
        assertThatThrownBy(() -> harvester.fetch("not-an-offset", 100))
                .isInstanceOfSatisfying(FederatedHarvestException.class, exception -> {
                    assertThat(exception.retryable()).isFalse();
                    assertThat(exception.getMessage()).contains("cursor");
                });
    }

    private void handleSearch(HttpExchange exchange) throws IOException {
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

    private String resource(String path) throws IOException {
        try (var stream = DataGovHarvesterTest.class.getResourceAsStream(path)) {
            if (stream == null) {
                throw new IOException("Missing test resource: " + path);
            }
            return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
