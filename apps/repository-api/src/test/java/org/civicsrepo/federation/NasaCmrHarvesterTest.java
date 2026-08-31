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

class NasaCmrHarvesterTest {
    private static final Instant HARVESTED_AT = Instant.parse("2026-08-31T16:40:00Z");

    private final AtomicReference<String> responseBody = new AtomicReference<>();
    private final AtomicReference<Integer> responseStatus = new AtomicReference<>(200);
    private final AtomicReference<String> nextCursor = new AtomicReference<>();
    private final AtomicReference<String> retryAfter = new AtomicReference<>();
    private final AtomicReference<String> requestQuery = new AtomicReference<>();
    private final AtomicReference<String> requestClientId = new AtomicReference<>();
    private final AtomicReference<String> requestSearchAfter = new AtomicReference<>();
    private final AtomicReference<String> requestAuthorization = new AtomicReference<>();
    private HttpServer server;
    private NasaCmrHarvester harvester;

    @BeforeEach
    void startServer() throws IOException {
        responseBody.set("""
                {
                  "feed": {
                    "entry": [
                      {
                        "concept-id": "C12345-TEST",
                        "native-id": "native-12345",
                        "short-name": "WORKFORCE",
                        "version-id": "1",
                        "dataset-id": "NASA Workforce Earth Observation Collection",
                        "entry-title": "NASA Workforce Earth Observation Collection",
                        "summary": "A public Earth science collection used to exercise federated discovery.",
                        "data-center": "NASA Test Data Center",
                        "collection-data-type": "SCIENCE_QUALITY",
                        "updated": "2026-08-20T14:30:00Z",
                        "keywords": ["EARTH SCIENCE", "OPEN SCIENCE"],
                        "platforms": ["SATELLITE"],
                        "links": [
                          {
                            "rel": "http://esipfed.org/ns/fedsearch/1.1/metadata#",
                            "href": "https://cmr.earthdata.nasa.gov/search/concepts/C12345-TEST"
                          }
                        ]
                      }
                    ]
                  }
                }
                """);
        nextCursor.set("[\"cursor-value\",12345]");
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/search/collections.json", this::handleCollections);
        server.start();
        harvester = new NasaCmrHarvester(
                "http://127.0.0.1:" + server.getAddress().getPort() + "/search/collections.json",
                "civics-test-client",
                "",
                HttpClient.newHttpClient(),
                new ObjectMapper(),
                Clock.fixed(HARVESTED_AT, ZoneOffset.UTC));
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    @Test
    void normalizesPublicCollectionAndUsesSearchAfterCursor() {
        HarvestPage first = harvester.fetch(null, 5_000);

        assertThat(harvester.adapterVersion()).isEqualTo("nasa-cmr-collections-v2");
        assertThat(first.complete()).isFalse();
        assertThat(first.nextCursor()).isEqualTo("[\"cursor-value\",12345]");
        assertThat(first.records()).hasSize(1);
        assertThat(first.rejections()).isEmpty();
        assertThat(requestQuery.get()).contains("page_size=2000").doesNotContain("sort_key");
        assertThat(requestClientId.get()).isEqualTo("civics-test-client");
        assertThat(requestSearchAfter.get()).isNull();
        assertThat(requestAuthorization.get()).isNull();

        FederatedResearchRecord record = first.records().getFirst();
        assertThat(record.sourceSystem()).isEqualTo(FederatedSourceSystem.NASA_CMR);
        assertThat(record.id()).isEqualTo("NASA_CMR:C12345-TEST");
        assertThat(record.title()).isEqualTo("NASA Workforce Earth Observation Collection");
        assertThat(record.publisher()).isEqualTo("NASA Test Data Center");
        assertThat(record.program()).isEqualTo("WORKFORCE");
        assertThat(record.contentType()).isEqualTo(ResearchObjectType.DATASET);
        assertThat(record.sourceUrl().toString())
                .isEqualTo("https://cmr.earthdata.nasa.gov/search/concepts/C12345-TEST");
        assertThat(record.subjects()).containsExactly("EARTH SCIENCE", "OPEN SCIENCE", "SATELLITE");
        assertThat(record.sourceMetadata())
                .containsEntry("shortName", "WORKFORCE")
                .containsEntry("versionId", "1")
                .containsEntry("collectionDataType", "SCIENCE_QUALITY");

        nextCursor.set(null);
        HarvestPage second = harvester.fetch(first.nextCursor(), 25);
        assertThat(requestSearchAfter.get()).isEqualTo("[\"cursor-value\",12345]");
        assertThat(second.complete()).isTrue();
        assertThat(second.nextCursor()).isNull();
    }

    @Test
    void sendsOptionalEarthdataBearerTokenOnlyWhenConfigured() {
        harvester = new NasaCmrHarvester(
                "http://127.0.0.1:" + server.getAddress().getPort() + "/search/collections.json",
                "civics-test-client",
                "earthdata-token",
                HttpClient.newHttpClient(),
                new ObjectMapper(),
                Clock.fixed(HARVESTED_AT, ZoneOffset.UTC));

        harvester.fetch(null, 10);

        assertThat(requestAuthorization.get()).isEqualTo("Bearer earthdata-token");
    }

    @Test
    void quarantinesMalformedCollectionAndKeepsSearchAfter() {
        responseBody.set("{\"feed\":{\"entry\":[{\"entry-title\":\"Missing concept id\"}]}}");

        HarvestPage page = harvester.fetch(null, 100);

        assertThat(page.records()).isEmpty();
        assertThat(page.rejections()).hasSize(1);
        assertThat(page.rejections().getFirst().message()).contains("required field 'concept-id'");
        assertThat(page.nextCursor()).isEqualTo("[\"cursor-value\",12345]");
    }

    @Test
    void turnsTransientPublisherFailureIntoRetryableError() {
        responseStatus.set(503);
        retryAfter.set("4");
        responseBody.set("{\"errors\":[\"temporarily unavailable\"]}");

        assertThatThrownBy(() -> harvester.fetch(null, 100))
                .isInstanceOfSatisfying(FederatedHarvestException.class, exception -> {
                    assertThat(exception.retryable()).isTrue();
                    assertThat(exception.retryAfter()).isEqualTo(Duration.ofSeconds(4));
                });
    }

    private void handleCollections(HttpExchange exchange) throws IOException {
        requestQuery.set(exchange.getRequestURI().getRawQuery());
        requestClientId.set(exchange.getRequestHeaders().getFirst("Client-Id"));
        requestSearchAfter.set(exchange.getRequestHeaders().getFirst("CMR-Search-After"));
        requestAuthorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
        if (nextCursor.get() != null) {
            exchange.getResponseHeaders().set("CMR-Search-After", nextCursor.get());
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
