package org.civicsrepo.spatial;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Types;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.civicsrepo.federation.FederatedSourceSystem;
import org.civicsrepo.generated.dto.ResearchObjectType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class ResearchSpatialCoverageQueryServiceTest {
    private static final String BUILD_ID = "build-coverage";
    private static final String COMPOSITION_SHA = "a".repeat(64);
    private static final String PROJECTION_ID = "b".repeat(64);
    private static final OffsetDateTime SNAPSHOT_AT = OffsetDateTime.parse("2026-09-02T20:00:00Z");

    private JdbcClient jdbcClient;
    private ResearchSpatialSidecarStore sidecarStore;
    private ResearchSpatialCoverageQueryService service;

    @BeforeEach
    void setUp() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource(
                "jdbc:h2:mem:research-spatial-query-" + System.nanoTime() + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
                "sa",
                "");
        jdbcClient = JdbcClient.create(dataSource);
        createTables();
        sidecarStore = mock(ResearchSpatialSidecarStore.class);
        when(sidecarStore.findActiveBuild(FederatedSourceSystem.DATA_GOV)).thenReturn(Optional.of(activeBuild()));
        service = new ResearchSpatialCoverageQueryService(jdbcClient, sidecarStore, new ObjectMapper());
    }

    @Test
    void reportsMatchingMappedUnmappedQuarantinedAndTruncatedViewportFeatures() {
        insertFederated("inside-a", "Climate adaptation atlas", "NOAA", "Climate Program");
        insertSpatial(
                "inside-a",
                SpatialGeometryStatus.VALID,
                rectangle(-101, 45, -99, 47),
                -101.0,
                45.0,
                -99.0,
                47.0,
                -100.0,
                46.0,
                "SHAPE_BOUNDS_CENTER");
        insertFederated("inside-b", "Climate science observations", "NOAA", "Climate Program");
        insertSpatial(
                "inside-b",
                SpatialGeometryStatus.VALID,
                rectangle(-100, 46, -98, 48),
                -100.0,
                46.0,
                -98.0,
                48.0,
                -99.0,
                47.0,
                "SHAPE_BOUNDS_CENTER");
        insertFederated("outside", "Climate adaptation archive", "NOAA", "Climate Program");
        insertSpatial(
                "outside",
                SpatialGeometryStatus.VALID,
                rectangle(-80, 30, -78, 32),
                -80.0,
                30.0,
                -78.0,
                32.0,
                -79.0,
                31.0,
                "SHAPE_BOUNDS_CENTER");
        insertFederated("no-shape", "Climate adaptation metadata", "NOAA", "Climate Program");
        insertSpatial(
                "no-shape",
                SpatialGeometryStatus.NO_PUBLISHER_GEOMETRY,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null);
        insertFederated("quarantined", "Climate adaptation invalid geometry", "NOAA", "Climate Program");
        insertSpatial(
                "quarantined",
                SpatialGeometryStatus.QUARANTINED,
                "{\"type\":\"Point\",\"coordinates\":[999,46]}",
                null,
                null,
                null,
                null,
                null,
                null,
                null);
        insertFederated("other-program", "Climate adaptation economics", "NOAA", "Economics");
        insertSpatial(
                "other-program",
                SpatialGeometryStatus.VALID,
                rectangle(-100, 45, -99, 46),
                -100.0,
                45.0,
                -99.0,
                46.0,
                -99.5,
                45.5,
                "SHAPE_BOUNDS_CENTER");

        ResearchSpatialCoverageResponse response = service.query(
                "climate adaptation science",
                List.of("Climate Program"),
                "NOAA",
                FederatedSourceSystem.DATA_GOV,
                null,
                ResearchObjectType.DATASET,
                null,
                new ResearchSpatialViewport(-105, 40, -90, 50),
                1);

        assertEquals(BUILD_ID, response.buildId());
        assertEquals(COMPOSITION_SHA, response.compositionSha256());
        assertEquals(PROJECTION_ID, response.projectionId());
        assertEquals(5, response.summary().matchingRecords());
        assertEquals(3, response.summary().mappedRecords());
        assertEquals(1, response.summary().unmappedRecords());
        assertEquals(1, response.summary().quarantinedRecords());
        assertEquals(2, response.summary().viewportMappedRecords());
        assertEquals(1, response.summary().returnedFeatures());
        assertEquals(1, response.summary().omittedFeatures());
        assertTrue(response.summary().truncated());
        assertEquals(1, response.features().size());
        assertEquals("inside-a", response.features().getFirst().sourceIdentifier());
        assertEquals("Polygon", response.features().getFirst().geometry().path("type").asText());
    }

    @Test
    void handlesDatelineViewportUsingExplicitAntimeridianRenderAnchor() {
        insertFederated("anti", "Pacific climate coverage", "NOAA", "Climate Program");
        insertSpatial(
                "anti",
                SpatialGeometryStatus.ANTIMERIDIAN_CANDIDATE,
                rectangle(170, 45, -170, 50),
                -170.0,
                45.0,
                170.0,
                50.0,
                175.0,
                47.0,
                "DATA_GOV_SOURCE_POINT_FOR_ANTIMERIDIAN_CANDIDATE");
        insertFederated("anti-unanchored", "Pacific climate unanchored", "NOAA", "Climate Program");
        insertSpatial(
                "anti-unanchored",
                SpatialGeometryStatus.ANTIMERIDIAN_CANDIDATE,
                rectangle(170, 40, -170, 44),
                -170.0,
                40.0,
                170.0,
                44.0,
                null,
                null,
                null);

        ResearchSpatialCoverageResponse response = service.query(
                "pacific climate",
                List.of(),
                null,
                FederatedSourceSystem.DATA_GOV,
                null,
                ResearchObjectType.DATASET,
                null,
                new ResearchSpatialViewport(160, 30, -160, 60),
                10);

        assertEquals(2, response.summary().matchingRecords());
        assertEquals(2, response.summary().mappedRecords());
        assertEquals(1, response.summary().unanchoredAntimeridianRecords());
        assertEquals(1, response.summary().viewportMappedRecords());
        assertEquals(List.of("anti"), response.features().stream().map(ResearchSpatialCoverageFeature::sourceIdentifier).toList());
        assertFalse(response.summary().truncated());
    }

    @Test
    void fingerprintIsStableForEquivalentProgramOrderAndCase() {
        insertFederated("one", "Climate record", "NOAA", "Alpha");
        insertSpatial(
                "one",
                SpatialGeometryStatus.VALID,
                rectangle(-101, 45, -99, 47),
                -101.0,
                45.0,
                -99.0,
                47.0,
                -100.0,
                46.0,
                "SHAPE_BOUNDS_CENTER");

        ResearchSpatialCoverageResponse first = service.query(
                " Climate ",
                List.of("Beta", "ALPHA", "beta"),
                " NOAA ",
                FederatedSourceSystem.DATA_GOV,
                null,
                ResearchObjectType.DATASET,
                null,
                new ResearchSpatialViewport(-180, -90, 180, 90),
                10);
        ResearchSpatialCoverageResponse second = service.query(
                "climate",
                List.of("alpha", "beta"),
                "noaa",
                FederatedSourceSystem.DATA_GOV,
                null,
                ResearchObjectType.DATASET,
                null,
                new ResearchSpatialViewport(-180, -90, 180, 90),
                10);

        assertEquals(first.criteriaFingerprint(), second.criteriaFingerprint());
    }

    @Test
    void currentFederatedGeographyAndVintageFiltersDoNotInventMetadata() {
        insertFederated("one", "Climate record", "NOAA", "Climate Program");
        insertSpatial(
                "one",
                SpatialGeometryStatus.VALID,
                rectangle(-101, 45, -99, 47),
                -101.0,
                45.0,
                -99.0,
                47.0,
                -100.0,
                46.0,
                "SHAPE_BOUNDS_CENTER");

        ResearchSpatialCoverageResponse geography = service.query(
                "climate",
                List.of(),
                null,
                FederatedSourceSystem.DATA_GOV,
                "North Dakota",
                null,
                null,
                new ResearchSpatialViewport(-180, -90, 180, 90),
                10);
        ResearchSpatialCoverageResponse vintage = service.query(
                "climate",
                List.of(),
                null,
                FederatedSourceSystem.DATA_GOV,
                null,
                null,
                2024,
                new ResearchSpatialViewport(-180, -90, 180, 90),
                10);

        assertEquals(0, geography.summary().matchingRecords());
        assertEquals(0, vintage.summary().matchingRecords());
    }

    @Test
    void rejectsUnsafeLimitsAndUnavailableSources() {
        assertThrows(
                IllegalArgumentException.class,
                () -> service.query(
                        null,
                        List.of(),
                        null,
                        FederatedSourceSystem.DATA_GOV,
                        null,
                        null,
                        null,
                        new ResearchSpatialViewport(-180, -90, 180, 90),
                        501));

        when(sidecarStore.findActiveBuild(FederatedSourceSystem.NASA_CMR)).thenReturn(Optional.empty());
        assertThrows(
                ResearchSpatialCoverageUnavailableException.class,
                () -> service.query(
                        null,
                        List.of(),
                        null,
                        FederatedSourceSystem.NASA_CMR,
                        null,
                        null,
                        null,
                        new ResearchSpatialViewport(-180, -90, 180, 90),
                        10));
    }

    @Test
    void validatesViewportDomainAndAllowsDatelineCrossing() {
        assertThrows(IllegalArgumentException.class, () -> new ResearchSpatialViewport(-181, 0, 10, 20));
        assertThrows(IllegalArgumentException.class, () -> new ResearchSpatialViewport(-10, 30, 10, 20));
        assertTrue(new ResearchSpatialViewport(170, -20, -170, 20).crossesAntimeridian());
    }

    private ResearchSpatialSidecarBuild activeBuild() {
        return new ResearchSpatialSidecarBuild(
                BUILD_ID,
                FederatedSourceSystem.DATA_GOV,
                1,
                SNAPSHOT_AT,
                SNAPSHOT_AT,
                COMPOSITION_SHA,
                PROJECTION_ID,
                ResearchSpatialSidecarBuild.Status.COMPLETE,
                0,
                null,
                SNAPSHOT_AT.plusMinutes(5));
    }

    private void createTables() {
        jdbcClient
                .sql(
                        """
                        create table federated_research_objects (
                            id text primary key,
                            source_system text not null,
                            source_identifier text not null,
                            title text not null,
                            summary text not null,
                            publisher text not null,
                            program text not null,
                            content_type text not null,
                            source_url text not null
                        )
                        """)
                .update();
        jdbcClient
                .sql(
                        """
                        create table research_spatial_sidecar_rows (
                            build_id text not null,
                            source_system text not null,
                            source_identifier text not null,
                            geometry_json text,
                            geometry_status text not null,
                            min_lon double precision,
                            min_lat double precision,
                            max_lon double precision,
                            max_lat double precision,
                            render_lon double precision,
                            render_lat double precision,
                            render_point_method text
                        )
                        """)
                .update();
    }

    private void insertFederated(String identifier, String title, String publisher, String program) {
        jdbcClient
                .sql(
                        """
                        insert into federated_research_objects (
                            id, source_system, source_identifier, title, summary, publisher, program, content_type, source_url
                        ) values (
                            :id, 'DATA_GOV', :identifier, :title, :summary, :publisher, :program, 'DATASET', :sourceUrl
                        )
                        """)
                .param("id", "DATA_GOV:" + identifier)
                .param("identifier", identifier)
                .param("title", title)
                .param("summary", "Federal climate science and adaptation research data")
                .param("publisher", publisher)
                .param("program", program)
                .param("sourceUrl", "https://catalog.data.gov/dataset/" + identifier)
                .update();
    }

    private void insertSpatial(
            String identifier,
            SpatialGeometryStatus status,
            String geometryJson,
            Double minLon,
            Double minLat,
            Double maxLon,
            Double maxLat,
            Double renderLon,
            Double renderLat,
            String renderMethod) {
        var statement = jdbcClient
                .sql(
                        """
                        insert into research_spatial_sidecar_rows (
                            build_id, source_system, source_identifier, geometry_json, geometry_status,
                            min_lon, min_lat, max_lon, max_lat, render_lon, render_lat, render_point_method
                        ) values (
                            :buildId, 'DATA_GOV', :identifier, :geometryJson, :geometryStatus,
                            :minLon, :minLat, :maxLon, :maxLat, :renderLon, :renderLat, :renderMethod
                        )
                        """)
                .param("buildId", BUILD_ID)
                .param("identifier", identifier)
                .param("geometryStatus", status.name());
        statement.param("geometryJson", geometryJson, Types.VARCHAR);
        statement.param("minLon", minLon, Types.DOUBLE);
        statement.param("minLat", minLat, Types.DOUBLE);
        statement.param("maxLon", maxLon, Types.DOUBLE);
        statement.param("maxLat", maxLat, Types.DOUBLE);
        statement.param("renderLon", renderLon, Types.DOUBLE);
        statement.param("renderLat", renderLat, Types.DOUBLE);
        statement.param("renderMethod", renderMethod, Types.VARCHAR);
        statement.update();
    }

    private String rectangle(double west, double south, double east, double north) {
        return "{\"type\":\"Polygon\",\"coordinates\":[[["
                + west
                + ","
                + south
                + "],["
                + east
                + ","
                + south
                + "],["
                + east
                + ","
                + north
                + "],["
                + west
                + ","
                + north
                + "],["
                + west
                + ","
                + south
                + "]]]}";
    }
}
