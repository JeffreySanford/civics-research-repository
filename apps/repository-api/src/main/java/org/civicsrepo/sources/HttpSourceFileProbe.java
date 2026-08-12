package org.civicsrepo.sources;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Reads a source file's size and publication date from the publishing host.
 *
 * <p>A HEAD request: these are multi-megabyte archives and only the headers are wanted.
 *
 * <p>Every failure path returns empty rather than throwing. A sync run must not fail because
 * census.gov is slow, and it must not hang either, so the timeouts are short and deliberate — the
 * caller has compiled metadata to fall back to, and waiting is worse than falling back.
 *
 * <p>The user agent is set because some federal hosts answer 403 to the default one while serving
 * the same URL to a browser; usgs.gov does exactly that.
 */
@Component
public class HttpSourceFileProbe implements SourceFileProbe {
    private static final Logger LOGGER = LoggerFactory.getLogger(HttpSourceFileProbe.class);
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(3);
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(6);
    private static final String USER_AGENT =
            "Mozilla/5.0 (compatible; civics-research-repository/0.1; +https://github.com/civicsrepo)";

    private final HttpClient httpClient;

    public HttpSourceFileProbe() {
        this(HttpClient.newBuilder()
                .connectTimeout(CONNECT_TIMEOUT)
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build());
    }

    HttpSourceFileProbe(HttpClient httpClient) {
        this.httpClient = httpClient;
    }

    @Override
    public Optional<SourceFileFacts> probe(String url) {
        if (url == null || url.isBlank()) {
            return Optional.empty();
        }

        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                    .method("HEAD", HttpRequest.BodyPublishers.noBody())
                    .header("User-Agent", USER_AGENT)
                    .timeout(REQUEST_TIMEOUT)
                    .build();
            HttpResponse<Void> response = httpClient.send(request, HttpResponse.BodyHandlers.discarding());

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                LOGGER.debug("Source probe for {} answered {}.", url, response.statusCode());
                return Optional.empty();
            }

            return Optional.of(new SourceFileFacts(
                    contentLength(response).orElse(null),
                    lastModified(response).orElse(null)));
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return Optional.empty();
        } catch (RuntimeException | java.io.IOException exception) {
            LOGGER.debug("Source probe for {} failed: {}", url, exception.getMessage());
            return Optional.empty();
        }
    }

    private Optional<Long> contentLength(HttpResponse<Void> response) {
        return response.headers().firstValue("content-length").flatMap((value) -> {
            try {
                long length = Long.parseLong(value.trim());
                return length >= 0 ? Optional.of(length) : Optional.empty();
            } catch (NumberFormatException exception) {
                return Optional.empty();
            }
        });
    }

    private Optional<LocalDate> lastModified(HttpResponse<Void> response) {
        return response.headers().firstValue("last-modified").flatMap((value) -> {
            try {
                return Optional.of(ZonedDateTime.parse(value.trim(), DateTimeFormatter.RFC_1123_DATE_TIME)
                        .withZoneSameInstant(ZoneOffset.UTC)
                        .toLocalDate());
            } catch (RuntimeException exception) {
                return Optional.empty();
            }
        });
    }
}
