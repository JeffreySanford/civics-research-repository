package org.civicsrepo.federation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class DataGovRateLimitFallbackTest {
    @Test
    void defersForOneHourWhenDataGovRateLimitOmitsRetryAfter() throws Exception {
        AtomicReference<String> apiKey = new AtomicReference<>();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/technology/datagov/v4/search", exchange -> {
            apiKey.set(exchange.getRequestHeaders().getFirst("X-Api-Key"));
            byte[] response = "{\"error\":{\"code\":\"OVER_RATE_LIMIT\"}}"
                    .getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(429, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();

        try {
            DataGovHarvester harvester = new DataGovHarvester(
                    "http://127.0.0.1:" + server.getAddress().getPort() + "/technology/datagov/v4/search",
                    "personal-test-key",
                    HttpClient.newHttpClient(),
                    new ObjectMapper(),
                    Clock.fixed(Instant.parse("2026-08-30T16:45:00Z"), ZoneOffset.UTC));

            assertThatThrownBy(() -> harvester.fetch(null, 100))
                    .isInstanceOfSatisfying(FederatedHarvestException.class, exception -> {
                        assertThat(exception.retryable()).isTrue();
                        assertThat(exception.retryAfter()).isEqualTo(Duration.ofHours(1));
                    });
            assertThat(apiKey.get()).isEqualTo("personal-test-key");
        } finally {
            server.stop(0);
        }
    }
}
