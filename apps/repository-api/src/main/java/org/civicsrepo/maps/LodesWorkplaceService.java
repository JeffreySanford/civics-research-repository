package org.civicsrepo.maps;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.zip.GZIPInputStream;
import org.civicsrepo.generated.dto.LodesWorkplaceOverlay;
import org.civicsrepo.generated.dto.LodesWorkplaceSummary;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Jobs counted where they are worked, from the LODES Workplace Area Characteristics file.
 *
 * <p>The commuting flows answer who travels between counties. They do not answer how much work sits
 * at either end, and a line from a small county into a large one looks the same as the reverse. WAC
 * supplies the missing half: Cass County holds 131,603 jobs against Burleigh's 59,122, which is why
 * the flows point the way they do.
 *
 * <p>WAC files are an order of magnitude smaller than their origin-destination counterparts —
 * 249 KB for North Dakota, 6.3 MB for California against 97 MB — because they carry one row per
 * workplace block rather than one per block pair. Every state can therefore be derived live, with no
 * size budget of the kind the flow client needs.
 */
@Service
public class LodesWorkplaceService {
    private static final Logger LOGGER = LoggerFactory.getLogger(LodesWorkplaceService.class);
    private static final Duration TIMEOUT = Duration.ofSeconds(60);
    private static final String URL_TEMPLATE =
            "https://lehd.ces.census.gov/data/lodes/LODES8/%s/wac/%s_wac_S000_JT00_%d.csv.gz";
    private static final String ATTRIBUTION =
            "U.S. Census Bureau LEHD Workplace Area Characteristics";

    private final HttpClient httpClient =
            HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final Map<String, LodesWorkplaceOverlay> cache = new ConcurrentHashMap<>();
    private final CensusAreaBoundaryService censusAreaBoundaryService;
    private final CountyGazetteer countyGazetteer;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final boolean enabled;
    private final int vintage;

    public LodesWorkplaceService(
            CensusAreaBoundaryService censusAreaBoundaryService,
            CountyGazetteer countyGazetteer,
            @Value("${civics.maps.lodes.live-enabled:true}") boolean enabled,
            @Value("${civics.maps.lodes.vintage:2023}") int vintage) {
        this.censusAreaBoundaryService = censusAreaBoundaryService;
        this.countyGazetteer = countyGazetteer;
        this.enabled = enabled;
        this.vintage = vintage;
    }

    public LodesWorkplaceOverlay findWorkplaceEmployment(String geography) {
        var boundary = censusAreaBoundaryService.listBoundaries().stream()
                .filter(candidate -> candidate.getGeography().equalsIgnoreCase(geography))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown Census area: " + geography));

        return cache.computeIfAbsent(boundary.getGeography(), key -> build(boundary.getId(), key));
    }

    private LodesWorkplaceOverlay build(String slug, String geography) {
        String abbreviation = StateAbbreviations.forSlug(slug);
        List<CountyJobs> counties = abbreviation.isBlank() ? List.of() : derive(abbreviation);

        ObjectNode geoJson = objectMapper.createObjectNode();
        geoJson.put("type", "FeatureCollection");
        ArrayNode features = geoJson.putArray("features");

        int total = counties.stream().mapToInt(CountyJobs::jobCount).sum();
        int maxJobCount = counties.stream().mapToInt(CountyJobs::jobCount).max().orElse(0);

        List<LodesWorkplaceSummary> places = new ArrayList<>();
        for (CountyJobs county : counties) {
            double share = total == 0 ? 0 : (county.jobCount() * 100.0) / total;
            LodesWorkplaceSummary summary = new LodesWorkplaceSummary(
                    county.id(), county.countyName(), county.jobCount(), Math.round(share * 10) / 10.0);
            places.add(summary);

            ObjectNode feature = features.addObject();
            feature.put("type", "Feature");
            ObjectNode properties = feature.putObject("properties");
            properties.put("id", county.id());
            properties.put("countyName", county.countyName());
            properties.put("jobs", county.jobCount());
            properties.put("label", county.countyName() + ": " + county.jobCount() + " jobs");
            ObjectNode geometry = feature.putObject("geometry");
            geometry.put("type", "Point");
            geometry.putArray("coordinates").add(county.longitude()).add(county.latitude());
        }

        boolean fallback = counties.isEmpty();
        String source = fallback
                ? "LEHD LODES %d workplace employment unavailable - %s".formatted(vintage, geography)
                : "LEHD LODES %d workplace employment - %s".formatted(vintage, geography);

        return new LodesWorkplaceOverlay(
                source,
                sourceUrl(abbreviation.isBlank() ? "us" : abbreviation),
                ATTRIBUTION,
                geography,
                vintage,
                fallback,
                objectMapper.convertValue(geoJson, Map.class),
                maxJobCount,
                places);
    }

    public URI sourceUrl(String stateAbbreviation) {
        String state = stateAbbreviation.toLowerCase(Locale.ROOT);
        return URI.create(URL_TEMPLATE.formatted(state, state, vintage));
    }

    private List<CountyJobs> derive(String stateAbbreviation) {
        if (!enabled || !countyGazetteer.isAvailable()) {
            return List.of();
        }

        String state = stateAbbreviation.toLowerCase(Locale.ROOT);
        Map<String, Integer> byCounty = new HashMap<>();

        try {
            HttpResponse<java.io.InputStream> response = httpClient.send(
                    HttpRequest.newBuilder(sourceUrl(state))
                            .timeout(TIMEOUT)
                            .header("User-Agent", "civics-research-repository/0.1 (+local demo)")
                            .GET()
                            .build(),
                    HttpResponse.BodyHandlers.ofInputStream());

            if (response.statusCode() >= 300) {
                // Not every state participates in LEHD; Alaska publishes no WAC file either.
                LOGGER.info("No LODES WAC file for {} ({}).", state.toUpperCase(Locale.ROOT), response.statusCode());
                return List.of();
            }

            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(new GZIPInputStream(response.body()), StandardCharsets.UTF_8))) {
                String header = reader.readLine();
                if (header == null) {
                    return List.of();
                }

                List<String> columns = List.of(header.split(","));
                int workIndex = columns.indexOf("w_geocode");
                int totalIndex = columns.indexOf("C000");
                if (workIndex < 0 || totalIndex < 0) {
                    LOGGER.warn("LODES WAC file for {} has an unexpected header.", state);
                    return List.of();
                }

                String line;
                while ((line = reader.readLine()) != null) {
                    String[] values = line.split(",");
                    if (values.length <= Math.max(workIndex, totalIndex)) {
                        continue;
                    }
                    String block = values[workIndex].trim();
                    if (block.length() < 5) {
                        continue;
                    }
                    try {
                        byCounty.merge(block.substring(0, 5), Integer.parseInt(values[totalIndex].trim()), Integer::sum);
                    } catch (NumberFormatException exception) {
                        // One malformed row does not invalidate the rest of the file.
                    }
                }
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return List.of();
        } catch (Exception exception) {
            LOGGER.info("LODES WAC file for {} could not be read: {}", state, exception.getMessage());
            return List.of();
        }

        List<CountyJobs> counties = byCounty.entrySet().stream()
                .map(entry -> countyGazetteer
                        .find(entry.getKey())
                        .map(county -> new CountyJobs(
                                "wac-" + entry.getKey(),
                                county.shortName(),
                                entry.getValue(),
                                county.longitude(),
                                county.latitude()))
                        .orElse(null))
                .filter(java.util.Objects::nonNull)
                .sorted((left, right) -> Integer.compare(right.jobCount(), left.jobCount()))
                .toList();

        LOGGER.info(
                "Derived workplace employment for {} counties in {} from the {} LODES WAC file.",
                counties.size(),
                state.toUpperCase(Locale.ROOT),
                vintage);
        return counties;
    }

    private record CountyJobs(String id, String countyName, int jobCount, double longitude, double latitude) {}
}
