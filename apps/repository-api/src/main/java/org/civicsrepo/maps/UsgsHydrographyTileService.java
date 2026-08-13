package org.civicsrepo.maps;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class UsgsHydrographyTileService {
    static final URI UPSTREAM_EXPORT =
            URI.create("https://hydro.nationalmap.gov/arcgis/rest/services/3DHP_all/MapServer/export");

    /** 1x1 transparent PNG returned when upstream tiles fail or are unavailable. */
    static final byte[] TRANSPARENT_PNG = Base64.getDecoder()
            .decode(
                    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2ZkAAAAASUVORK5CYII=");

    private final HttpClient httpClient;

    public UsgsHydrographyTileService() {
        this(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4)).build());
    }

    UsgsHydrographyTileService(HttpClient httpClient) {
        this.httpClient = httpClient;
    }

    public byte[] exportTile(String bbox, int bboxSr, int imageSr, String size, boolean transparent) {
        validateBbox(bbox);

        try {
            HttpRequest request = HttpRequest.newBuilder(buildUpstreamUri(bbox, bboxSr, imageSr, size, transparent))
                    .timeout(Duration.ofSeconds(8))
                    .GET()
                    .build();
            HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());

            if (response.statusCode() >= 200
                    && response.statusCode() < 300
                    && isImageResponse(response)) {
                return response.body();
            }
        } catch (IOException exception) {
            return TRANSPARENT_PNG;
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return TRANSPARENT_PNG;
        }

        return TRANSPARENT_PNG;
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

        for (String part : parts) {
            try {
                Double.parseDouble(part.trim());
            } catch (NumberFormatException exception) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "bbox must contain numeric west,south,east,north values", exception);
            }
        }
    }

    private URI buildUpstreamUri(String bbox, int bboxSr, int imageSr, String size, boolean transparent) {
        String query = String.join(
                "&",
                "bbox=" + encode(bbox),
                "bboxSR=" + bboxSr,
                "imageSR=" + imageSr,
                "size=" + encode(size),
                "f=image",
                "transparent=" + transparent);
        return URI.create(UPSTREAM_EXPORT + "?" + query);
    }

    private boolean isImageResponse(HttpResponse<byte[]> response) {
        byte[] body = response.body();
        return response.headers()
                .firstValue("Content-Type")
                .map(contentType -> contentType.toLowerCase().startsWith("image/"))
                .orElse(body != null && body.length > 0);
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
