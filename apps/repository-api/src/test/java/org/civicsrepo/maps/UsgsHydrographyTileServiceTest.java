package org.civicsrepo.maps;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.net.Authenticator;
import java.net.CookieHandler;
import java.net.ProxySelector;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLParameters;
import javax.net.ssl.SSLSession;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class UsgsHydrographyTileServiceTest {
    private static final byte[] SAMPLE_PNG = new byte[] {(byte) 137, 80, 78, 71, 13, 10, 26, 10};

    @Test
    void proxiesUpstreamImageResponses() {
        TestHttpClient httpClient =
                TestHttpClient.withResponse(200, SAMPLE_PNG, Map.of("Content-Type", "image/png"));
        UsgsHydrographyTileService service = new UsgsHydrographyTileService(httpClient);

        byte[] tile = service.exportTile("-100,40,-99,41", 3857, 3857, "256,256", true);

        assertThat(tile).isEqualTo(SAMPLE_PNG);
        assertThat(httpClient.requestUri().toString())
                .contains("hydro.nationalmap.gov")
                .contains("bbox=-100%2C40%2C-99%2C41")
                .contains("bboxSR=3857")
                .contains("size=256%2C256")
                .contains("transparent=true");
    }

    @Test
    void returnsTransparentPlaceholderWhenUpstreamFails() {
        TestHttpClient httpClient = TestHttpClient.withIOException();
        UsgsHydrographyTileService service = new UsgsHydrographyTileService(httpClient);

        byte[] tile = service.exportTile("-100,40,-99,41", 3857, 3857, "256,256", true);

        assertThat(Arrays.equals(tile, UsgsHydrographyTileService.TRANSPARENT_PNG)).isTrue();
    }

    @Test
    void rejectsMissingOrMalformedBbox() {
        UsgsHydrographyTileService service =
                new UsgsHydrographyTileService(TestHttpClient.withResponse(200, SAMPLE_PNG, Map.of()));

        assertThatThrownBy(() -> service.exportTile("", 3857, 3857, "256,256", true))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("bbox is required");

        assertThatThrownBy(() -> service.exportTile("1,2,3", 3857, 3857, "256,256", true))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("west,south,east,north");
    }

    private static final class TestHttpClient extends HttpClient {
        private final int statusCode;
        private final byte[] body;
        private final Map<String, String> headers;
        private final boolean throwIOException;
        private URI requestUri = URI.create("about:blank");

        private TestHttpClient(
                int statusCode, byte[] body, Map<String, String> headers, boolean throwIOException) {
            this.statusCode = statusCode;
            this.body = body;
            this.headers = headers;
            this.throwIOException = throwIOException;
        }

        static TestHttpClient withResponse(int statusCode, byte[] body, Map<String, String> headers) {
            return new TestHttpClient(statusCode, body, headers, false);
        }

        static TestHttpClient withIOException() {
            return new TestHttpClient(502, new byte[0], Map.of(), true);
        }

        URI requestUri() {
            return requestUri;
        }

        @Override
        public <T> HttpResponse<T> send(HttpRequest request, HttpResponse.BodyHandler<T> responseBodyHandler)
                throws IOException, InterruptedException {
            if (throwIOException) {
                throw new IOException("upstream hydrography export unavailable");
            }

            requestUri = request.uri();
            HttpResponse.ResponseInfo responseInfo = new TestResponseInfo(statusCode, headers);
            HttpResponse.BodySubscriber<T> subscriber = responseBodyHandler.apply(responseInfo);
            subscriber.onSubscribe(new java.util.concurrent.Flow.Subscription() {
                @Override
                public void request(long n) {}

                @Override
                public void cancel() {}
            });
            subscriber.onNext(List.of(ByteBuffer.wrap(body)));
            subscriber.onComplete();
            return new TestHttpResponse<>(request, statusCode, subscriber.getBody().toCompletableFuture().join(), headers);
        }

        @Override
        public <T> CompletableFuture<HttpResponse<T>> sendAsync(
                HttpRequest request, HttpResponse.BodyHandler<T> responseBodyHandler) {
            throw new UnsupportedOperationException();
        }

        @Override
        public <T> CompletableFuture<HttpResponse<T>> sendAsync(
                HttpRequest request,
                HttpResponse.BodyHandler<T> responseBodyHandler,
                HttpResponse.PushPromiseHandler<T> pushPromiseHandler) {
            throw new UnsupportedOperationException();
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

    private record TestResponseInfo(int statusCode, Map<String, String> headerMap)
            implements HttpResponse.ResponseInfo {
        @Override
        public HttpHeaders headers() {
            return HttpHeaders.of(
                    headerMap.entrySet().stream()
                            .collect(java.util.stream.Collectors.toMap(
                                    Map.Entry::getKey, entry -> List.of(entry.getValue()))),
                    (name, value) -> true);
        }

        @Override
        public HttpClient.Version version() {
            return HttpClient.Version.HTTP_2;
        }
    }

    private record TestHttpResponse<T>(
            HttpRequest request, int statusCode, T body, Map<String, String> headerMap)
            implements HttpResponse<T> {
        @Override
        public Optional<HttpResponse<T>> previousResponse() {
            return Optional.empty();
        }

        @Override
        public HttpHeaders headers() {
            return HttpHeaders.of(
                    headerMap.entrySet().stream()
                            .collect(java.util.stream.Collectors.toMap(
                                    Map.Entry::getKey, entry -> List.of(entry.getValue()))),
                    (name, value) -> true);
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
