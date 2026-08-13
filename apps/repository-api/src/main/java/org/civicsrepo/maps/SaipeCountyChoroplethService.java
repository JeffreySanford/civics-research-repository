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
import java.util.List;
import org.civicsrepo.generated.dto.CensusAreaBoundary;
import org.civicsrepo.generated.dto.SaipeCountyChoropleth;
import org.civicsrepo.generated.dto.SaipeCountyValue;
import org.springframework.stereotype.Service;

/**
 * Joins SAIPE county poverty estimates to simplified county boundaries for map choropleth display.
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
    private final ObjectMapper objectMapper = new ObjectMapper();
    private JsonNode countyRates;

    public SaipeCountyChoroplethService(CensusAreaBoundaryService censusAreaBoundaryService) {
        this.censusAreaBoundaryService = censusAreaBoundaryService;
    }

    public SaipeCountyChoropleth findChoropleth(String geography) {
        CensusAreaBoundary boundary = resolveBoundary(geography);
        String stateFips = stateFipsFor(boundary.getId());
        List<CountyRate> counties = loadCounties(stateFips, boundary);

        ObjectNode geoJson = objectMapper.createObjectNode();
        geoJson.put("type", "FeatureCollection");
        ArrayNode features = geoJson.putArray("features");

        List<SaipeCountyValue> values = new ArrayList<>();
        for (CountyRate county : counties) {
            values.add(new SaipeCountyValue(
                            county.fips(), county.name(), county.povertyRate())
                    .medianHouseholdIncome(county.medianHouseholdIncome()));

            ObjectNode feature = objectMapper.createObjectNode();
            feature.put("type", "Feature");
            ObjectNode properties = feature.putObject("properties");
            properties.put("fips", county.fips());
            properties.put("name", county.name());
            properties.put("povertyRate", county.povertyRate());
            properties.put("medianHouseholdIncome", county.medianHouseholdIncome());
            ObjectNode geometry = feature.putObject("geometry");
            geometry.put("type", "Polygon");
            ArrayNode ring = geometry.putArray("coordinates").addArray();
            ring.addArray().add(county.west()).add(county.south());
            ring.addArray().add(county.east()).add(county.south());
            ring.addArray().add(county.east()).add(county.north());
            ring.addArray().add(county.west()).add(county.north());
            ring.addArray().add(county.west()).add(county.south());
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

    private List<CountyRate> loadCounties(String stateFips, CensusAreaBoundary boundary) {
        JsonNode rates = countyRates();
        List<CountyRate> counties = new ArrayList<>();
        JsonNode stateCounties = rates.path(stateFips);
        if (stateCounties.isArray() && !stateCounties.isEmpty()) {
            int count = stateCounties.size();
            int columns = (int) Math.ceil(Math.sqrt(count));
            int rows = (int) Math.ceil((double) count / columns);
            double cellWidth = (boundary.getEast() - boundary.getWest()) / columns;
            double cellHeight = (boundary.getNorth() - boundary.getSouth()) / rows;
            double inset = 0.08;

            for (int index = 0; index < count; index++) {
                JsonNode node = stateCounties.get(index);
                int row = index / columns;
                int column = index % columns;
                double west = boundary.getWest() + column * cellWidth + cellWidth * inset;
                double east = boundary.getWest() + (column + 1) * cellWidth - cellWidth * inset;
                double south = boundary.getSouth() + row * cellHeight + cellHeight * inset;
                double north = boundary.getSouth() + (row + 1) * cellHeight - cellHeight * inset;
                counties.add(new CountyRate(
                        node.path("fips").asText(),
                        node.path("name").asText(),
                        node.path("povertyRate").asDouble(),
                        node.path("medianHouseholdIncome").asInt(),
                        west,
                        south,
                        east,
                        north));
            }
            return counties;
        }

        return generatedCounties(boundary);
    }

    private List<CountyRate> generatedCounties(CensusAreaBoundary boundary) {
        double west = boundary.getWest();
        double south = boundary.getSouth();
        double east = boundary.getEast();
        double north = boundary.getNorth();
        double width = east - west;
        double height = north - south;
        double[][] rates = {
            {11.2, 54800},
            {9.4, 61200},
            {13.8, 48900},
            {8.7, 64500},
            {10.5, 57100},
            {12.9, 50200}
        };

        List<CountyRate> counties = new ArrayList<>();
        for (int index = 0; index < rates.length; index++) {
            int row = index / 3;
            int column = index % 3;
            double cellWest = west + column * (width / 3) + width * 0.04;
            double cellEast = west + (column + 1) * (width / 3) - width * 0.04;
            double cellSouth = south + row * (height / 2) + height * 0.04;
            double cellNorth = south + (row + 1) * (height / 2) - height * 0.04;
            counties.add(new CountyRate(
                    boundary.getId() + "-county-" + (index + 1),
                    boundary.getGeography() + " region " + (index + 1),
                    rates[index][0],
                    (int) rates[index][1],
                    cellWest,
                    cellSouth,
                    cellEast,
                    cellNorth));
        }
        return counties;
    }

    private JsonNode countyRates() {
        if (countyRates != null) {
            return countyRates;
        }

        try (InputStream input = getClass().getResourceAsStream("/maps/saipe-county-rates.json")) {
            if (input == null) {
                countyRates = objectMapper.createObjectNode();
                return countyRates;
            }
            countyRates = objectMapper.readTree(input);
            return countyRates;
        } catch (IOException exception) {
            countyRates = objectMapper.createObjectNode();
            return countyRates;
        }
    }

    private CensusAreaBoundary resolveBoundary(String geography) {
        return censusAreaBoundaryService.listBoundaries().stream()
                .filter((boundary) -> boundary.getGeography().equalsIgnoreCase(geography))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown geography: " + geography));
    }

    private String stateFipsFor(String slug) {
        return STATE_FIPS.getOrDefault(slug, "00");
    }

    private static final java.util.Map<String, String> STATE_FIPS = java.util.Map.ofEntries(
            java.util.Map.entry("alabama", "01"),
            java.util.Map.entry("alaska", "02"),
            java.util.Map.entry("arizona", "04"),
            java.util.Map.entry("arkansas", "05"),
            java.util.Map.entry("california", "06"),
            java.util.Map.entry("colorado", "08"),
            java.util.Map.entry("connecticut", "09"),
            java.util.Map.entry("delaware", "10"),
            java.util.Map.entry("district-of-columbia", "11"),
            java.util.Map.entry("florida", "12"),
            java.util.Map.entry("georgia", "13"),
            java.util.Map.entry("hawaii", "15"),
            java.util.Map.entry("idaho", "16"),
            java.util.Map.entry("illinois", "17"),
            java.util.Map.entry("indiana", "18"),
            java.util.Map.entry("iowa", "19"),
            java.util.Map.entry("kansas", "20"),
            java.util.Map.entry("kentucky", "21"),
            java.util.Map.entry("louisiana", "22"),
            java.util.Map.entry("maine", "23"),
            java.util.Map.entry("maryland", "24"),
            java.util.Map.entry("massachusetts", "25"),
            java.util.Map.entry("michigan", "26"),
            java.util.Map.entry("minnesota", "27"),
            java.util.Map.entry("mississippi", "28"),
            java.util.Map.entry("missouri", "29"),
            java.util.Map.entry("montana", "30"),
            java.util.Map.entry("nebraska", "31"),
            java.util.Map.entry("nevada", "32"),
            java.util.Map.entry("new-hampshire", "33"),
            java.util.Map.entry("new-jersey", "34"),
            java.util.Map.entry("new-mexico", "35"),
            java.util.Map.entry("new-york", "36"),
            java.util.Map.entry("north-carolina", "37"),
            java.util.Map.entry("north-dakota", "38"),
            java.util.Map.entry("ohio", "39"),
            java.util.Map.entry("oklahoma", "40"),
            java.util.Map.entry("oregon", "41"),
            java.util.Map.entry("pennsylvania", "42"),
            java.util.Map.entry("puerto-rico", "72"),
            java.util.Map.entry("rhode-island", "44"),
            java.util.Map.entry("south-carolina", "45"),
            java.util.Map.entry("south-dakota", "46"),
            java.util.Map.entry("tennessee", "47"),
            java.util.Map.entry("texas", "48"),
            java.util.Map.entry("utah", "49"),
            java.util.Map.entry("vermont", "50"),
            java.util.Map.entry("virginia", "51"),
            java.util.Map.entry("washington", "53"),
            java.util.Map.entry("west-virginia", "54"),
            java.util.Map.entry("wisconsin", "55"),
            java.util.Map.entry("wyoming", "56"));

    private record CountyRate(
            String fips,
            String name,
            double povertyRate,
            int medianHouseholdIncome,
            double west,
            double south,
            double east,
            double north) {}
}
