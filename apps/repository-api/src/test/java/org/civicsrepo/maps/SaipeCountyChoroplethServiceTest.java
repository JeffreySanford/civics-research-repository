package org.civicsrepo.maps;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.util.Map;
import org.junit.jupiter.api.Test;

class SaipeCountyChoroplethServiceTest {
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final SaipeCountyChoroplethService choroplethService = new SaipeCountyChoroplethService(
            new CensusAreaBoundaryService(), fixtureGeometryService(null));

    @Test
    void servesNorthDakotaCountyValuesOnMatching2023Geometry() {
        var choropleth = choroplethService.findChoropleth("North Dakota");

        assertThat(choropleth.getGeography()).isEqualTo("North Dakota");
        assertThat(choropleth.getCounties()).hasSize(53);
        assertThat(choropleth.getCounties().getFirst().getPovertyRate()).isPositive();

        Map<?, ?> geoJson = choropleth.getGeoJson();
        assertThat(geoJson).containsEntry("geometryVintage", 2023);
        assertThat(geoJson).containsEntry("thematicVintage", 2023);
        assertThat(geoJson.get("geometrySourceUrl")).isEqualTo("https://example.test/tigerweb/2023/counties");

        @SuppressWarnings("unchecked")
        var features = (java.util.List<Map<String, Object>>) geoJson.get("features");
        assertThat(features).hasSize(53);
        assertThat(features.getFirst().get("geometry")).isNotNull();
        @SuppressWarnings("unchecked")
        var properties = (Map<String, Object>) features.getFirst().get("properties");
        assertThat(properties).containsKeys("GEOID", "fips", "povertyRate", "medianHouseholdIncome");
    }

    @Test
    void servesOnlyRetainedCaliforniaCountyValues() {
        var choropleth = choroplethService.findChoropleth("California");

        assertThat(choropleth.getGeography()).isEqualTo("California");
        assertThat(choropleth.getCounties()).hasSize(10);
        @SuppressWarnings("unchecked")
        var features = (java.util.List<Map<String, Object>>) choropleth.getGeoJson().get("features");
        assertThat(features).hasSize(10);
    }

    @Test
    void doesNotClaimSaipeCoverageWhereNoValuesAreRetained() {
        assertThat(choroplethService.supportsGeography("North Dakota")).isTrue();
        assertThat(choroplethService.supportsGeography("California")).isTrue();
        assertThat(choroplethService.supportsGeography("Texas")).isTrue();
        assertThat(choroplethService.supportsGeography("Florida")).isFalse();

        assertThatThrownBy(() -> choroplethService.findChoropleth("Florida"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("No retained SAIPE 2023 county values");
    }

    @Test
    void failsWhenRetainedValueHasNoAuthoritativeGeometry() {
        var missingGeometryService = new SaipeCountyChoroplethService(
                new CensusAreaBoundaryService(), fixtureGeometryService("38001"));

        assertThatThrownBy(() -> missingGeometryService.findChoropleth("North Dakota"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("retained SAIPE GEOID 38001");
    }

    private AdministrativeGeometryService fixtureGeometryService(String omittedGeoid) {
        return new AdministrativeGeometryService(
                Map.of(2023, "https://example.test/tigerweb/2023/counties/query"),
                HttpClient.newHttpClient(),
                objectMapper) {
            @Override
            public AdministrativeGeometry countiesForState(String stateFips, int vintage) {
                if (vintage != 2023) {
                    throw new IllegalArgumentException("Unexpected geometry vintage in fixture: " + vintage);
                }
                return new AdministrativeGeometry(
                        vintage,
                        URI.create("https://example.test/tigerweb/2023/counties"),
                        "U.S. Census Bureau TIGERweb",
                        fixtureGeoJson(stateFips, omittedGeoid));
            }
        };
    }

    private ObjectNode fixtureGeoJson(String stateFips, String omittedGeoid) {
        JsonNode rates = fixtureRates().path(stateFips);
        ObjectNode root = objectMapper.createObjectNode();
        root.put("type", "FeatureCollection");
        ArrayNode features = root.putArray("features");
        for (JsonNode rate : rates) {
            String geoid = rate.path("fips").asText();
            if (geoid.equals(omittedGeoid)) {
                continue;
            }
            ObjectNode feature = features.addObject();
            feature.put("type", "Feature");
            ObjectNode properties = feature.putObject("properties");
            properties.put("GEOID", geoid);
            properties.put("STATE", stateFips);
            properties.put("COUNTY", geoid.substring(2));
            properties.put("NAME", rate.path("name").asText());
            ObjectNode geometry = feature.putObject("geometry");
            geometry.put("type", "Polygon");
            ArrayNode ring = geometry.putArray("coordinates").addArray();
            ring.addArray().add(-100.0).add(46.0);
            ring.addArray().add(-99.9).add(46.0);
            ring.addArray().add(-99.9).add(46.1);
            ring.addArray().add(-100.0).add(46.1);
            ring.addArray().add(-100.0).add(46.0);
        }
        return root;
    }

    private JsonNode fixtureRates() {
        try (var input = getClass().getResourceAsStream("/maps/saipe-county-rates.json")) {
            if (input == null) {
                throw new IllegalStateException("Missing SAIPE fixture.");
            }
            return objectMapper.readTree(input);
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to read SAIPE fixture.", exception);
        }
    }
}
