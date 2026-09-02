package org.civicsrepo.maps;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Shared authoritative administrative geometry backed by Census TIGERweb.
 *
 * <p>Thematic map services join values to stable Census GEOIDs from this service rather than
 * constructing their own polygons. Geometry vintage is explicit so a 2023 thematic value can use
 * January 1, 2023 county boundaries instead of silently joining to today's shapes. Successful
 * responses are cached in memory by vintage/state FIPS; failures are never cached and never fall
 * back to generated geometry.
 */
@Service
public class AdministrativeGeometryService {
    static final int CURRENT_COUNTY_VINTAGE = 2025;
    static final int SAIPE_COUNTY_VINTAGE = 2023;
    static final String ATTRIBUTION = "U.S. Census Bureau TIGERweb";
    static final String DEFAULT_2023_COUNTY_QUERY_URL =
            "https://tigerweb.geo.census.gov/arcgis/rest/services/Generalized_ACS2023/State_County/MapServer/11/query";
    static final String DEFAULT_2025_COUNTY_QUERY_URL =
            "https://tigerweb.geo.census.gov/arcgis/rest/services/Generalized_ACS2025/State_County/MapServer/11/query";
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(20);
    private static final String COUNTY_FIELDS = "GEOID,STATE,COUNTY,BASENAME,NAME";

    private final Map<Integer, String> countyQueryUrls;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final Map<CountyCacheKey, ObjectNode> countyCache = new ConcurrentHashMap<>();

    @Autowired
    public AdministrativeGeometryService(
            @Value("${civics.maps.census.county-geometry-2023-url:" + DEFAULT_2023_COUNTY_QUERY_URL + "}")
                    String county2023QueryUrl,
            @Value("${civics.maps.census.county-geometry-2025-url:" + DEFAULT_2025_COUNTY_QUERY_URL + "}")
                    String county2025QueryUrl) {
        this(
                Map.of(
                        SAIPE_COUNTY_VINTAGE, county2023QueryUrl,
                        CURRENT_COUNTY_VINTAGE, county2025QueryUrl),
                HttpClient.newBuilder().connectTimeout(REQUEST_TIMEOUT).build(),
                new ObjectMapper());
    }

    AdministrativeGeometryService(
            Map<Integer, String> countyQueryUrls, HttpClient httpClient, ObjectMapper objectMapper) {
        if (countyQueryUrls == null || countyQueryUrls.isEmpty()) {
            throw new IllegalArgumentException("countyQueryUrls must not be empty.");
        }
        this.countyQueryUrls = countyQueryUrls.entrySet().stream()
                .collect(java.util.stream.Collectors.toUnmodifiableMap(
                        Map.Entry::getKey,
                        (entry) -> requireText(entry.getValue(), "countyQueryUrl")));
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
    }

    /** Returns deterministic county GeoJSON for the current supported county vintage. */
    public AdministrativeGeometry countiesForState(String stateFips) {
        return countiesForState(stateFips, CURRENT_COUNTY_VINTAGE);
    }

    /** Returns deterministic county GeoJSON for an explicit supported vintage and state FIPS. */
    public AdministrativeGeometry countiesForState(String stateFips, int vintage) {
        String normalizedStateFips = requireStateFips(stateFips);
        String queryUrl = countyQueryUrl(vintage);
        CountyCacheKey cacheKey = new CountyCacheKey(vintage, normalizedStateFips);
        ObjectNode cached = countyCache.get(cacheKey);
        if (cached != null) {
            return geometry(vintage, queryUrl, cached.deepCopy());
        }

        ObjectNode fetched = fetchCounties(normalizedStateFips, queryUrl);
        ObjectNode existing = countyCache.putIfAbsent(cacheKey, fetched);
        ObjectNode selected = existing == null ? fetched : existing;
        return geometry(vintage, queryUrl, selected.deepCopy());
    }

    private AdministrativeGeometry geometry(int vintage, String queryUrl, ObjectNode geoJson) {
        return new AdministrativeGeometry(vintage, URI.create(stripQuerySuffix(queryUrl)), ATTRIBUTION, geoJson);
    }

    private ObjectNode fetchCounties(String stateFips, String queryUrl) {
        HttpRequest request = HttpRequest.newBuilder(queryUri(queryUrl, stateFips))
                .timeout(REQUEST_TIMEOUT)
                .header("Accept", "application/geo+json, application/json")
                .GET()
                .build();

        HttpResponse<String> response;
        try {
            response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Census TIGERweb county geometry request was interrupted.", exception);
        } catch (IOException exception) {
            throw new IllegalStateException("Census TIGERweb county geometry request failed.", exception);
        }

        if (response.statusCode() >= 300) {
            throw new IllegalStateException(
                    "Census TIGERweb county geometry returned HTTP " + response.statusCode() + ".");
        }

        return parseAndValidate(response.body(), stateFips);
    }

    private ObjectNode parseAndValidate(String body, String stateFips) {
        final JsonNode parsed;
        try {
            parsed = objectMapper.readTree(body);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Census TIGERweb county geometry returned invalid JSON.", exception);
        }

        if (!(parsed instanceof ObjectNode root)
                || !"FeatureCollection".equals(root.path("type").asText())
                || !root.path("features").isArray()
                || root.path("features").isEmpty()) {
            throw new IllegalStateException("Census TIGERweb county geometry did not return a non-empty FeatureCollection.");
        }

        List<JsonNode> features = new ArrayList<>();
        Set<String> geoids = new HashSet<>();
        for (JsonNode feature : root.path("features")) {
            JsonNode properties = feature.path("properties");
            String geoid = properties.path("GEOID").asText();
            String featureState = properties.path("STATE").asText();
            JsonNode geometry = feature.path("geometry");
            String geometryType = geometry.path("type").asText();

            if (!geoid.matches("\\d{5}") || !geoid.startsWith(stateFips) || !stateFips.equals(featureState)) {
                throw new IllegalStateException("Census TIGERweb county geometry returned an invalid county GEOID.");
            }
            if (!geoids.add(geoid)) {
                throw new IllegalStateException("Census TIGERweb county geometry returned duplicate GEOID " + geoid + ".");
            }
            if (!("Polygon".equals(geometryType) || "MultiPolygon".equals(geometryType))
                    || !geometry.path("coordinates").isArray()
                    || geometry.path("coordinates").isEmpty()) {
                throw new IllegalStateException(
                        "Census TIGERweb county geometry returned invalid geometry for GEOID " + geoid + ".");
            }
            features.add(feature);
        }

        features.sort(Comparator.comparing((feature) -> feature.path("properties").path("GEOID").asText()));
        ObjectNode normalized = root.deepCopy();
        ArrayNode orderedFeatures = normalized.putArray("features");
        features.forEach((feature) -> orderedFeatures.add(feature.deepCopy()));
        return normalized;
    }

    private URI queryUri(String queryUrl, String stateFips) {
        return URI.create(queryUrl
                + "?where="
                + encode("STATE='" + stateFips + "'")
                + "&outFields="
                + encode(COUNTY_FIELDS)
                + "&returnGeometry=true&outSR=4326&orderByFields="
                + encode("GEOID ASC")
                + "&f=geojson");
    }

    private String countyQueryUrl(int vintage) {
        String queryUrl = countyQueryUrls.get(vintage);
        if (queryUrl == null) {
            throw new IllegalArgumentException("Unsupported county geometry vintage: " + vintage + ".");
        }
        return queryUrl;
    }

    private String requireStateFips(String stateFips) {
        if (stateFips == null || !stateFips.matches("\\d{2}")) {
            throw new IllegalArgumentException("stateFips must be exactly two digits.");
        }
        return stateFips;
    }

    private static String requireText(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(name + " must not be blank.");
        }
        return value.strip();
    }

    private static String stripQuerySuffix(String queryUrl) {
        return queryUrl.endsWith("/query") ? queryUrl.substring(0, queryUrl.length() - "/query".length()) : queryUrl;
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private record CountyCacheKey(int vintage, String stateFips) {}

    public record AdministrativeGeometry(int vintage, URI sourceUrl, String attribution, ObjectNode geoJson) {}
}
