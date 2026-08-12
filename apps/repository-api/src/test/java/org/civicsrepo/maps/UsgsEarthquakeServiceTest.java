package org.civicsrepo.maps;

import static org.assertj.core.api.Assertions.assertThat;


import java.io.IOException;
import java.net.Authenticator;
import java.net.CookieHandler;
import java.net.ProxySelector;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import org.civicsrepo.generated.dto.UsgsEarthquakeOverlay;
import org.civicsrepo.generated.dto.UsgsEarthquakeQuery;
import java.util.concurrent.Executor;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLParameters;
import javax.net.ssl.SSLSession;
import org.junit.jupiter.api.Test;

class UsgsEarthquakeServiceTest {
    private static final URI TEST_ENDPOINT = URI.create("https://example.test/usgs/query");

    @Test
    void parsesUsgsGeoJsonIntoNormalizedOverlayMetadata() {
        TestHttpClient httpClient = TestHttpClient.withResponse(200, """
                {
                  "metadata": { "generated": 1786478400000 },
                  "features": [
                    {
                      "id": "us1000demo",
                      "properties": {
                        "place": "10 km W of Test City",
                        "mag": 3.4,
                        "time": 1786474800000
                      },
                      "geometry": { "coordinates": [-101.5, 47.2, 8.1] }
                    },
                    {
                      "id": "missing-magnitude",
                      "properties": { "place": "Ignored event", "time": 1786474800000 },
                      "geometry": { "coordinates": [-101.5, 47.2, 8.1] }
                    }
                  ]
                }
                """);
        UsgsEarthquakeService service = new UsgsEarthquakeService(httpClient, TEST_ENDPOINT);

        UsgsEarthquakeOverlay overlay = service.findEarthquakes(1.5, 14);

        assertThat(overlay.getSource()).isEqualTo("USGS Earthquake Catalog GeoJSON");
        assertThat(overlay.getSourceUrl()).hasToString("https://example.test/usgs/query?format=geojson");
        assertThat(overlay.getAttribution()).isEqualTo("U.S. Geological Survey Earthquake Hazards Program");
        assertThat(overlay.getUpdatedAt()).isEqualTo(OffsetDateTime.ofInstant(Instant.ofEpochMilli(1786478400000L), ZoneOffset.UTC));
        assertThat(overlay.getStaleAfter()).isEqualTo(overlay.getUpdatedAt().plusDays(1));
        assertThat(overlay.getFallback()).isFalse();
        assertThat(overlay.getQuery())
                .isEqualTo(new UsgsEarthquakeQuery(1.5, 14, 45.8, 49.1, -104.2, -96.4));
        assertThat(overlay.getFeatures())
                .singleElement()
                .satisfies(feature -> {
                    assertThat(feature.getId()).isEqualTo("us1000demo");
                    assertThat(feature.getPlace()).isEqualTo("10 km W of Test City");
                    assertThat(feature.getMagnitude()).isEqualTo(3.4);
                    assertThat(feature.getLatitude()).isEqualTo(47.2);
                    assertThat(feature.getLongitude()).isEqualTo(-101.5);
                    assertThat(feature.getOccurredAt())
                            .isEqualTo(OffsetDateTime.ofInstant(Instant.ofEpochMilli(1786474800000L), ZoneOffset.UTC));
                });
        assertThat(httpClient.requestUri().toString())
                .contains("format=geojson")
                .contains("minmagnitude=1.5")
                .contains("minlatitude=45.8")
                .contains("maxlongitude=-96.4");
    }

    @Test
    void returnsNormalizedFallbackWhenUsgsRequestFails() {
        TestHttpClient httpClient = TestHttpClient.withResponse(503, "{}");
        UsgsEarthquakeService service = new UsgsEarthquakeService(httpClient, TEST_ENDPOINT);

        UsgsEarthquakeOverlay overlay = service.findEarthquakes(0, 7);

        assertThat(overlay.getSource()).isEqualTo("USGS Earthquake Catalog GeoJSON fallback fixture");
        assertThat(overlay.getSourceUrl()).hasToString("https://example.test/usgs/query?format=geojson");
        assertThat(overlay.getAttribution()).isEqualTo("U.S. Geological Survey Earthquake Hazards Program");
        assertThat(overlay.getFallback()).isTrue();
        assertThat(overlay.getQuery()).isEqualTo(new UsgsEarthquakeQuery(0d, 7, 45.8, 49.1, -104.2, -96.4));
        assertThat(overlay.getStaleAfter()).isEqualTo(overlay.getUpdatedAt().plusDays(1));
        assertThat(overlay.getFeatures()).hasSize(3);
    }

    private static final class TestHttpClient extends HttpClient {
        private final int statusCode;
        private final String body;
        private URI requestUri = URI.create("about:blank");

        private TestHttpClient(int statusCode, String body) {
            this.statusCode = statusCode;
            this.body = body;
        }

        static TestHttpClient withResponse(int statusCode, String body) {
            return new TestHttpClient(statusCode, body);
        }

        URI requestUri() {
            return requestUri;
        }

        @Override
        public <T> HttpResponse<T> send(HttpRequest request, HttpResponse.BodyHandler<T> responseBodyHandler)
                throws IOException, InterruptedException {
            requestUri = request.uri();
            HttpResponse.ResponseInfo responseInfo = new TestResponseInfo(statusCode);
            HttpResponse.BodySubscriber<T> subscriber = responseBodyHandler.apply(responseInfo);
            subscriber.onSubscribe(new java.util.concurrent.Flow.Subscription() {
                @Override
                public void request(long n) {}

                @Override
                public void cancel() {}
            });
            subscriber.onNext(
                    java.util.List.of(java.nio.ByteBuffer.wrap(body.getBytes(StandardCharsets.UTF_8))));
            subscriber.onComplete();
            return new TestHttpResponse<>(request, statusCode, subscriber.getBody().toCompletableFuture().join());
        }

        @Override
        public <T> CompletableFuture<HttpResponse<T>> sendAsync(
                HttpRequest request, HttpResponse.BodyHandler<T> responseBodyHandler) {
            throw new UnsupportedOperationException("Async HTTP is not used by UsgsEarthquakeService tests.");
        }

        @Override
        public <T> CompletableFuture<HttpResponse<T>> sendAsync(
                HttpRequest request,
                HttpResponse.BodyHandler<T> responseBodyHandler,
                HttpResponse.PushPromiseHandler<T> pushPromiseHandler) {
            throw new UnsupportedOperationException("Async HTTP is not used by UsgsEarthquakeService tests.");
        }

        @Override
        public Optional<CookieHandler> cookieHandler() {
            return Optional.empty();
        }

        @Override
        public Optional<Duration> connectTimeout() {
            return Optional.of(Duration.ofSeconds(1));
        }

        @Override
        public Redirect followRedirects() {
            return Redirect.NEVER;
        }

        @Override
        public Optional<ProxySelector> proxy() {
            return Optional.empty();
        }

        @Override
        public SSLContext sslContext() {
            return null;
        }

        @Override
        public SSLParameters sslParameters() {
            return null;
        }

        @Override
        public Optional<Authenticator> authenticator() {
            return Optional.empty();
        }

        @Override
        public Version version() {
            return Version.HTTP_2;
        }

        @Override
        public Optional<Executor> executor() {
            return Optional.empty();
        }
    }

    private record TestResponseInfo(int statusCode) implements HttpResponse.ResponseInfo {
        @Override
        public HttpHeaders headers() {
            return HttpHeaders.of(java.util.Map.of(), (name, value) -> true);
        }

        @Override
        public HttpClient.Version version() {
            return HttpClient.Version.HTTP_2;
        }
    }

    private record TestHttpResponse<T>(HttpRequest request, int statusCode, T body) implements HttpResponse<T> {
        @Override
        public Optional<HttpResponse<T>> previousResponse() {
            return Optional.empty();
        }

        @Override
        public HttpHeaders headers() {
            return HttpHeaders.of(java.util.Map.of(), (name, value) -> true);
        }

        @Override
        public URI uri() {
            return request.uri();
        }

        @Override
        public HttpClient.Version version() {
            return HttpClient.Version.HTTP_2;
        }

        @Override
        public Optional<SSLSession> sslSession() {
            return Optional.empty();
        }
    }
}
