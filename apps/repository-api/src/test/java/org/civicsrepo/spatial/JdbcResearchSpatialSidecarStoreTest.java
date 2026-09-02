package org.civicsrepo.spatial;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.OffsetDateTime;
import java.util.List;
import org.civicsrepo.federation.FederatedSourceSystem;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class JdbcResearchSpatialSidecarStoreTest {
    private static final String COMPOSITION = "a".repeat(64);
    private static final String PROJECTION = "b".repeat(64);
    private static final OffsetDateTime SNAPSHOT = OffsetDateTime.parse("2026-09-02T23:30:00Z");

    private JdbcClient jdbcClient;
    private JdbcResearchSpatialSidecarStore store;

    @BeforeEach
    void setUp() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource(
                "jdbc:h2:mem:spatial-sidecar-" + System.nanoTime() + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1", "sa", "");
        jdbcClient = JdbcClient.create(dataSource);
        jdbcClient
                .sql(
                        """
                        create table federated_research_objects (
                            id text primary key,
                            source_system text not null,
                            source_identifier text not null,
                            unique (source_system, source_identifier)
                        )
                        """)
                .update();
        jdbcClient
                .sql("insert into federated_research_objects (id, source_system, source_identifier) values ('DATA_GOV:retained-1', 'DATA_GOV', 'retained-1')")
                .update();
        store = new JdbcResearchSpatialSidecarStore(jdbcClient, dataSource);
        store.createSchema();
    }

    @Test
    void persistsOnlyRetainedC2IdentitiesAndActivatesCompletedBuild() {
        ResearchSpatialSidecarBuild build = runningBuild("build-1");
        store.beginBuild(build);

        int retained = store.upsertRetainedBatch(
                build.buildId(),
                List.of(
                        record("retained-1", SpatialGeometryStatus.VALID),
                        record("not-retained", SpatialGeometryStatus.VALID)));

        assertEquals(1, retained);
        assertEquals(1, store.countBuildRows(build.buildId()));
        ResearchSpatialSidecarBuild completed = store.completeAndActivate(build.buildId());
        assertEquals(ResearchSpatialSidecarBuild.Status.COMPLETE, completed.status());
        assertEquals(1, completed.rowCount());
        assertEquals(1, store.countActive(FederatedSourceSystem.DATA_GOV));
        assertTrue(store.findActive(FederatedSourceSystem.DATA_GOV, "retained-1").isPresent());
        assertTrue(store.findActive(FederatedSourceSystem.DATA_GOV, "not-retained").isEmpty());
    }

    @Test
    void preservesRetainedGeospatialEvidenceWithoutPublisherGeometry() {
        ResearchSpatialSidecarBuild build = runningBuild("build-no-shape");
        store.beginBuild(build);

        int retained = store.upsertRetainedBatch(build.buildId(), List.of(noShapeRecord("retained-1")));
        store.completeAndActivate(build.buildId());

        ResearchSpatialSidecarRecord evidence =
                store.findActive(FederatedSourceSystem.DATA_GOV, "retained-1").orElseThrow();
        assertEquals(1, retained);
        assertEquals(SpatialGeometryStatus.NO_PUBLISHER_GEOMETRY, evidence.geometryStatus());
        assertEquals(-100.0, evidence.sourceCentroidLon());
        assertEquals(47.0, evidence.sourceCentroidLat());
        assertEquals("North Dakota", evidence.rawDcatSpatial());
        assertFalse(evidence.queryableGeometry());
    }

    @Test
    void failedReplacementNeverDisplacesLastKnownGoodActivation() {
        ResearchSpatialSidecarBuild first = runningBuild("build-good");
        store.beginBuild(first);
        store.upsertRetainedBatch(first.buildId(), List.of(record("retained-1", SpatialGeometryStatus.VALID)));
        store.completeAndActivate(first.buildId());

        ResearchSpatialSidecarBuild replacement = runningBuild("build-failed");
        store.beginBuild(replacement);
        store.upsertRetainedBatch(
                replacement.buildId(),
                List.of(record("retained-1", SpatialGeometryStatus.ANTIMERIDIAN_CANDIDATE)));
        ResearchSpatialSidecarBuild failed = store.failBuild(replacement.buildId(), "source traversal failed");

        assertEquals(ResearchSpatialSidecarBuild.Status.FAILED, failed.status());
        assertEquals("build-good", store.findActiveBuild(FederatedSourceSystem.DATA_GOV).orElseThrow().buildId());
        assertEquals(
                SpatialGeometryStatus.VALID,
                store.findActive(FederatedSourceSystem.DATA_GOV, "retained-1").orElseThrow().geometryStatus());
    }

    @Test
    void coalescesDuplicateSourceRowsWithinABatch() {
        ResearchSpatialSidecarBuild build = runningBuild("build-duplicates");
        store.beginBuild(build);

        int retained = store.upsertRetainedBatch(
                build.buildId(),
                List.of(
                        record("retained-1", SpatialGeometryStatus.VALID),
                        record("retained-1", SpatialGeometryStatus.ANTIMERIDIAN_CANDIDATE)));
        store.completeAndActivate(build.buildId());

        assertEquals(1, retained);
        assertEquals(1, store.countActive(FederatedSourceSystem.DATA_GOV));
        assertEquals(
                SpatialGeometryStatus.ANTIMERIDIAN_CANDIDATE,
                store.findActive(FederatedSourceSystem.DATA_GOV, "retained-1").orElseThrow().geometryStatus());
    }

    private ResearchSpatialSidecarBuild runningBuild(String buildId) {
        return new ResearchSpatialSidecarBuild(
                buildId,
                FederatedSourceSystem.DATA_GOV,
                1,
                SNAPSHOT,
                SNAPSHOT,
                COMPOSITION,
                PROJECTION,
                ResearchSpatialSidecarBuild.Status.RUNNING,
                0,
                null,
                null);
    }

    private ResearchSpatialSidecarRecord record(String identifier, SpatialGeometryStatus status) {
        boolean antimeridian = status == SpatialGeometryStatus.ANTIMERIDIAN_CANDIDATE;
        String geometryJson = antimeridian
                ? "{\"type\":\"Polygon\",\"coordinates\":[[[-170,50],[170,50],[170,60],[-170,60],[-170,50]]]}"
                : "{\"type\":\"Polygon\",\"coordinates\":[[[-101,46],[-99,46],[-99,48],[-101,48],[-101,46]]]}";
        return new ResearchSpatialSidecarRecord(
                FederatedSourceSystem.DATA_GOV,
                identifier,
                1,
                SNAPSHOT,
                SNAPSHOT,
                COMPOSITION,
                PROJECTION,
                geometryJson,
                "Polygon",
                status,
                antimeridian ? -170.0 : -101.0,
                antimeridian ? 50.0 : 46.0,
                antimeridian ? 170.0 : -99.0,
                antimeridian ? 60.0 : 48.0,
                antimeridian ? 179.0 : -100.0,
                antimeridian ? 55.0 : 47.0,
                "DATA_GOV_VERTEX_MEAN",
                antimeridian ? 179.0 : -100.0,
                antimeridian ? 55.0 : 47.0,
                antimeridian
                        ? "DATA_GOV_SOURCE_POINT_FOR_ANTIMERIDIAN_CANDIDATE"
                        : "SHAPE_BOUNDS_CENTER",
                antimeridian ? "-170,50,170,60" : "-101,46,-99,48",
                "{}",
                "{}");
    }

    private ResearchSpatialSidecarRecord noShapeRecord(String identifier) {
        return new ResearchSpatialSidecarRecord(
                FederatedSourceSystem.DATA_GOV,
                identifier,
                1,
                SNAPSHOT,
                SNAPSHOT,
                COMPOSITION,
                PROJECTION,
                null,
                null,
                SpatialGeometryStatus.NO_PUBLISHER_GEOMETRY,
                null,
                null,
                null,
                null,
                -100.0,
                47.0,
                "DATA_GOV_VERTEX_MEAN",
                null,
                null,
                null,
                "North Dakota",
                "{\"sourceMatch\":\"DATA_GOV_GEOSPATIAL_FILTER\"}",
                "{\"geometryStatus\":\"NO_PUBLISHER_GEOMETRY\"}");
    }
}
