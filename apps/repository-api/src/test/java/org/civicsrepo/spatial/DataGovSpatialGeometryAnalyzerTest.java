package org.civicsrepo.spatial;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class DataGovSpatialGeometryAnalyzerTest {
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void analyzesPublisherBoundingPolygonAndDerivesBounds() throws Exception {
        var geometry = objectMapper.readTree(
                """
                {"type":"Polygon","coordinates":[[[-101,46],[-99,46],[-99,48],[-101,48],[-101,46]]]}
                """);

        var analysis = DataGovSpatialGeometryAnalyzer.analyze(geometry);

        assertEquals(SpatialGeometryStatus.VALID, analysis.status());
        assertEquals("Polygon", analysis.geometryType());
        assertEquals(5, analysis.positionCount());
        assertEquals(-101.0, analysis.bounds().minLon());
        assertEquals(48.0, analysis.bounds().maxLat());
        assertEquals(-100.0, analysis.bounds().center().lon());
        assertTrue(analysis.queryable());
    }

    @Test
    void classifiesWideLongitudeSpanWithoutRepairingPublisherCoordinates() throws Exception {
        var geometry = objectMapper.readTree(
                """
                {"type":"Polygon","coordinates":[[[-170,50],[170,50],[170,60],[-170,60],[-170,50]]]}
                """);

        var analysis = DataGovSpatialGeometryAnalyzer.analyze(geometry);

        assertEquals(SpatialGeometryStatus.ANTIMERIDIAN_CANDIDATE, analysis.status());
        assertEquals(340.0, analysis.bounds().longitudeSpan());
        assertTrue(analysis.queryable());
    }

    @Test
    void quarantinesStructurallyInvalidOrOutOfDomainGeometry() throws Exception {
        var openRing = objectMapper.readTree(
                """
                {"type":"Polygon","coordinates":[[[-101,46],[-99,46],[-99,48],[-101,48]]]}
                """);
        var outOfDomain = objectMapper.readTree(
                """
                {"type":"Point","coordinates":[200,95]}
                """);

        var openAnalysis = DataGovSpatialGeometryAnalyzer.analyze(openRing);
        var domainAnalysis = DataGovSpatialGeometryAnalyzer.analyze(outOfDomain);

        assertEquals(SpatialGeometryStatus.QUARANTINED, openAnalysis.status());
        assertFalse(openAnalysis.queryable());
        assertTrue(openAnalysis.problems().stream().anyMatch(problem -> problem.contains("not closed")));
        assertEquals(SpatialGeometryStatus.QUARANTINED, domainAnalysis.status());
        assertTrue(domainAnalysis.problems().stream().anyMatch(problem -> problem.contains("WGS84")));
    }

    @Test
    void normalizesCurrentDataGovLatLonCentroidAndKeepsOtherFormsTolerant() throws Exception {
        var current = objectMapper.readTree("{\"lat\":47.0,\"lon\":-100.0}");
        var geoJson = objectMapper.readTree("{\"type\":\"Point\",\"coordinates\":[-99.5,46.5]}");
        var invalid = objectMapper.readTree("{\"lat\":120,\"lon\":-100}");

        var currentPoint = DataGovSpatialGeometryAnalyzer.normalizeCentroid(current, objectMapper);
        var geoJsonPoint = DataGovSpatialGeometryAnalyzer.normalizeCentroid(geoJson, objectMapper);

        assertNotNull(currentPoint);
        assertEquals(-100.0, currentPoint.lon());
        assertEquals(47.0, currentPoint.lat());
        assertEquals(-99.5, geoJsonPoint.lon());
        assertNull(DataGovSpatialGeometryAnalyzer.normalizeCentroid(invalid, objectMapper));
    }
}
