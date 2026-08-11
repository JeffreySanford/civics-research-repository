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
    private static final String USGS_ATTRIBUTION = "U.S. Geological Survey Earthquake Hazards Program";
    private static final int MAX_FEATURES = 25;
    private static final double MIN_LATITUDE = 45.8;
    private static final double MAX_LATITUDE = 49.1;
    private static final double MIN_LONGITUDE = -104.2;
    private static final double MAX_LONGITUDE = -96.4;

    private final HttpClient httpClient;
    private final URI usgsEndpoint;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public UsgsEarthquakeService() {
        this(
                HttpClient.newBuilder()
                        .connectTimeout(Duration.ofSeconds(4))
                        .build(),
                URI.create(USGS_ENDPOINT));
    }

    UsgsEarthquakeService(HttpClient httpClient, URI usgsEndpoint) {
        this.httpClient = httpClient;
        this.usgsEndpoint = usgsEndpoint;
    }

    public UsgsEarthquakeOverlay findEarthquakes(double minMagnitude, int days) {
        try {
            UsgsEarthquakeOverlay overlay = fetchEarthquakes(minMagnitude, days);
            return overlay.features().isEmpty() ? fallbackOverlay(minMagnitude, days) : overlay;
        } catch (IOException exception) {
            return fallbackOverlay(minMagnitude, days);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return fallbackOverlay(minMagnitude, days);
        }
    }

    private UsgsEarthquakeOverlay fetchEarthquakes(double minMagnitude, int days)
            throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(queryUri(minMagnitude, days))
                .timeout(Duration.ofSeconds(8))
                .GET()
                .build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            return fallbackOverlay(minMagnitude, days);
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

        return overlay("USGS Earthquake Catalog GeoJSON", updatedAt, false, minMagnitude, days, features);
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
                "minlatitude=" + MIN_LATITUDE,
                "maxlatitude=" + MAX_LATITUDE,
                "minlongitude=" + MIN_LONGITUDE,
                "maxlongitude=" + MAX_LONGITUDE);
        return URI.create(usgsEndpoint + "?" + query);
    }

    private OffsetDateTime readGeneratedAt(JsonNode root) {
        long generated = root.path("metadata").path("generated").asLong(Instant.now().toEpochMilli());
        return OffsetDateTime.ofInstant(Instant.ofEpochMilli(generated), ZoneOffset.UTC);
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private UsgsEarthquakeOverlay fallbackOverlay(double minMagnitude, int days) {
        OffsetDateTime updatedAt = OffsetDateTime.now(ZoneOffset.UTC);
        return overlay(
                "USGS Earthquake Catalog GeoJSON fallback fixture",
                updatedAt,
                true,
                minMagnitude,
                days,
                List.of(
                        new UsgsEarthquakeFeature(
                                "demo-western-nd",
                                "Western North Dakota",
                                2.4,
                                updatedAt.minusHours(4),
                                47.35,
                                -103.21),
                        new UsgsEarthquakeFeature(
                                "demo-central-nd",
                                "Central North Dakota",
                                1.8,
                                updatedAt.minusHours(14),
                                47.02,
                                -100.78),
                        new UsgsEarthquakeFeature(
                                "demo-eastern-nd",
                                "Eastern North Dakota",
                                2.1,
                                updatedAt.minusDays(1),
                                48.1,
                                -97.73)));
    }

    private UsgsEarthquakeOverlay overlay(
            String source,
            OffsetDateTime updatedAt,
            boolean fallback,
            double minMagnitude,
            int days,
            List<UsgsEarthquakeFeature> features) {
        return new UsgsEarthquakeOverlay(
                source,
                usgsEndpoint + "?format=geojson",
                USGS_ATTRIBUTION,
                updatedAt,
                updatedAt.plusDays(1),
                fallback,
                new UsgsEarthquakeQuery(
                        minMagnitude, days, MIN_LATITUDE, MAX_LATITUDE, MIN_LONGITUDE, MAX_LONGITUDE),
                features);
    }
}
