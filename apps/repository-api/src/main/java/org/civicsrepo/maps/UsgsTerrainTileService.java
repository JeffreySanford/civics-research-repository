package org.civicsrepo.maps;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * Repository-owned proxy for USGS 3DEP dynamic terrain imagery.
 *
 * <p>The browser chooses one small application mode rather than constructing ArcGIS ImageServer
 * rendering rules. Requests are bounded to the 256px Web Mercator tiles MapLibre uses, and only
 * the three rendering functions approved by the Maps UX are reachable through this service.
 */
@Service
public class UsgsTerrainTileService {
    static final URI UPSTREAM_EXPORT = URI.create(
            "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage");

    enum TerrainMode {
        HILLSHADE("hillshade", "Hillshade Gray"),
        TINTED_ELEVATION("tinted", "Hillshade Elevation Tinted"),
        SLOPE("slope", "Slope Map");

        private final String requestValue;
        private final String rasterFunction;

        TerrainMode(String requestValue, String rasterFunction) {
            this.requestValue = requestValue;
            this.rasterFunction = rasterFunction;
        }

        String requestValue() {
            return requestValue;
        }

        String rasterFunction() {
            return rasterFunction;
        }

        static TerrainMode fromRequestValue(String value) {
            String normalized = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
            for (TerrainMode mode : values()) {
                if (mode.requestValue.equals(normalized)) {
                    return mode;
                }
            }

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "mode must be one of hillshade, tinted, slope");
        }
    }

    private final HttpClient httpClient;

    public UsgsTerrainTileService() {
        this(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4)).build());
    }

    UsgsTerrainTileService(HttpClient httpClient) {
        this.httpClient = httpClient;
    }

    public byte[] exportTile(String bbox, String mode) {
        validateBbox(bbox);
        TerrainMode terrainMode = TerrainMode.fromRequestValue(mode);

        try {
            HttpRequest request = HttpRequest.newBuilder(buildUpstreamUri(bbox, terrainMode))
                    .timeout(Duration.ofSeconds(10))
                    .GET()
                    .build();
            HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());

            if (response.statusCode() >= 200
                    && response.statusCode() < 300
                    && isImageResponse(response)) {
                return response.body();
            }

            throw unavailable("USGS 3DEP returned an unusable terrain image response", null);
        } catch (IOException exception) {
            throw unavailable("USGS 3DEP terrain service is unavailable", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw unavailable("USGS 3DEP terrain request was interrupted", exception);
        }
    }

    private URI buildUpstreamUri(String bbox, TerrainMode mode) {
        String renderingRule = "{\"rasterFunction\":\"" + mode.rasterFunction() + "\"}";
        String query = String.join(
                "&",
                "bbox=" + encode(bbox),
                "bboxSR=3857",
                "imageSR=3857",
                "size=256%2C256",
                "format=png32",
                "transparent=true",
                "renderingRule=" + encode(renderingRule),
                "f=image");
        return URI.create(UPSTREAM_EXPORT + "?" + query);
    }

    private void validateBbox(String bbox) {
        if (bbox == null || bbox.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "bbox is required");
        }

        String[] parts = bbox.split(",", -1);
        if (parts.length != 4) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "bbox must be west,south,east,north in EPSG:3857");
        }

        double[] coordinates = new double[4];
        for (int index = 0; index < parts.length; index++) {
            try {
                coordinates[index] = Double.parseDouble(parts[index].trim());
            } catch (NumberFormatException exception) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "bbox must contain numeric west,south,east,north values",
                        exception);
            }

            if (!Double.isFinite(coordinates[index])) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "bbox must contain finite west,south,east,north values");
            }
        }

        if (coordinates[0] >= coordinates[2] || coordinates[1] >= coordinates[3]) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "bbox west/south values must be less than east/north values");
        }
    }

    private boolean isImageResponse(HttpResponse<byte[]> response) {
        byte[] body = response.body();
        return response.headers()
                .firstValue("Content-Type")
                .map(contentType -> contentType.toLowerCase(Locale.ROOT).startsWith("image/"))
                .orElse(body != null && body.length > 0);
    }

    private ResponseStatusException unavailable(String message, Exception cause) {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, message, cause);
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
