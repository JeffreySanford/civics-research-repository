package org.civicsrepo.spatial;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.OffsetDateTime;
import org.civicsrepo.federation.FederatedSourceSystem;
import org.junit.jupiter.api.Test;

class ResearchSpatialSidecarTimestampPrecisionTest {
    private static final String COMPOSITION = "a".repeat(64);
    private static final String PROJECTION = "b".repeat(64);
    private static final OffsetDateTime NANOSECOND_TIMESTAMP =
            OffsetDateTime.parse("2026-09-03T02:15:16.123456789Z");
    private static final OffsetDateTime POSTGRES_TIMESTAMP =
            OffsetDateTime.parse("2026-09-03T02:15:16.123456Z");

    @Test
    void normalizesBuildIdentityTimestampsToPostgresMicrosecondPrecision() {
        ResearchSpatialSidecarBuild build = new ResearchSpatialSidecarBuild(
                "build-1",
                FederatedSourceSystem.DATA_GOV,
                1,
                NANOSECOND_TIMESTAMP,
                NANOSECOND_TIMESTAMP,
                COMPOSITION,
                PROJECTION,
                ResearchSpatialSidecarBuild.Status.RUNNING,
                0,
                null,
                null);

        assertThat(build.sourceSnapshotAt()).isEqualTo(POSTGRES_TIMESTAMP);
        assertThat(build.capturedAt()).isEqualTo(POSTGRES_TIMESTAMP);
    }

    @Test
    void normalizesRowIdentityTimestampsToTheSamePostgresPrecision() {
        ResearchSpatialSidecarRecord record = new ResearchSpatialSidecarRecord(
                FederatedSourceSystem.DATA_GOV,
                "dataset-1",
                1,
                NANOSECOND_TIMESTAMP,
                NANOSECOND_TIMESTAMP,
                COMPOSITION,
                PROJECTION,
                null,
                null,
                SpatialGeometryStatus.NO_PUBLISHER_GEOMETRY,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                "{\"source\":\"test\"}",
                "{\"geometryStatus\":\"NO_PUBLISHER_GEOMETRY\"}");

        assertThat(record.sourceSnapshotAt()).isEqualTo(POSTGRES_TIMESTAMP);
        assertThat(record.capturedAt()).isEqualTo(POSTGRES_TIMESTAMP);
    }
}
