package org.civicsrepo.maps;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.civicsrepo.generated.dto.CensusAreaBoundary;
import org.civicsrepo.generated.dto.SaipeCountyChoropleth;
import org.civicsrepo.generated.dto.SaipeCountyValue;
import org.springframework.stereotype.Service;

/**
 * Joins retained SAIPE county poverty estimates to authoritative Census county geometry.
 *
 * <p>The thematic values and geometry remain separate authorities: the SAIPE dataset supplies the
 * measures while TIGERweb supplies January 1, 2023 county polygons. Missing value coverage is not
 * fabricated, and a retained value without matching GEOID geometry fails explicitly rather than
 * being silently dropped or rendered as a generated rectangle.
 */
@Service
public class SaipeCountyChoroplethService {
    private static final int VINTAGE = 2023;
    private static final String MEASURE_LABEL = "Poverty rate, all ages (percent)";
    private static final String ATTRIBUTION =
            "U.S. Census Bureau Small Area Income and Poverty Estimates (SAIPE)";
    private static final String SOURCE_URL =
            "https://www2.census.gov/programs-surveys/saipe/datasets/2023/2023-state-and-county/est23all.txt";

    private final CensusAreaBoundaryService censusAreaBoundaryService;
    private final AdministrativeGeometryService administrativeGeometryService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private JsonNode countyRates;

    public SaipeCountyChoroplethService(
            CensusAreaBoundaryService censusAreaBoundaryService,
            AdministrativeGeometryService administrativeGeometryService) {
        this.censusAreaBoundaryService = censusAreaBoundaryService;
        this.administrativeGeometryService = administrativeGeometryService;
    }

    /** True only when this repository actually retains SAIPE values for the geography. */
    public boolean supportsGeography(String geography) {
        if (geography == null || geography.isBlank()) {
            return false;
        }
        return censusAreaBoundaryService.listBoundaries().stream()
                .filter((boundary) -> boundary.getGeography().equalsIgnoreCase(geography))
                .map(CensusAreaBoundary::getId)
                .map(STATE_FIPS::get)
                .filter((stateFips) -> stateFips != null)
                .anyMatch(this::hasRates);
    }

    public SaipeCountyChoropleth findChoropleth(String geography) {
        CensusAreaBoundary boundary = resolveBoundary(geography);
        String stateFips = stateFipsFor(boundary.getId());
        List<CountyRate> counties = loadCountyRates(stateFips);
        if (counties.isEmpty()) {
            throw new IllegalArgumentException(
                    "No retained SAIPE " + VINTAGE + " county values are available for " + boundary.getGeography() + ".");
        }

        AdministrativeGeometryService.AdministrativeGeometry administrativeGeometry =
                administrativeGeometryService.countiesForState(stateFips, VINTAGE);
        Map<String, JsonNode> geometryByGeoid = geometryByGeoid(administrativeGeometry.geoJson());

        ObjectNode geoJson = objectMapper.createObjectNode();
        geoJson.put("type", "FeatureCollection");
        geoJson.put("thematicVintage", VINTAGE);
        geoJson.put("geometryVintage", administrativeGeometry.vintage());
        geoJson.put("geometrySourceUrl", administrativeGeometry.sourceUrl().toString());
        geoJson.put("geometryAttribution", administrativeGeometry.attribution());
        ArrayNode features = geoJson.putArray("features");

        List<SaipeCountyValue> values = new ArrayList<>();
        for (CountyRate county : counties) {
            JsonNode sourceFeature = geometryByGeoid.get(county.fips());
            if (sourceFeature == null) {
                throw new IllegalStateException(
                        "No authoritative Census county geometry was returned for retained SAIPE GEOID "
                                + county.fips()
                                + ".");
            }

            values.add(new SaipeCountyValue(
                            county.fips(), county.name(), county.povertyRate())
                    .medianHouseholdIncome(county.medianHouseholdIncome()));

            ObjectNode feature = sourceFeature.deepCopy();
            ObjectNode properties = feature.withObject("properties");
            properties.put("fips", county.fips());
            properties.put("name", county.name());
            properties.put("povertyRate", county.povertyRate());
            properties.put("medianHouseholdIncome", county.medianHouseholdIncome());
            features.add(feature);
        }

        values.sort(Comparator.comparing(SaipeCountyValue::getName));
        return new SaipeCountyChoropleth(
                "SAIPE " + VINTAGE + " county poverty - " + boundary.getGeography(),
                URI.create(SOURCE_URL),
                ATTRIBUTION,
                boundary.getGeography(),
                VINTAGE,
                MEASURE_LABEL,
                objectMapper.convertValue(geoJson, java.util.Map.class),
                values);
    }

    private Map<String, JsonNode> geometryByGeoid(ObjectNode geoJson) {
        Map<String, JsonNode> geometryByGeoid = new LinkedHashMap<>();
        for (JsonNode feature : geoJson.path("features")) {
            String geoid = feature.path("properties").path("GEOID").asText();
            if (!geoid.isBlank()) {
                geometryByGeoid.put(geoid, feature);
            }
        }
        return geometryByGeoid;
    }

    private List<CountyRate> loadCountyRates(String stateFips) {
        JsonNode stateCounties = countyRates().path(stateFips);
        if (!stateCounties.isArray() || stateCounties.isEmpty()) {
            return List.of();
        }

        List<CountyRate> counties = new ArrayList<>();
        for (JsonNode node : stateCounties) {
            counties.add(new CountyRate(
                    node.path("fips").asText(),
                    node.path("name").asText(),
                    node.path("povertyRate").asDouble(),
                    node.path("medianHouseholdIncome").asInt()));
        }
        counties.sort(Comparator.comparing(CountyRate::fips));
        return List.copyOf(counties);
    }

    private boolean hasRates(String stateFips) {
        JsonNode stateCounties = countyRates().path(stateFips);
        return stateCounties.isArray() && !stateCounties.isEmpty();
    }

    private JsonNode countyRates() {
        if (countyRates != null) {
            return countyRates;
        }

        try (InputStream input = getClass().getResourceAsStream("/maps/saipe-county-rates.json")) {
            if (input == null) {
                throw new IllegalStateException("SAIPE county-rate fixture is missing.");
            }
            countyRates = objectMapper.readTree(input);
            return countyRates;
        } catch (IOException exception) {
            throw new IllegalStateException("SAIPE county-rate fixture could not be read.", exception);
        }
    }

    private CensusAreaBoundary resolveBoundary(String geography) {
        return censusAreaBoundaryService.listBoundaries().stream()
                .filter((boundary) -> boundary.getGeography().equalsIgnoreCase(geography))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown geography: " + geography));
    }

    private String stateFipsFor(String slug) {
        String stateFips = STATE_FIPS.get(slug);
        if (stateFips == null) {
            throw new IllegalArgumentException("No state FIPS mapping is configured for geography slug: " + slug);
        }
        return stateFips;
    }

    private static final Map<String, String> STATE_FIPS = Map.ofEntries(
            Map.entry("alabama", "01"),
            Map.entry("alaska", "02"),
            Map.entry("arizona", "04"),
            Map.entry("arkansas", "05"),
            Map.entry("california", "06"),
            Map.entry("colorado", "08"),
            Map.entry("connecticut", "09"),
            Map.entry("delaware", "10"),
            Map.entry("district-of-columbia", "11"),
            Map.entry("florida", "12"),
            Map.entry("georgia", "13"),
            Map.entry("hawaii", "15"),
            Map.entry("idaho", "16"),
            Map.entry("illinois", "17"),
            Map.entry("indiana", "18"),
            Map.entry("iowa", "19"),
            Map.entry("kansas", "20"),
            Map.entry("kentucky", "21"),
            Map.entry("louisiana", "22"),
            Map.entry("maine", "23"),
            Map.entry("maryland", "24"),
            Map.entry("massachusetts", "25"),
            Map.entry("michigan", "26"),
            Map.entry("minnesota", "27"),
            Map.entry("mississippi", "28"),
            Map.entry("missouri", "29"),
            Map.entry("montana", "30"),
            Map.entry("nebraska", "31"),
            Map.entry("nevada", "32"),
            Map.entry("new-hampshire", "33"),
            Map.entry("new-jersey", "34"),
            Map.entry("new-mexico", "35"),
            Map.entry("new-york", "36"),
            Map.entry("north-carolina", "37"),
            Map.entry("north-dakota", "38"),
            Map.entry("ohio", "39"),
            Map.entry("oklahoma", "40"),
            Map.entry("oregon", "41"),
            Map.entry("pennsylvania", "42"),
            Map.entry("puerto-rico", "72"),
            Map.entry("rhode-island", "44"),
            Map.entry("south-carolina", "45"),
            Map.entry("south-dakota", "46"),
            Map.entry("tennessee", "47"),
            Map.entry("texas", "48"),
            Map.entry("utah", "49"),
            Map.entry("vermont", "50"),
            Map.entry("virginia", "51"),
            Map.entry("washington", "53"),
            Map.entry("west-virginia", "54"),
            Map.entry("wisconsin", "55"),
            Map.entry("wyoming", "56"));

    private record CountyRate(String fips, String name, double povertyRate, int medianHouseholdIncome) {}
}
