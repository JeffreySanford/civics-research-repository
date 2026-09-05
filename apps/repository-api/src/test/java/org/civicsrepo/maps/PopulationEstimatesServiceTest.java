package org.civicsrepo.maps;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URI;
import java.net.http.HttpClient;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.civicsrepo.generated.dto.PopulationEstimateMeasure;
import org.junit.jupiter.api.Test;

class PopulationEstimatesServiceTest {
    private final ObjectMapper objectMapper =
            new ObjectMapper();

    @Test
    void servesPinnedNorthDakotaGrowthOnMatching2025Geometry() {
        PopulationEstimatesService service =
                new PopulationEstimatesService(
                        new CensusAreaBoundaryService(),
                        productionGeometryService(null));

        var choropleth =
                service.findChoropleth(
                        "North Dakota",
                        PopulationEstimateMeasure
                                .ANNUAL_GROWTH_RATE,
                        2025);

        assertThat(choropleth.getGeography())
                .isEqualTo("North Dakota");
        assertThat(choropleth.getSourceVintage())
                .isEqualTo(2025);
        assertThat(choropleth.getGeometryVintage())
                .isEqualTo(2025);
        assertThat(choropleth.getYear())
                .isEqualTo(2025);
        assertThat(choropleth.getPriorYear())
                .isEqualTo(2024);
        assertThat(choropleth.getUnits())
                .isEqualTo("percent");
        assertThat(choropleth.getSourceSha256())
                .isEqualTo(
                        "4f5a499d851e2cb48fd7a5405e5a9235453a8a66933657aacd10df0e264f35d5");

        assertThat(choropleth.getCounties())
                .hasSize(53);

        assertThat(
                        choropleth.getCounties()
                                .stream()
                                .allMatch(
                                        county ->
                                                county
                                                                .getPriorPopulation()
                                                        != null))
                .isTrue();

        @SuppressWarnings("unchecked")
        var features =
                (List<Map<String, Object>>)
                        choropleth.getGeoJson()
                                .get("features");

        assertThat(features).hasSize(53);
    }

    @Test
    void derivesAnnualChangeAndGrowthFromPopulationSeries() {
        byte[] csv =
                singleCountyCsv().getBytes(
                        Charset.forName(
                                "windows-1252"));

        PopulationEstimatesService service =
                fixtureService(
                        csv,
                        Set.of("38001"));

        var change =
                service.findChoropleth(
                        "North Dakota",
                        PopulationEstimateMeasure
                                .ANNUAL_CHANGE,
                        2025);

        assertThat(change.getCounties())
                .singleElement()
                .satisfies(
                        county -> {
                            assertThat(county.getPopulation())
                                    .isEqualTo(121L);
                            assertThat(
                                            county
                                                    .getPriorPopulation())
                                    .isEqualTo(110L);
                            assertThat(county.getValue())
                                    .isEqualTo(11.0d);
                        });

        var growth =
                service.findChoropleth(
                        "North Dakota",
                        PopulationEstimateMeasure
                                .ANNUAL_GROWTH_RATE,
                        2025);

        assertThat(growth.getCounties())
                .singleElement()
                .extracting(
                        county -> county.getValue())
                .isEqualTo(10.0d);

        var population =
                service.findChoropleth(
                        "North Dakota",
                        PopulationEstimateMeasure
                                .POPULATION,
                        2020);

        assertThat(population.getPriorYear())
                .isNull();
        assertThat(population.getCounties())
                .singleElement()
                .satisfies(
                        county -> {
                            assertThat(county.getValue())
                                    .isEqualTo(100.0d);
                            assertThat(
                                            county
                                                    .getPriorPopulation())
                                    .isNull();
                        });
    }

    @Test
    void rejectsChangeMeasureFor2020() {
        byte[] csv =
                singleCountyCsv().getBytes(
                        Charset.forName(
                                "windows-1252"));

        PopulationEstimatesService service =
                fixtureService(
                        csv,
                        Set.of("38001"));

        assertThatThrownBy(
                        () ->
                                service.findChoropleth(
                                        "North Dakota",
                                        PopulationEstimateMeasure
                                                .ANNUAL_CHANGE,
                                        2020))
                .isInstanceOf(
                        IllegalArgumentException.class)
                .hasMessageContaining(
                        "not supported");
    }

    @Test
    void rejectsDuplicateCountyGeoids() {
        String header =
                singleCountyCsv()
                        .substring(
                                0,
                                singleCountyCsv()
                                        .indexOf('\n'));

        String row =
                singleCountyCsv()
                        .substring(
                                singleCountyCsv()
                                                .indexOf('\n')
                                        + 1)
                        .strip();

        byte[] csv =
                (header
                                + "\n"
                                + row
                                + "\n"
                                + row
                                + "\n")
                        .getBytes(
                                Charset.forName(
                                        "windows-1252"));

        PopulationEstimatesService service =
                new PopulationEstimatesService(
                        new CensusAreaBoundaryService(),
                        geometryService(
                                Set.of("38001"),
                                null),
                        csv,
                        metadata(csv, 2));

        assertThatThrownBy(
                        () ->
                                service.supportsGeography(
                                        "North Dakota"))
                .isInstanceOf(
                        IllegalStateException.class)
                .hasMessageContaining(
                        "duplicate county GEOID 38001");
    }

    @Test
    void failsWhenRetainedValueHasNoAuthoritativeGeometry() {
        byte[] csv =
                singleCountyCsv().getBytes(
                        Charset.forName(
                                "windows-1252"));

        PopulationEstimatesService service =
                new PopulationEstimatesService(
                        new CensusAreaBoundaryService(),
                        geometryService(
                                Set.of(),
                                null),
                        csv,
                        metadata(csv, 1));

        assertThatThrownBy(
                        () ->
                                service.findChoropleth(
                                        "North Dakota",
                                        PopulationEstimateMeasure
                                                .POPULATION,
                                        2025))
                .isInstanceOf(
                        IllegalStateException.class)
                .hasMessageContaining(
                        "Population Estimates GEOID 38001");
    }

    @Test
    void claimsCoverageOnlyWherePinnedPepValuesExist() {
        PopulationEstimatesService service =
                new PopulationEstimatesService(
                        new CensusAreaBoundaryService(),
                        productionGeometryService(null));

        assertThat(
                        service.supportsGeography(
                                "North Dakota"))
                .isTrue();

        // The downloaded Vintage 2025 file contains 51 SUMLEV=040
        // state/DC rows and does not retain Puerto Rico county values.
        assertThat(
                        service.supportsGeography(
                                "Puerto Rico"))
                .isFalse();

        assertThat(
                        service.supportsGeography(
                                "Atlantis"))
                .isFalse();
    }

    private PopulationEstimatesService fixtureService(
            byte[] csv,
            Set<String> geoids) {
        return new PopulationEstimatesService(
                new CensusAreaBoundaryService(),
                geometryService(geoids, null),
                csv,
                metadata(csv, geoids.size()));
    }

    private AdministrativeGeometryService
            productionGeometryService(
                    String omittedGeoid) {
        return geometryService(
                productionGeoids("38"),
                omittedGeoid);
    }

    private AdministrativeGeometryService geometryService(
            Set<String> geoids,
            String omittedGeoid) {
        return new AdministrativeGeometryService(
                Map.of(
                        2025,
                        "https://example.test/tigerweb/2025/counties/query"),
                HttpClient.newHttpClient(),
                objectMapper) {
            @Override
            public AdministrativeGeometry countiesForState(
                    String stateFips,
                    int vintage) {
                if (vintage != 2025) {
                    throw new IllegalArgumentException(
                            "Unexpected geometry vintage: "
                                    + vintage);
                }

                ObjectNode root =
                        objectMapper.createObjectNode();
                root.put(
                        "type",
                        "FeatureCollection");
                ArrayNode features =
                        root.putArray("features");

                geoids.stream()
                        .sorted()
                        .filter(
                                geoid ->
                                        !geoid.equals(
                                                omittedGeoid))
                        .forEach(
                                geoid -> {
                                    ObjectNode feature =
                                            features
                                                    .addObject();
                                    feature.put(
                                            "type",
                                            "Feature");

                                    ObjectNode properties =
                                            feature
                                                    .putObject(
                                                            "properties");
                                    properties.put(
                                            "GEOID",
                                            geoid);
                                    properties.put(
                                            "STATE",
                                            geoid.substring(
                                                    0,
                                                    2));
                                    properties.put(
                                            "COUNTY",
                                            geoid.substring(
                                                    2));
                                    properties.put(
                                            "NAME",
                                            "County "
                                                    + geoid);

                                    ObjectNode geometry =
                                            feature
                                                    .putObject(
                                                            "geometry");
                                    geometry.put(
                                            "type",
                                            "Polygon");

                                    ArrayNode ring =
                                            geometry
                                                    .putArray(
                                                            "coordinates")
                                                    .addArray();

                                    ring.addArray()
                                            .add(-100.0)
                                            .add(46.0);
                                    ring.addArray()
                                            .add(-99.9)
                                            .add(46.0);
                                    ring.addArray()
                                            .add(-99.9)
                                            .add(46.1);
                                    ring.addArray()
                                            .add(-100.0)
                                            .add(46.1);
                                    ring.addArray()
                                            .add(-100.0)
                                            .add(46.0);
                                });

                return new AdministrativeGeometry(
                        vintage,
                        URI.create(
                                "https://example.test/tigerweb/2025/counties"),
                        "U.S. Census Bureau TIGERweb",
                        root);
            }
        };
    }

    private Set<String> productionGeoids(
            String stateFips) {
        try (var input =
                        getClass()
                                .getResourceAsStream(
                                        "/maps/population-estimates/co-est2025-alldata.csv")) {
            if (input == null) {
                throw new IllegalStateException(
                        "Missing Population Estimates fixture.");
            }

            CSVFormat format =
                    CSVFormat.DEFAULT
                            .builder()
                            .setHeader()
                            .setSkipHeaderRecord(true)
                            .get();

            try (var reader =
                            new java.io.InputStreamReader(
                                    input,
                                    Charset.forName(
                                            "windows-1252"));
                    CSVParser parser =
                            format.parse(reader)) {

                Set<String> geoids =
                        new java.util.LinkedHashSet<>();

                for (var record : parser) {
                    if ("050".equals(
                                    record
                                            .get("SUMLEV")
                                            .strip())
                            && stateFips.equals(
                                    record
                                            .get("STATE")
                                            .strip())) {
                        geoids.add(
                                stateFips
                                        + record
                                                .get(
                                                        "COUNTY")
                                                .strip());
                    }
                }

                return Set.copyOf(geoids);
            }
        } catch (Exception exception) {
            throw new IllegalStateException(
                    "Unable to read Population Estimates GEOIDs.",
                    exception);
        }
    }

    private byte[] metadata(
            byte[] csv,
            int countyRows) {
        ObjectNode root =
                objectMapper.createObjectNode();

        root.put(
                "source",
                "U.S. Census Bureau Population Estimates Program");
        root.put(
                "sourceUrl",
                "https://example.test/co-est2025-alldata.csv");
        root.put("vintage", 2025);
        root.put(
                "capturedAt",
                "2026-09-05");
        root.put(
                "sourceEncoding",
                "windows-1252");
        root.put(
                "countyRows",
                countyRows);
        root.put(
                "annualChangeColumnsValidated",
                true);

        try {
            root.put(
                    "sha256",
                    HexFormat.of()
                            .formatHex(
                                    MessageDigest
                                            .getInstance(
                                                    "SHA-256")
                                            .digest(csv)));
        } catch (Exception exception) {
            throw new IllegalStateException(
                    exception);
        }

        ArrayNode populationYears =
                root.putArray(
                        "supportedPopulationYears");
        for (int year = 2020;
                year <= 2025;
                year++) {
            populationYears.add(year);
        }

        ArrayNode changeYears =
                root.putArray(
                        "supportedChangeYears");
        for (int year = 2021;
                year <= 2025;
                year++) {
            changeYears.add(year);
        }

        return root.toString()
                .getBytes(StandardCharsets.UTF_8);
    }

    private String singleCountyCsv() {
        return """
                SUMLEV,STATE,COUNTY,STNAME,CTYNAME,POPESTIMATE2020,POPESTIMATE2021,POPESTIMATE2022,POPESTIMATE2023,POPESTIMATE2024,POPESTIMATE2025,NPOPCHG2021,NPOPCHG2022,NPOPCHG2023,NPOPCHG2024,NPOPCHG2025
                050,38,001,North Dakota,Adams County,100,105,103,110,110,121,5,-2,7,0,11
                """;
    }
}
