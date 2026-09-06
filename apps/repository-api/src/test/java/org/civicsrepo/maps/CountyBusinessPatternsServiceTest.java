package org.civicsrepo.maps;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URI;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.junit.jupiter.api.Test;

class CountyBusinessPatternsServiceTest {
    private static final String HEADER =
            "GEOID,INDUSTRY_CODE,SOURCE_NAICS,ESTABLISHMENTS,EMPLOYMENT,EMPLOYMENT_NOISE_FLAG,FIRST_QUARTER_PAYROLL_THOUSANDS,FIRST_QUARTER_PAYROLL_NOISE_FLAG,ANNUAL_PAYROLL_THOUSANDS,ANNUAL_PAYROLL_NOISE_FLAG";

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void keepsPublishedZeroDistinctFromUnavailableIndustryRow() {
        byte[] csv = csv(
                "38001,TOTAL,------,0,0,G,0,G,0,G",
                "38001,11,11----,3,10,H,20,G,80,G",
                "38003,TOTAL,------,5,25,G,50,G,200,G");

        CountyBusinessPatternsService service = fixtureService(
                csv,
                Set.of("38001", "38003"),
                List.of("TOTAL", "11"));

        var total = service.findChoropleth(
                "North Dakota",
                CountyBusinessPatternsMeasure.ESTABLISHMENTS,
                "TOTAL",
                2023);

        assertThat(total.sourceReferenceYear()).isEqualTo(2023);
        assertThat(total.geometryVintage()).isEqualTo(2023);
        assertThat(total.availableCountyCount()).isEqualTo(2);
        assertThat(total.unavailableCountyCount()).isZero();
        assertThat(total.counties())
                .filteredOn(value -> value.fips().equals("38001"))
                .singleElement()
                .satisfies(value -> {
                    assertThat(value.available()).isTrue();
                    assertThat(value.value()).isZero();
                    assertThat(value.noiseFlag()).isNull();
                });

        var agriculture = service.findChoropleth(
                "North Dakota",
                CountyBusinessPatternsMeasure.ESTABLISHMENTS,
                "11",
                2023);

        assertThat(agriculture.availableCountyCount()).isEqualTo(1);
        assertThat(agriculture.unavailableCountyCount()).isEqualTo(1);
        assertThat(agriculture.counties())
                .filteredOn(value -> value.fips().equals("38003"))
                .singleElement()
                .satisfies(value -> {
                    assertThat(value.available()).isFalse();
                    assertThat(value.value()).isNull();
                });
    }

    @Test
    void exposesMeasureSpecificNoiseFlagAndCombinedSectorLabel() {
        byte[] csv = csv("38001,31,31----,4,99,J,120,H,500,G");
        CountyBusinessPatternsService service = fixtureService(csv, Set.of("38001"), List.of("31"));

        var employment = service.findChoropleth(
                "North Dakota",
                CountyBusinessPatternsMeasure.EMPLOYMENT,
                "31",
                2023);

        assertThat(employment.industryLabel()).isEqualTo("31-33 Manufacturing");
        assertThat(employment.units()).isEqualTo("people");
        assertThat(employment.counties())
                .singleElement()
                .satisfies(value -> {
                    assertThat(value.value()).isEqualTo(99L);
                    assertThat(value.noiseFlag()).isEqualTo("J");
                });
    }

    @Test
    void failsWhenRetainedIndustryValueHasNoAuthoritativeGeometry() {
        byte[] csv = csv("38001,11,11----,3,10,H,20,G,80,G");
        CountyBusinessPatternsService service = fixtureService(csv, Set.of("38003"), List.of("11"));

        assertThatThrownBy(() -> service.findChoropleth(
                        "North Dakota",
                        CountyBusinessPatternsMeasure.EMPLOYMENT,
                        "11",
                        2023))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("County Business Patterns GEOID 38001");
    }

    @Test
    void rejectsUnsupportedYearAndIndustry() {
        byte[] csv = csv("38001,TOTAL,------,3,10,H,20,G,80,G");
        CountyBusinessPatternsService service = fixtureService(csv, Set.of("38001"), List.of("TOTAL"));

        assertThatThrownBy(() -> service.findChoropleth(
                        "North Dakota",
                        CountyBusinessPatternsMeasure.ESTABLISHMENTS,
                        "TOTAL",
                        2022))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not supported");

        assertThatThrownBy(() -> service.findChoropleth(
                        "North Dakota",
                        CountyBusinessPatternsMeasure.ESTABLISHMENTS,
                        "12",
                        2023))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("industry 12 is not supported");
    }

    @Test
    void rejectsNonCountyAggregateInNormalizedResource() {
        byte[] csv = csv("38999,TOTAL,------,3,10,H,20,G,80,G");
        CountyBusinessPatternsService service = fixtureService(csv, Set.of("38001"), List.of("TOTAL"));

        assertThatThrownBy(() -> service.supportsGeography("North Dakota"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("non-county aggregate GEOID 38999");
    }

    @Test
    void productionPinnedSourceServesNorthDakotaTotals() {
        Set<String> geoids = productionGeoids("38", "TOTAL");
        CountyBusinessPatternsService service = new CountyBusinessPatternsService(
                new CensusAreaBoundaryService(),
                geometryService(geoids));

        assertThat(service.supportsGeography("North Dakota")).isTrue();

        var choropleth = service.findChoropleth(
                "North Dakota",
                CountyBusinessPatternsMeasure.ESTABLISHMENTS,
                "TOTAL",
                2023);

        assertThat(choropleth.counties()).hasSize(geoids.size());
        assertThat(choropleth.availableCountyCount()).isEqualTo(geoids.size());
        assertThat(choropleth.unavailableCountyCount()).isZero();
        assertThat(choropleth.sourceSha256())
                .isEqualTo("113b0be1437a511e84cc403fdad8f6041d24fdb4fd394b535dd391ecbfd34b85");
    }

    private CountyBusinessPatternsService fixtureService(
            byte[] csv,
            Set<String> geometryGeoids,
            List<String> industryCodes) {
        int counties = (int) java.util.Arrays.stream(new String(csv, StandardCharsets.UTF_8).split("\\R"))
                .skip(1)
                .filter(line -> !line.isBlank())
                .map(line -> line.substring(0, 5))
                .distinct()
                .count();
        int rows = (int) java.util.Arrays.stream(new String(csv, StandardCharsets.UTF_8).split("\\R"))
                .skip(1)
                .filter(line -> !line.isBlank())
                .count();

        return new CountyBusinessPatternsService(
                new CensusAreaBoundaryService(),
                geometryService(geometryGeoids),
                csv,
                metadata(csv, rows, counties, industryCodes));
    }

    private AdministrativeGeometryService geometryService(Set<String> geoids) {
        return new AdministrativeGeometryService(
                Map.of(2023, "https://example.test/tigerweb/2023/counties/query"),
                HttpClient.newHttpClient(),
                objectMapper) {
            @Override
            public AdministrativeGeometry countiesForState(String stateFips, int vintage) {
                if (vintage != 2023) {
                    throw new IllegalArgumentException("Unexpected geometry vintage: " + vintage);
                }

                ObjectNode root = objectMapper.createObjectNode();
                root.put("type", "FeatureCollection");
                ArrayNode features = root.putArray("features");
                geoids.stream().sorted().forEach(geoid -> {
                    ObjectNode feature = features.addObject();
                    feature.put("type", "Feature");
                    ObjectNode properties = feature.putObject("properties");
                    properties.put("GEOID", geoid);
                    properties.put("STATE", geoid.substring(0, 2));
                    properties.put("COUNTY", geoid.substring(2));
                    properties.put("NAME", "County " + geoid);
                    ObjectNode geometry = feature.putObject("geometry");
                    geometry.put("type", "Polygon");
                    ArrayNode ring = geometry.putArray("coordinates").addArray();
                    ring.addArray().add(-100.0).add(46.0);
                    ring.addArray().add(-99.9).add(46.0);
                    ring.addArray().add(-99.9).add(46.1);
                    ring.addArray().add(-100.0).add(46.1);
                    ring.addArray().add(-100.0).add(46.0);
                });

                return new AdministrativeGeometry(
                        vintage,
                        URI.create("https://example.test/tigerweb/2023/counties"),
                        "U.S. Census Bureau TIGERweb",
                        root);
            }
        };
    }

    private Set<String> productionGeoids(String stateFips, String industryCode) {
        try (var input = getClass().getResourceAsStream(
                "/maps/county-business-patterns/cbp-2023-county.csv")) {
            if (input == null) {
                throw new IllegalStateException("Missing County Business Patterns fixture.");
            }

            CSVFormat format = CSVFormat.DEFAULT.builder()
                    .setHeader()
                    .setSkipHeaderRecord(true)
                    .get();

            try (var reader = new java.io.InputStreamReader(input, StandardCharsets.UTF_8);
                    CSVParser parser = format.parse(reader)) {
                Set<String> geoids = new LinkedHashSet<>();
                for (var record : parser) {
                    String geoid = record.get("GEOID").strip();
                    if (geoid.startsWith(stateFips)
                            && industryCode.equals(record.get("INDUSTRY_CODE").strip())) {
                        geoids.add(geoid);
                    }
                }
                return Set.copyOf(geoids);
            }
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to read County Business Patterns GEOIDs.", exception);
        }
    }

    private byte[] csv(String... rows) {
        return (HEADER + "\n" + String.join("\n", rows) + "\n").getBytes(StandardCharsets.UTF_8);
    }

    private byte[] metadata(
            byte[] csv,
            int retainedRows,
            int retainedCounties,
            List<String> industryCodes) {
        ObjectNode root = objectMapper.createObjectNode();
        root.put("source", "U.S. Census Bureau County Business Patterns");
        root.put("sourceArchiveUrl", "https://example.test/cbp23co.zip");
        root.put("referenceYear", 2023);
        root.put("capturedAt", "2026-09-06");
        root.put("retainedRows", retainedRows);
        root.put("retainedCounties", retainedCounties);
        root.put("excludedStatewideRows", 0);
        root.put("countyEligibilityRule", "FIPSCTY != 999");
        root.put(
                "missingRowSemantics",
                "A missing county/industry row is unavailable in the published source and must not be interpreted as zero.");
        root.put("normalizedSha256", sha256(csv));
        ArrayNode supported = root.putArray("supportedIndustryCodes");
        industryCodes.forEach(supported::add);
        return root.toString().getBytes(StandardCharsets.UTF_8);
    }

    private String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }
}
