package org.civicsrepo.sources;

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
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSession;
import javax.net.ssl.SSLParameters;
import org.junit.jupiter.api.Test;

class HttpSourceFileProbeTest {
    private static final String URL = "https://example.test/tl_2025_38_tract.zip";

    @Test
    void readsSizeAndPublicationDateFromTheResponseHeaders() {
        SourceFileProbe probe = probeReturning(
                200, Map.of("content-length", "91234567", "last-modified", "Tue, 23 Sep 2025 14:05:00 GMT"));

        assertThat(probe.probe(URL))
                .contains(new SourceFileFacts(91_234_567L, LocalDate.of(2025, 9, 23)));
    }

    /** Not every host sends both headers. An absent value stays absent rather than being guessed. */
    @Test
    void reportsWhatTheHostOffersAndNothingMore() {
        SourceFileProbe probe = probeReturning(200, Map.of("content-length", "512"));

        assertThat(probe.probe(URL)).contains(new SourceFileFacts(512L, null));
    }

    @Test
    void ignoresHeadersItCannotParse() {
        SourceFileProbe probe =
                probeReturning(200, Map.of("content-length", "not-a-number", "last-modified", "yesterday"));

        assertThat(probe.probe(URL)).contains(new SourceFileFacts(null, null));
    }

    @Test
    void reportsNothingForAMissingFile() {
        assertThat(probeReturning(404, Map.of()).probe(URL)).isEmpty();
    }

    /**
     * An unreachable publisher is an expected condition, not an error: the caller has compiled
     * metadata to fall back to, and a sync must not fail because census.gov is down.
     */
    @Test
    void reportsNothingWhenTheHostCannotBeReached() {
        SourceFileProbe probe = new HttpSourceFileProbe(new FailingHttpClient());

        assertThat(probe.probe(URL)).isEmpty();
    }

    @Test
    void reportsNothingForABlankUrl() {
        assertThat(new HttpSourceFileProbe(new FailingHttpClient()).probe("")).isEmpty();
        assertThat(new HttpSourceFileProbe(new FailingHttpClient()).probe(null)).isEmpty();
    }

    private SourceFileProbe probeReturning(int statusCode, Map<String, String> headers) {
        return new HttpSourceFileProbe(new StubHttpClient(statusCode, headers));
    }

    private static final class FailingHttpClient extends TestHttpClient {
        @Override
        public <T> HttpResponse<T> send(HttpRequest request, HttpResponse.BodyHandler<T> responseBodyHandler)
                throws IOException {
            throw new IOException("connection refused");
        }
    }

    private static final class StubHttpClient extends TestHttpClient {
        private final int statusCode;
        private final Map<String, String> headers;

        private StubHttpClient(int statusCode, Map<String, String> headers) {
            this.statusCode = statusCode;
            this.headers = headers;
        }

        @Override
        @SuppressWarnings("unchecked")
        public <T> HttpResponse<T> send(HttpRequest request, HttpResponse.BodyHandler<T> responseBodyHandler) {
            return (HttpResponse<T>) new StubResponse(request, statusCode, headers);
        }
    }

    private record StubResponse(HttpRequest request, int statusCode, Map<String, String> rawHeaders)
            implements HttpResponse<Void> {
        @Override
        public HttpHeaders headers() {
            Map<String, List<String>> values = new java.util.HashMap<>();
            rawHeaders.forEach((key, value) -> values.put(key, List.of(value)));
            return HttpHeaders.of(values, (key, value) -> true);
        }

        @Override
        public Void body() {
            return null;
        }

        @Override
        public Optional<HttpResponse<Void>> previousResponse() {
            return Optional.empty();
        }

        @Override
        public Optional<SSLSession> sslSession() {
            return Optional.empty();
        }

        @Override
        public URI uri() {
            return request.uri();
        }

        @Override
        public HttpClient.Version version() {
            return HttpClient.Version.HTTP_1_1;
        }
    }

    /** Only send() is exercised; the rest of the HttpClient surface is not used by the probe. */
    private abstract static class TestHttpClient extends HttpClient {
        @Override
        public Optional<CookieHandler> cookieHandler() {
            return Optional.empty();
        }

        @Override
        public Optional<Duration> connectTimeout() {
            return Optional.empty();
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
            throw new UnsupportedOperationException();
        }

        @Override
        public SSLParameters sslParameters() {
            throw new UnsupportedOperationException();
        }

        @Override
        public Optional<Authenticator> authenticator() {
            return Optional.empty();
        }

        @Override
        public Version version() {
            return Version.HTTP_1_1;
        }

        @Override
        public Optional<Executor> executor() {
            return Optional.empty();
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
    }
}
