package org.civicsrepo.maps;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class UsgsEarthquakeService {
    private static final String USGS_ENDPOINT = "https://earthquake.usgs.gov/fdsnws/event/1/query";
    private static final int MAX_FEATURES = 25;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(4))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public UsgsEarthquakeOverlay findEarthquakes(double minMagnitude, int days) {
        try {
            UsgsEarthquakeOverlay overlay = fetchEarthquakes(minMagnitude, days);
            return overlay.features().isEmpty() ? fallbackOverlay() : overlay;
        } catch (IOException exception) {
            return fallbackOverlay();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return fallbackOverlay();
        }
    }

    private UsgsEarthquakeOverlay fetchEarthquakes(double minMagnitude, int days) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(queryUri(minMagnitude, days))
                .timeout(Duration.ofSeconds(8))
                .GET()
                .build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            return fallbackOverlay();
        }

        JsonNode root = objectMapper.readTree(response.body());
        OffsetDateTime updatedAt = readGeneratedAt(root);
        List<UsgsEarthquakeFeature> features = new ArrayList<>();

        for (JsonNode feature : root.path("features")) {
            if (features.size() == MAX_FEATURES) {
                break;
            }

            JsonNode coordinates = feature.path("geometry").path("coordinates");
            JsonNode properties = feature.path("properties");
            if (coordinates.size() < 2 || properties.path("mag").isMissingNode()) {
                continue;
            }

            features.add(new UsgsEarthquakeFeature(
                    feature.path("id").asText("unknown"),
                    properties.path("place").asText("USGS earthquake event"),
                    properties.path("mag").asDouble(0),
                    OffsetDateTime.ofInstant(Instant.ofEpochMilli(properties.path("time").asLong()), ZoneOffset.UTC),
                    coordinates.get(1).asDouble(),
                    coordinates.get(0).asDouble()));
        }

        return new UsgsEarthquakeOverlay("USGS Earthquake Catalog GeoJSON", updatedAt, features);
    }

    private URI queryUri(double minMagnitude, int days) {
        OffsetDateTime startTime = OffsetDateTime.now(ZoneOffset.UTC).minusDays(days);
        String query = String.join(
                "&",
                "format=geojson",
                "orderby=time",
                "limit=" + MAX_FEATURES,
                "minmagnitude=" + minMagnitude,
                "starttime=" + encode(DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(startTime)),
                "minlatitude=45.8",
                "maxlatitude=49.1",
                "minlongitude=-104.2",
                "maxlongitude=-96.4");
        return URI.create(USGS_ENDPOINT + "?" + query);
    }

    private OffsetDateTime readGeneratedAt(JsonNode root) {
        long generated = root.path("metadata").path("generated").asLong(Instant.now().toEpochMilli());
        return OffsetDateTime.ofInstant(Instant.ofEpochMilli(generated), ZoneOffset.UTC);
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private UsgsEarthquakeOverlay fallbackOverlay() {
        OffsetDateTime updatedAt = OffsetDateTime.now(ZoneOffset.UTC);
        return new UsgsEarthquakeOverlay(
                "USGS Earthquake Catalog GeoJSON fallback fixture",
                updatedAt,
                List.of(
                        new UsgsEarthquakeFeature(
                                "demo-western-nd", "Western North Dakota", 2.4, updatedAt.minusHours(4), 47.35, -103.21),
                        new UsgsEarthquakeFeature(
                                "demo-central-nd",
                                "Central North Dakota",
                                1.8,
                                updatedAt.minusHours(14),
                                47.02,
                                -100.78),
                        new UsgsEarthquakeFeature(
                                "demo-eastern-nd", "Eastern North Dakota", 2.1, updatedAt.minusDays(1), 48.1, -97.73)));
    }
}
